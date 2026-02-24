import { Module, Global } from '@nestjs/common';
import { GoogleSheetsService } from './google-sheets.service.js';
import { GoogleSheetsController } from './google-sheets.controller.js';

@Global()
@Module({
  providers: [GoogleSheetsService],
  controllers: [GoogleSheetsController],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule {}
