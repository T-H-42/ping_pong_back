import { Injectable } from '@nestjs/common';
import { ChatRoomRepository } from './chat_room.repository';

@Injectable()
export class ChatRoomService {
    constructor(private chatRoomRepository : ChatRoomRepository){}
    
    async createDmRoom(userid : number, roomName : string)
    {
        const query = `insert into "chat_room"(owner_id, room_stat, password, limit_user, curr_user, index) values (${userid}, 3, null, 2, 1, '${roomName}');`;
        await this.chatRoomRepository.query(query);
    }

    async isExistRoom(roomName : string)
    {
        const query = `select * from "chat_room" where "index" = '${roomName}';`; ///
        const queryList = await this.chatRoomRepository.query(query);
        if (queryList.length === 0)
            return false;
        return true;
    }

    async dmListByUserName(userid: number)
    {

        console.log("in dmlist API");
        const query = `select "user"."username", "C"."index" from (select "chat_user"."user_id", "chat_user"."index" from (select "A"."index" from (select "index" from "chat_user" where "user_id"=${userid}) as "A" left join "chat_room" on ("chat_room"."index" = "A"."index" and "chat_room"."room_stat" = 3)) as "B" left join "chat_user" on ("B"."index" = "chat_user"."index" and "chat_user"."user_id" != ${userid})) as "C" left join "user" on ("user"."id" = "C"."user_id");`;
        return await this.chatRoomRepository.query(query);
    }

    async joinUserToRoom(userid : number, roomName : string)
    {
        ///예외처리 붙어야 함.
        console.log("in join UserToROOM");
        const query = `insert into "chat_user"("index","user_id") values('${roomName}', '${userid}')`;
        await this.chatRoomRepository.query(query);
    }

    async leaveUserToRoom(userid : number, roomName : string)
    {
        console.log("in leave User in ROOM");
        const query = `delete from "chat_user" where "user_id"=${userid} and "index"='${roomName}';`;
        await this.chatRoomRepository.query(query);
    }
    
    async isNeedDmNoti(userid : number, roomName : string)
    {
        const query = `select user_id from "chat_user" where "user_id"=${userid} and "index" = '${roomName}';`;
        const ret = await this.chatRoomRepository.query(query);
        console.log("======= isNeedDmNoti? =======");
        console.log(ret);
        console.log("======= isNeedDmNoti? =======");

        if (ret.length !== 2)
            return true;
        return false;
    }
    async isUserInRoom(userid : number, roomName : string)
    {
        const query = `select * from "chat_user" where ("index" = '${roomName}' and "user_id" = ${userid});`; ///
        const queryList = await this.chatRoomRepository.query(query);
        if (queryList.length === 0)
            return false;
        return true;
    }
} 
