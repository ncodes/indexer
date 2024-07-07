import { Controller, Get } from '@nestjs/common';
import { ok } from '../../common/responses/responses';

@Controller('v1/health')
export class HealthController {
  @Get('')
  async getHealth() {
    return ok().build();
  }
}
