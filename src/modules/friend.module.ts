import { Module } from '@nestjs/common';
import { FriendController } from '../friend/friend.controller';
import { FriendService } from '../friend/friend.service';
import { UserModule } from 'src/modules/user.module';
import { FriendRepository } from '../friend/friend.repository';

@Module({
  imports: [UserModule],
  controllers: [FriendController],
  providers: [FriendService, FriendRepository],
  exports : [FriendService],
})
export class FriendModule {}
