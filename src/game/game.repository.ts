import { Inject, Injectable } from '@nestjs/common';
import { Game } from 'src/entity/game.entity';
import { User } from 'src/entity/user.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class GameRepository extends Repository<Game> {
  constructor(private dataSource: DataSource) {
    super(Game, dataSource.createEntityManager());
  }

  async createGame(user1: User, user2: User) {
    const game = await this.create({
      winner: user1.id,
      loser: user2.id,
      finished: false,
    });
    return game;
  }
}
