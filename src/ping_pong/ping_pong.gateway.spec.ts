import { Test, TestingModule } from '@nestjs/testing';
import { PingPongGateway } from './ping_pong.gateway';

describe('PingPongGateway', () => {
  let gateway: PingPongGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PingPongGateway],
    }).compile();

    gateway = module.get<PingPongGateway>(PingPongGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
