import { Module } from '@nestjs/common';
import { SimplyBookService } from './simply-book.service.js';
import { SimplyBookController } from './simply-book.controller.js';

@Module({
  providers: [SimplyBookService],
  controllers: [SimplyBookController],
})
export class SimplyBookModule {}
