import { Module } from '@nestjs/common';
import { FriendController } from './friend.controller';
import { FriendService } from './friend.service';
import { UserModule } from 'src/user/user.module';
import { FriendRepository } from './friend.repository';

@Module({
  imports: [UserModule],
  controllers: [FriendController],
  providers: [FriendService, FriendRepository],
  exports : [FriendService],
})
export class FriendModule {}
