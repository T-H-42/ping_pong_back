import { Injectable } from '@nestjs/common';
import { User } from 'src/entity/user.entity';
import { GameRepository } from './game.repository';

@Injectable()
export class GameService {
  constructor(private gameRepository: GameRepository) { }

  //1p 2p 소켓 id 를 인자로 받음
  async createGame(isOwnerUsername: string, guestUsername: string) {
    const user1 = await User.findOne({ where: { username: isOwnerUsername } });
    const user2 = await User.findOne({ where: { username: guestUsername } });
    if (!user1 || !user2) {
      console.log('왜 실패?');
      return;
    }
    else {
      console.log(user1.username);
      console.log(user2.username);
    }
    const game = await this.gameRepository.createGame(user1, user2);
    return game;
  }

  async finishGame(winner: User, loser: User) {
    const isBegginer = await this.gameRepository.isBegginer(winner);
    if (isBegginer) {
      await this.gameRepository.createAchievement(winner, 'beginner');
    }
    await this.gameRepository.finishGame(winner, loser);
  }
}
