import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as appRoot from 'app-root-path';
import * as fs from 'fs';
import * as path from 'path';
import { isEqualStr } from '../../common/common';

@Injectable()
export class AuthService {
  constructor(private cfg: ConfigService) {}

  /**
   * Check if an address is in the private allowlist
   * @param address The address to check
   * @returns
   */
  isInPrivateAllowlist(address: string) {
    const allowlist = fs.readFileSync(path.join(appRoot.path, 'allowlist/private_test.txt'), 'utf8');
    const lines = allowlist.split('\n');
    return lines.some((line) => isEqualStr(line.trim(), address.trim()));
  }
}
