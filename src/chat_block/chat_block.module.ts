import { Module } from '@nestjs/common';
import { ChatBlockService } from './chat_block.service';
import { ChatBlockController } from './chat_block.controller';

@Module({
  providers: [ChatBlockService],
  controllers: [ChatBlockController]
})
export class ChatBlockModule {}
