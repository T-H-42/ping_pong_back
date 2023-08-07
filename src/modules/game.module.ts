import { Module } from '@nestjs/common';
import { GameService } from '../game/game.service';
import { GameController } from '../game/game.controller';
import { GameGateway } from 'src/gateway/game.gateway';
import { GameRepository } from 'src/game/game.repository';
import { UserModule } from './user.module';

@Module({
  imports: [UserModule,],
  providers: [GameService, GameRepository, GameGateway],
  controllers: [GameController]
})
export class GameModule {}
