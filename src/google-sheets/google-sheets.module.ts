import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GoogleSheetsService } from './google-sheets.service.js';
import { GoogleSheetsController } from './google-sheets.controller.js';

@Global()
@Module({
  imports: [HttpModule],
  providers: [GoogleSheetsService],
  controllers: [GoogleSheetsController],
  exports: [GoogleSheetsService],
})
export class GoogleSheetsModule {}
