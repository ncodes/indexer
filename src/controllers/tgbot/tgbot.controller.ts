import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { TGBotService } from './tgbot.service';
import { CommonValidationPipeOpt as ValPipeOpt } from '../../common/pipes/common.pipe';
import { RegisterDTO } from './dto';

/**
 * TGBotController handles Telegram bot capabilities
 */
@Controller('v1/tgbot')
export class TGBotController {
  constructor(private tgBotSrv: TGBotService) {}

  @Post('/register-user')
  async registerUser(@Body(new ValidationPipe(ValPipeOpt)) q: RegisterDTO) {
    return 'user';
  }
}
