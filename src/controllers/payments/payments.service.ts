import { ChainNames } from '@jointlabs/meta';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AbiCoder, Wallet, keccak256 } from 'ethers';
import * as moment from 'moment';
import NetworkService from '../../network/network.service';

@Injectable()
export class PaymentsService {
  constructor(private cfgSrv: ConfigService, private netSrv: NetworkService) {}

  /**
   * Grant or update the payment method badge to an address
   * @param network The target network
   * @param badge The full badge (with path)
   * @param granteeAddr The address to grant the badge to
   * @param metaKey The meta key to set
   * @param metaValue The meta value to set
   */
  async getPaymentMethodGrantSignature(
    network: string,
    badge: string,
    granteeAddr: string,
    metaKey: string,
    metaValue: string,
  ) {
    const sigInfo: GrantSigInfo = { network };
    const badgeMgr = this.netSrv.getContracts(network as ChainNames).badgeMgr;
    const badgePath = badge.split('/');
    if (badgePath.length !== 2) throw new Error('invalid payment method badge path');

    const hasBadge = await badgeMgr.hasBadge(granteeAddr, badgePath[0], badgePath[1]);
    const signer = new Wallet(this.cfgSrv.get('app.badges.paymentMethodIssuerPk'));
    const sigExp = moment().add(1, 'h');

    let types: string[];
    if (!hasBadge) {
      types = ['string', 'string', 'address', 'uint256', 'string[]', 'string[]', 'uint256'];
      sigInfo.values = [badgePath[0], badgePath[1], granteeAddr, 0, [metaKey], [metaValue], sigExp.unix()];
      const msgHash = keccak256(AbiCoder.defaultAbiCoder().encode(types, sigInfo.values));
      const msgHashBytes = Buffer.from(msgHash.substring(2), 'hex');
      sigInfo.sig = await signer.signMessage(msgHashBytes);
      sigInfo.isNew = true;
      return sigInfo;
    }

    // Generate signature for upsertGranteeMetaBySig
    types = ['string', 'string', 'address', 'string', 'string', 'uint256'];
    sigInfo.values = [badgePath[0], badgePath[1], granteeAddr, metaKey, metaValue, sigExp.unix()];
    const msgHash = keccak256(AbiCoder.defaultAbiCoder().encode(types, sigInfo.values));
    const msgHashBytes = Buffer.from(msgHash.substring(2), 'hex');
    sigInfo.sig = await signer.signMessage(msgHashBytes);
    sigInfo.isNew = false;

    return sigInfo;
  }
}
