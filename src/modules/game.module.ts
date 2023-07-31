import { Module } from '@nestjs/common';
import { GameService } from '../game/game.service';
import { GameController } from '../game/game.controller';

@Module({
  providers: [GameService],
  controllers: [GameController]
})
export class GameModule {}
