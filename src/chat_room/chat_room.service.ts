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
<<<<<<< HEAD
=======
        console.log("-----exist-----");
        console.log(queryList)
        console.log(queryList.length)
        console.log("-----exist-----");
>>>>>>> 59197812b0f73a0ae8d4f5d1d416cdb792be0f1f
        return true;
    }

    async dmListByUserName(userid: number)
    {

        console.log("in dmlist API");
        const query = `select "user"."username", "C"."chat_title" from (select "chat_user"."user_id", "chat_user"."chat_title" from (select "A"."chat_title" from (select "chat_title" from "chat_user" where "user_id"=${userid}) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3)) as "B" left join "chat_user" on ("B"."chat_title" = "chat_user"."chat_title" and "chat_user"."user_id" != ${userid})) as "C" left join "user" on ("user"."id" = "C"."user_id");`;
        return await this.chatRoomRepository.query(query);

        //select * from (select "chat_title" from "chat_user" where "user_id"=${userid}) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title");


        /*
        CHAT_USER
        id | chat_room_id | user_id |   chat_title   
        ----+--------------+---------+----------------
        14 |              |      13 | test1
        15 |              |       6 | test2
        30 |              |      12 | daskim,nhwang
        31 |              |      10 | daskim,nhwang
        32 |              |      12 | daskim,insjang
        33 |              |       8 | daskim,insjang

        CHAT_ROOM
owner_id | room_stat | password | limit_user | curr_user |   chat_title   | chat_id 
----------+-----------+----------+------------+-----------+----------------+---------
       13 |         0 |          |          8 |         1 | test1          |      10
        6 |         0 |          |          8 |         1 | test2          |      11
       12 |         3 |          |          2 |         1 | daskim,nhwang  |      20
       12 |         3 |          |          2 |         1 | daskim,insjang |      21
        
       

        select "A"."chat_title" from (select "chat_title" from "chat_user" where "user_id"=12) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3);
        -> chat_title만 다 가져온 상태 이것과 다시 조인해서 이것과 같으면서 user_id가 자신과 다른 것 선정 -> B라 하자

        select "chat_user"."user_id" from (select "A"."chat_title" from (select "chat_title" from "chat_user" where "user_id"=12) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3)) as "B" left join "chat_user" on ("B"."chat_title" = "chat_user"."chat_title" and "chat_user"."user_id" != 12);
        ㄴ> DM이면서 자신이 아닌 아이디. -> C라 하자

        
        
        select "user"."id", "C"."chat_title" from (subq) as "C" left join "user" on ("user"."id" = "C"."user_id");
        select "chat_user"."user_id", "chat_user"."chat_title" from (select "A"."chat_title" from (select "chat_title" from "chat_user" where "user_id"=12) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3)) as "B" left join "chat_user" on ("B"."chat_title" = "chat_user"."chat_title" and "chat_user"."user_id" != 12);
        ㄴ>C
        

        select "user"."username", "C"."chat_title" from (select "chat_user"."user_id", "chat_user"."chat_title" from (select "A"."chat_title" from (select "chat_title" from "chat_user" where "user_id"=12) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3)) as "B" left join "chat_user" on ("B"."chat_title" = "chat_user"."chat_title" and "chat_user"."user_id" != 12)) as "C" left join "user" on ("user"."id" = "C"."user_id");


        -----------------------
        select "user"."username", "C"."chat_title" from ((select "chat_user"."user_id" from (select "A"."chat_title" from (select "chat_title" from "chat_user" where "user_id"=12) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3)) as "B" left join "chat_user" on ("B"."chat_title" = "chat_user"."chat_title" and "chat_user"."user_id" != 12))) as "C" left join "user" on ("user"."id" = "C"."user_id");
       
        select "user"."username", "C"."chat_title" from (select "chat_user"."user_id", "chat_user"."chat_title" from (select "A"."chat_title" from (select "chat_title" from "chat_user" where "user_id"=12) as "A" left join "chat_room" on ("chat_room"."chat_title" = "A"."chat_title" and "chat_room"."room_stat" = 3)) as "B" left join "chat_user" on ("B"."chat_title" = "chat_user"."chat_title" and "chat_user"."user_id" != 12)) as "C" left join "user" on ("user"."id" = "C"."user_id");
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
