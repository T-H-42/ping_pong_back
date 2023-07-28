import { Module } from '@nestjs/common';
import { ChatUserService } from './chat_user.service';
import { ChatUserController } from './chat_user.controller';

@Module({
  providers: [ChatUserService],
  controllers: [ChatUserController]
})
export class ChatUserModule {}
