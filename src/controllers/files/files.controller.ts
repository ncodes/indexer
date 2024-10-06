import { isValidChain } from '@jointlabs/meta';
import { Controller, Param, ParseFilePipe, Post, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import validator from 'validator';
import { ok, throw400, throw401 } from '../../common/responses/responses';
import { BeAuthenticatedGuard } from '../../guards/be_authenticated.guard';
import { HasKeyGuard } from '../../guards/has_token.guard';
import Swap from '../../models/swap';
import SwapService from '../swaps/swap.service';
import { FilesService } from './files.service';

@Controller('v1/files')
export class FilesController {
  constructor(private fileSrv: FilesService, private cfgSrv: ConfigService) {}

  /**
   * Process file upload
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
        fileIsRequired: true,
        exceptionFactory: (errors) => {
          throw400(errors.toLowerCase());
        },
      }),
    )
    file: Express.Multer.File,
  ) {
    // Validate network
    if (!isValidChain(network)) throw400('network is unknown');

    // Validate order ID
    if (!validator.isNumeric(orderId)) throw400('order id is not a number');

    // Validate images
    if (file.mimetype.startsWith('image')) {
      if (!this.cfgSrv.get<string>('app.fileUpload.allowedImageTypes').split(',').includes(file.mimetype))
        throw400('file type is not valid (only jpg, jpeg, png are allowed)');
      if (file.size > parseInt(this.cfgSrv.get('app.fileUpload.maxImageSize')))
        throw400('file limit was exceeded (max: 10MB)');
    }

    // Validate videos
    else if (file.mimetype.startsWith('video')) {
      if (!this.cfgSrv.get<string>('app.fileUpload.allowedVideoTypes').split(',').includes(file.mimetype))
        throw400('file type is not valid (only mp4, mov, wmv, webm are allowed)');
      if (file.size > parseInt(this.cfgSrv.get('app.fileUpload.maxVideoSize')))
        throw400('file limit was exceeded (max: 30MB)');
    }

    // Validate documents
    else if (this.cfgSrv.get<string>('app.fileUpload.allowedDocTypes').split(',').includes(file.mimetype)) {
      if (file.size > parseInt(this.cfgSrv.get('app.fileUpload.maxDocSize')))
        throw400('file limit was exceeded (max: 10MB)');
    } else {
      throw400('file type is not supported');
    }

    // Get swap
    const swap = await Swap.get(network, parseInt(orderId), undefined, '[disputes.[draftees],payRouterRequest]');
    if (!swap) throw400('swap not found');

    await SwapService.loadPayRouterRequest(swap);

    // Make sure user is part of the swap or dispute
    const user = req.user;
    if (
      !Swap.isSwapCounterparty(swap, user.address) &&
      !Swap.isSwapDraftee(swap, user.address, true) &&
      !Swap.isRouter(swap, user.address)
    )
      throw401('you are not allowed to upload files for this swap');

    return ok()
      .data({ hash: await this.fileSrv.upload(file, swap, user, 'appeal') })
      .build<string>();
  }
}
