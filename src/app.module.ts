import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { GoogleSheetsModule } from './google-sheets/google-sheets.module.js';
import { SimplyBookModule } from './simply-book/simply-book.module.js';
import { EmailModule } from './email/email.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GoogleSheetsModule,
    SimplyBookModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
