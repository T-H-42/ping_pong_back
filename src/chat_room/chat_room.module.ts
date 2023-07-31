import { Module } from '@nestjs/common';
import { ChatRoomService } from './chat_room.service';
import { ChatRoomController } from './chat_room.controller';

@Module({
  providers: [ChatRoomService],
  controllers: [ChatRoomController]
})
export class ChatRoomModule {}
