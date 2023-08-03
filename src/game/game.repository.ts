import { Inject, Injectable } from "@nestjs/common";
import { Game } from "src/entity/game.entity";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class GameRepository extends Repository<Game> {
	constructor ( private dataSource: DataSource) {
		super(Game, dataSource.createEntityManager());
	}
}