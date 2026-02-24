import { Test, TestingModule } from '@nestjs/testing';
import { SimplyBookController } from './simply-book.controller.js';

describe('SimplyBookController', () => {
  let controller: SimplyBookController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SimplyBookController],
    }).compile();

    controller = module.get<SimplyBookController>(SimplyBookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
