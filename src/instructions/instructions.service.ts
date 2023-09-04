import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PinataClient, { PinataPinListResponse } from '@pinata/sdk';
import axios from 'axios';
import { ethers, Wallet } from 'ethers';
import NetworkService from '../network/network.service';
import * as moment from 'moment';
const pinataSDK = require('@pinata/sdk');

@Injectable()
export class InstructionsService {
  constructor(private cfgSrv: ConfigService, private netSrv: NetworkService) {}

  private getPinata(): PinataClient {
    return new pinataSDK({ pinataJWTKey: this.cfgSrv.get('app.pinata.key') });
  }

  /**
   * Pin instruction to IPFS.
   * It clears the name of existing matching instructions before pinning.
   * @param obj The JSON object
   * @param name The name of the object
   */
  async pin(obj: Instructions, name?: string): Promise<string> {
    await this.clearName(name);
    const pinata = this.getPinata();
    const res = await pinata.pinJSONToIPFS(obj, { pinataMetadata: { name: name } });
    return res.IpfsHash;
  }

  /**
   * Get an instruction from IPFS
   * @param name The name of the object
   * @returns The instruction and the hash
   */
  async get(name: string): Promise<[Instructions, string]> {
    const pinata = this.getPinata();
    const result: PinataPinListResponse = await pinata.pinList({ metadata: { name: name, keyvalues: {} } });
    if (!result.rows.length) return [undefined, undefined];
    const res = await axios.get(`${this.cfgSrv.get('app.ipfs.gateway')}${result.rows[0].ipfs_pin_hash}`);
    return [res.data, result.rows[0].ipfs_pin_hash];
  }

  /**
   * Clear the name of instructions matching the given name
   * @param name The target name
   */
  async clearName(name: string) {
    const pinata = this.getPinata();
    const result: PinataPinListResponse = await pinata.pinList({ metadata: { name: name, keyvalues: {} } });
    if (!result.rows.length) return;
    for (const row of result.rows) {
      await pinata.hashMetadata(row.ipfs_pin_hash, {
        name: null,
      });
    }
    return;
  }

  /**
   * Grant the instruction badge to an address
   * @param network The target network
   * @param granteeAddr The address to grant the badge to
   * @param instructionHash The instruction hash point to IPFS resource
   */
  async getGrantSignature(network: string, granteeAddr: string, instructionHash: string) {
    const sigInfo: GrantSigInfo = { network };
    const instructionBadge = this.cfgSrv.get('app.badges.instruction');
    const badgeMgr = this.netSrv.getContracts(network).badgeMgr;
    const hasBadge = await badgeMgr.hasBadge(granteeAddr, instructionBadge, '');
    const signer = new Wallet(this.cfgSrv.get('app.badges.instructionIssuerPk'));
    const sigExp = moment().add(1, 'h');

    if (!hasBadge) {
      sigInfo.values = [instructionBadge, '', granteeAddr, 0, ['hash'], [instructionHash], sigExp.unix()];
      const msgHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['string', 'string', 'address', 'uint256', 'string[]', 'string[]', 'uint256'],
          sigInfo.values,
        ),
      );
      const msgHashBytes = Buffer.from(msgHash.substring(2), 'hex');
      sigInfo.sig = await signer.signMessage(msgHashBytes);
      sigInfo.isNew = true;
      return sigInfo;
    }

    sigInfo.values = [instructionBadge, '', granteeAddr, 'hash', instructionHash, sigExp.unix()];
    const msgHash = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ['string', 'string', 'address', 'string', 'string', 'uint256'],
        sigInfo.values,
      ),
    );
    const msgHashBytes = Buffer.from(msgHash.substring(2), 'hex');
    sigInfo.sig = await signer.signMessage(msgHashBytes);
    sigInfo.isNew = false;

    return sigInfo;
  }
}
