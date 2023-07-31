import { Injectable } from "@nestjs/common";
import { Chat_Room } from "src/entity/chat_room.entity";
import { DataSource, Repository } from "typeorm";

@Injectable()
export class ChatRoomRepository extends Repository<Chat_Room> {
    constructor (private dataSource:DataSource) {
        super(Chat_Room, dataSource.createEntityManager());
    }
}