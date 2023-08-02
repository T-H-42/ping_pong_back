import { Module } from '@nestjs/common';
import { ChatRoomService } from './chat_room.service';
import { ChatRoomController } from './chat_room.controller';
import { ChatRoomRepository } from './chat_room.repository';

@Module({
  providers: [ChatRoomService,ChatRoomRepository],//
  controllers: [ChatRoomController],
  exports:[ChatRoomService]
})
export class ChatRoomModule {}
