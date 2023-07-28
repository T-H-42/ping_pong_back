import { Test, TestingModule } from '@nestjs/testing';
import { FriendGatewayGateway } from './friend-gateway.gateway';

describe('FriendGatewayGateway', () => {
  let gateway: FriendGatewayGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FriendGatewayGateway],
    }).compile();

    gateway = module.get<FriendGatewayGateway>(FriendGatewayGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
