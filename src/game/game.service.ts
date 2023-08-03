import { Injectable } from '@nestjs/common';
import { User } from 'src/entity/user.entity';
import { GameGateway } from 'src/gateway/game.gateway';
import { GameRepository } from './game.repository';

@Injectable()
export class GameService {

	constructor(
		private gameRepository: GameRepository,
	) {}
}
