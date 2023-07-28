import { Injectable } from "@nestjs/common";
import { Friend } from "src/entity/friend.entity";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class FriendRepository extends Repository<Friend> {
	constructor(private dataSource: DataSource) {
        super(Friend, dataSource.createEntityManager());
    }

    
}