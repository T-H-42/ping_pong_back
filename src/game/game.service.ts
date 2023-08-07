import { Injectable } from '@nestjs/common';
import { User } from 'src/entity/user.entity';
import { GameGateway } from 'src/gateway/game.gateway';
import { GameRepository } from './game.repository';

@Injectable()
export class GameService {
  constructor(private gameRepository: GameRepository) {}

  //1p 2p 소켓 id 를 인자로 받음
  async createGame(socket1: string, socket2: string) {
    const user1 = await User.findOne({ where: { game_sockid: socket1 } });
    const user2 = await User.findOne({ where: { game_sockid: socket2 } });
    const game = await this.gameRepository.createGame(user1, user2);
    return game;
  }
}
