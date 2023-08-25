import { Module } from '@nestjs/common';
import { GameService } from '../game/game.service';
import { GameController } from '../game/game.controller';
import { GameGateway } from 'src/gateway/game.gateway';
import { GameRepository } from 'src/game/game.repository';
import { UserModule } from './user.module';
import { ChatRoomModule } from 'src/chat_room/chat_room.module';

@Module({
  imports: [UserModule, ChatRoomModule],
  providers: [GameService, GameRepository, GameGateway],
  controllers: [GameController]
})
export class GameModule {}
