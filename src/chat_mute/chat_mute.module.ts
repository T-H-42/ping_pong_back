import { Module } from '@nestjs/common';
import { ChatMuteService } from './chat_mute.service';
import { ChatMuteController } from './chat_mute.controller';

@Module({
  providers: [ChatMuteService],
  controllers: [ChatMuteController]
})
export class ChatMuteModule {}
