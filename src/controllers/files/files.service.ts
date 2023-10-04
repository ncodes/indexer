import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PinataClient from '@pinata/sdk';
import Swap from '../../models/swap';
import User from '../../models/user';
import { Readable } from 'stream';
const pinataSDK = require('@pinata/sdk');

@Injectable()
export class FilesService {
  constructor(private cfgSrv: ConfigService) {}

  private getPinata(): PinataClient {
    return new pinataSDK({ pinataJWTKey: this.cfgSrv.get('app.pinata.key') });
  }

  /**
   * Pin a file to IPFS
   * @param file The file object
   * @param swap The swap object
   * @param owner The owner of the file
   */
  async upload(file: Express.Multer.File, swap: Swap, owner: User) {
    const pinata = this.getPinata();
    const stream = Readable.from(file.buffer);
    const res = await pinata.pinFileToIPFS(stream, {
      pinataMetadata: {
        name: `file:${owner.id}:${swap.network}:${swap.id}:${Date.now() / 1000}`,
      },
    });
    return res.IpfsHash;
  }
}
