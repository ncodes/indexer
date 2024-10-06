import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { File } from 'buffer';
import { PinataSDK } from 'pinata';
import Swap from '../../models/swap';
import User from '../../models/user';

@Injectable()
export class FilesService {
  constructor(private cfgSrv: ConfigService) {}

  private getPinata() {
    return new PinataSDK({
      pinataJwt: this.cfgSrv.get('app.pinata.key'),
      pinataGateway: this.cfgSrv.get('app.pinata.gateway'),
    });
  }

  /**
   * Pin a file to IPFS
   * @param file The file object
   * @param swap The swap object
   * @param owner The owner of the file
   * @param prefix The prefix of the file
   */
  async upload(file: Express.Multer.File, swap: Swap, owner: User, prefix: string) {
    const pinata = this.getPinata();
    const blob = new Blob([file.buffer]);
    const name = `${prefix}:${swap.id}`;
    const f = new File([blob], name, { type: file.mimetype });
    const res = await pinata.upload.file(f, {
      metadata: { name },
    });

    return res.cid;
  }

  /**
   * Check if a CID exists on IPFS
   * @param cid The CID to check
   * @returns True if the CID exists, false otherwise
   */
  async cidExists(cid: string) {
    const pinata = this.getPinata();
    const res = await pinata.files.list().cid(cid);
    return res.files.length > 0;
  }

  /**
   * Get a signed URL for a CID
   * @param cid The CID to get a signed URL for
   * @returns The signed URL
   */
  async getSignedUrl(cid: string) {
    const pinata = this.getPinata();
    const res = await pinata.gateways.createSignedURL({
      cid,
      expires: 365 * 24 * 60 * 60,
    });
    return res;
  }
}
