import { Injectable } from '@nestjs/common';
import { ChatRoomRepository } from './chat_room.repository';

@Injectable()
export class ChatRoomService {
    constructor(private chatRoomRepository : ChatRoomRepository){}
    
    async createDmRoom(userid : number, roomName : string)
    {
        const query = `insert into "chat_room"(owner_id, room_stat, password, limit_user, curr_user, chat_title) values (${userid}, 3, null, 2, 1, '${roomName}');`;
        await this.chatRoomRepository.query(query);
    }

    async isExist(roomName : string)
    {
        const query = `select * from "chat_room" where "chat_title" = '${roomName}';`;
        const queryList = await this.chatRoomRepository.query(query);
        if (queryList.length === 0)
            return false;
        console.log("-----exist-----");
        console.log(queryList)
        console.log(queryList.length)
        console.log("-----exist-----");
        return true;
    }

    async dmListByUserName(userid: number)
    {

        console.log("in dmlist API");
        const query = `select "chat_room"."chat_title" from (select "chat_title" from "chat_user" where "user_id"=${userid}) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3);`;
        return await this.chatRoomRepository.query(query);

        // const query = `select "chat_title" from "chat_room" where "user_id"=${userid};`;
        /*
        `select "chat_title" from "chat_room" where "user_id"=${userid};`; -> 내가 포함된 모든 chat_title;
        left join chat_room on chat_title끼리 같은 경우면서, room_status=3
        ========================================================
        select "chat_title" from (select "chat_title" from "chat_room" where "user_id"=${userid}) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3);
        
        ========================================================
        select "chat_room"."chat_title" from (select "chat_title" from "chat_user" where "user_id"=10) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3);
        
        //////insert into "chat_room"(owner_id, room_stat, password, limit_user, curr_user, chat_title, chat_id) values();
        */
    }

    async joinUserToRoom(userid : number, roomName : string)
    {
        ///예외처리 붙어야 함.
        console.log("in join UserToROOM");
        const query = `insert into "chat_user"("chat_title","user_id") values('${roomName}', '${userid}')`;
        await this.chatRoomRepository.query(query);
    }

    
} 
