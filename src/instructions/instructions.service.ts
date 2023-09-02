import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PinataClient, { PinataPinListResponse } from '@pinata/sdk';
import axios from 'axios';

export type Instructions = {
  global: string;
  liquidity: { [key: string]: string };
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pinataSDK = require('@pinata/sdk');

@Injectable()
export class InstructionsService {
  /**
   * Constructor
   * @param cfgSrv The config service
   */
  constructor(private cfgSrv: ConfigService) {}

  private getPinata(): PinataClient {
    return new pinataSDK({ pinataJWTKey: this.cfgSrv.get('app.pinata.key') });
  }

  /**
   * Pin instruction to IPFS
   * @param obj The JSON object
   * @param name The name of the object
   */
  async pin(obj: Instructions, name?: string): Promise<string> {
    const pinata = this.getPinata();
    const res = await pinata.pinJSONToIPFS(obj, {
      pinataMetadata: {
        name: name,
      },
    });
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
}
