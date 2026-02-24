import { Test, TestingModule } from '@nestjs/testing';
import { SimplyBookService } from './simply-book.service.js';

describe('SimplyBookService', () => {
  let service: SimplyBookService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SimplyBookService],
    }).compile();

    service = module.get<SimplyBookService>(SimplyBookService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
