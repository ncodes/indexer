import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import * as moment from 'moment';
import { isProd, shortenAddr, toDec } from '../../common/common';
import { getClaimSig } from '../../common/crypto';
import { getTokenEnergonAlloc } from '../../controllers/points/point.service';
import NFTOwner from '../../models/nft_owner';
import Point, { PointAction } from '../../models/point';
import TokenClaim from '../../models/token_claim';
import User from '../../models/user';
import { pow10 } from '../../network/common';
import { Base } from '../base';
import { AllocatorName } from './common';

/**
 * NFTClaimJob is responsible for creating claim entries for NFT holders who
 * did not claim points for their NFTs.
 */
@Injectable()
export default class NFTClaimJob extends Base {
  private logger = new Logger(NFTClaimJob.name);
  namePrefix = AllocatorName.NFT;
  claimId = 4;
  tokenPerPoint = 0.03;

  constructor(private cfgSrv: ConfigService) {
    super();
    this.schedule();
  }

  @Cron('*/5 * * * *')
  schedule() {
    this.process().catch((e) => this.logger.error(e.message));
  }

  async process() {
    if (this.isProcessing()) return;
    this.setProcessing(true);

    try {
      const users = await User.findNullLateNFTClaimedAt(1000);

      this.logger.log(`Processing NFT claim for ${users.length} users`);

      for (const user of users) {
        const nfts = await NFTOwner.findByAddress(user.address);
        if (nfts.length > 0) {
          const numPointEntries = await Point.countByAddressAndAction(user.address, PointAction.NFTOwnership);
          if (numPointEntries == 0) {
            let totalPoints = '0';
            for (const nft of nfts) {
              const pointPerEng = parseFloat(this.cfgSrv.get('app.pointsPerEnergon'));
              const point = toDec(pointPerEng).mul(getTokenEnergonAlloc(nft.tokenId));
              totalPoints = toDec(totalPoints).add(point).toFixed();
            }

            const tokenAlloc = toDec(this.tokenPerPoint).mul(totalPoints);
            const tokenAllocLd = tokenAlloc.mul(pow10(18)).toFixed(0);

            const name = `${this.namePrefix}:${user.address}`;
            const existingMerkleEntry = await TokenClaim.findByName(name);

            if (!existingMerkleEntry) {
              const signature = await getClaimSig(
                this.cfgSrv.get('app.claimSigner'),
                user.address,
                tokenAllocLd,
                this.claimId,
                0,
                isProd() ? 8453 : 31337,
              );

              await TokenClaim.create({
                name,
                address: user.address,
                amount: tokenAllocLd,
                claimId: this.claimId,
                signature,
              });

              this.logger.log(`Created claim form user ${shortenAddr(user.address)} for ${tokenAlloc} points`);
            }
          }
        }

        await User.updateById(user.id, { lateNFTClaimedAt: moment().toISOString() });
      }
    } catch (e) {
      this.logger.error(e.message);
      return e;
    } finally {
      this.setProcessing(false);
    }
  }
}
