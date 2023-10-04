import {
  Controller,
  FileTypeValidator,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import cfg from '../../config/app.config';
import { FileInterceptor } from '@nestjs/platform-express';
import { isValidNetwork } from '../../network/common';
import { ok, throw400, throw401 } from '../../common/responses/responses';
import Swap from '../../models/swap';
import { FilesService } from './files.service';
import { HasKeyGuard } from '../../guards/has_token.guard';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import validator from 'validator';
import isNumeric = validator.isNumeric;

@Controller('v1/files')
export class FilesController {
  constructor(private fileSrv: FilesService) {}

  /**
   * Upload a file to IPFS
   * @param req The request object
   * @param network The network
   * @param orderId The order id
   * @param file The file object
   */
  @Post('upload/:net/:orderId')
  @UseInterceptors(FileInterceptor('file'))
  @UseGuards(BeAuthenticatedGuard)
  @UseGuards(HasKeyGuard)
  async upload(
    @Req() req: Request,
    @Param('net') network: string,
    @Param('orderId') orderId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: parseInt(cfg().app.maxSwapFileSize) || 5 * 1024 * 1024, // default to 5MB
          }),
          new FileTypeValidator({
            fileType: /(image\/(png|jpe?g))|(video\/mp4)/,
          }),
        ],
        fileIsRequired: true,
        exceptionFactory: (errors) => {
          throw400(errors.toLowerCase());
        },
      }),
    )
    file: Express.Multer.File,
  ) {
    if (!isValidNetwork(network)) throw400('network is unknown');
    if (!isNumeric(orderId)) throw400('order id is not a number');

    // Get swap
    const swap = await Swap.get(network, parseInt(orderId), undefined, '[disputes.[draftees]]');
    if (!swap) throw400('swap not found');

    // Make sure user is allowed to upload files
    const user = req.user;
    if (!Swap.isSwapCounterparty(swap, user.address) && !Swap.isSwapDraftee(swap, user.address, true))
      throw401('you are not allowed to upload files for this swap');

    // Upload file
    const hash = await this.fileSrv.upload(file, swap, user);

    return ok().data({ hash }).build<string>();
  }
}
