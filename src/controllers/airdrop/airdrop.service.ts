import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export default class AirdropService {
  constructor(private cfgSrv: ConfigService) {}
}
