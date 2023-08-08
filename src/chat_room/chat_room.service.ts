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

    async createChatRoom(userid : number, roomName : string, status: number, password : string, limitUser : number)
    {
        const query = `insert into "chat_room"(owner_id, room_stat, password, limit_user, index) values (${userid}, ${status}, '${password}', ${limitUser}, '${roomName}');`;
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

    async joinUserToRoom(userid : number, roomName : string, is_admin : boolean)
    {
        ///예외처리 붙어야 함.
        console.log("in join UserToROOM");
        const query = `insert into "chat_user"("index","user_id","is_admin") values('${roomName}', '${userid}' , ${is_admin})`;
        await this.chatRoomRepository.query(query);
    }

    async leaveUserFromRoom(userid : number, roomName : string)
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

    async saveMessage(roomName : string, userid : number, message : string)
    {
        const query = `insert into "chat_room_msg"("index", "user_id", "msg", "time") values('${roomName}',${userid},'${message}', now());`;
        await this.chatRoomRepository.query(query);
    }

    async getDmMessage(roomName : string) //객체들의 배열로 갈것! 시간 순 정렬한 값이므로, 프론트는 그대로 보여주면 됌.
    {
        const query = `select "user"."username", "A"."msg" from (select msg,user_id,time from "chat_room_msg" where "index"='${roomName}') as "A" left join "user" on ("A"."user_id" = "user"."id") order by "A"."time" asc;`;
        return await this.chatRoomRepository.query(query);
    }

    async getRoomList() ///ban이어도 상관없이 보이기는 할 예정
    {
        const query = `select "index" from "chat_room";`;
        return await this.chatRoomRepository.query(query);
        //string 배열로 재가공하고 던져줄 예정
    }

    async isBanedUser(userId : number, roomName : string)
    {
        const query = `select * from "chat_ban" where "index" = '${roomName}' and "ban_user_id" = ${userId};`;
        const ret = await this.chatRoomRepository.query(query);
        if (ret.length === 0)
            return false;
        return true;
        //select * from "chat_ban" where "index" = '${roomName}' and "ban_user_id" = ${userId};
    }

    async isEmptyRoom(roomName : string)
    {
        const query = `select "curr_user" from "chat_room" where "index" = '${roomName}'`;
        const ret = await this.chatRoomRepository.query(query);
        if (ret[0].curr_user === 0)
            return true;
        return false;
    }

    async deleteChatInformation(roomName : string)
    {
        //baned,user,room,block -> 관련 모두 삭제
        await this.deleteChatUserRoom(roomName);
        await this.deleteBanUserChatRoom(roomName);
        await this.deleteBlockChatRoom(roomName);
        await this.deleteChatRoom(roomName);
    }

    async deleteChatUserRoom(roomName : string)
    {
        const query = `delete from "chat_user" where "index" = '${roomName}';`;
        await this.chatRoomRepository.query(query);
    }

    async deleteBanUserChatRoom(roomName : string)
    {
        const query = `delete from "chat_ban" where "index" = '${roomName}';`;
        await this.chatRoomRepository.query(query);
    }
    
    async deleteBlockChatRoom(roomName : string)
    {
        const query = `delete from "chat_block" where "index" = '${roomName}';`;
        await this.chatRoomRepository.query(query);
    }
    
    async deleteChatRoom(roomName : string)
    {
        const query = `delete from "chat_room" where "index" = '${roomName}';`;
        await this.chatRoomRepository.query(query);
    }
    /*
    ///////////////////////채팅방 정보 Scope!///////////////////////
    async getUserListInChatRoom(requestUser : username or id, roomName : string) chat_user를 다 가져오면 될것.
    {
        1. admin과 chat_user가 합쳐졌다고 가정한 쿼리 (right - 0,1,2 -> 0 == owner, 1 == admin, 2 == 일반유저 이런 식의 약속 필요하긴함)
        select * from "chat_user" where "index" = '${roomName}';
    }

    Front에 위의 함수 getUserListInChatRoom에서 받은 것에서 자신의 아이디를 비교하는 로직을 하기 싫다면, 이 API를 사용하면 됌.
    async checkReqUserRight(requestUserId : number, roomName : string) admin인지 오너인지 확인해줘야 함. -> admin,owner면 그에 맞는 버튼은 그 뒤의 모달에서 보여줘야 할 것.
    {
        selct right from "chat_user" where "index" = '${roomName}' and "user_id" = ${requestUserId};
        return ~~~
    }

    async isPasswordRoom(roomName : string)
    {
        const query = select password from "chat_room" where "index" = '${roomName}';
        const ret = await ~~;
        if (ret.length === 0)
        {
            return false;
        }
        return true;
    }
    ///////////////////////채팅방 정보 Scope!///////////////////////
    */
} 
