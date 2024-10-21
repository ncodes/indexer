import { Controller, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('v1/airdrop')
export class AirdropController {
  private logger = new Logger(AirdropController.name);

  constructor(private cfgSrv: ConfigService) {}
}
