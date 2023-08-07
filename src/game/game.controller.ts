import { Controller, Get, UseGuards } from '@nestjs/common';
import { GameService } from './game.service';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/user/get-user.dacorator';
import { User } from 'src/entity/user.entity';
import { GameGateway } from 'src/gateway/game.gateway';

@Controller('game')
export class GameController {
	constructor(private gameService: GameService) {}

}
