import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RoutesService {
  constructor(private cfgSrv: ConfigService) {}
}
