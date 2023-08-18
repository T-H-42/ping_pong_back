import { Injectable } from '@nestjs/common';
import { ChatRoomRepository } from './chat_room.repository';
import * as bcrypy from 'bcrypt';

@Injectable()
export class ChatRoomService {
    constructor(
        private chatRoomRepository : ChatRoomRepository,
        ){}
    
    async createDmRoom(userid : number, roomName : string)
    {
        const query = `insert into "chat_room"(owner_id, room_stat, password, limit_user, curr_user, index) values (${userid}, 3, null, 2, 1, '${roomName}');`;
        await this.chatRoomRepository.query(query);
    }

    async createChatRoom(userid : number, roomName : string, status: number, password : string, limitUser : number)
    {
        console.log("========");
        console.log(userid);
        console.log(userid, roomName, status, password, limitUser);
        const query = `insert into "chat_room"(owner_id, room_stat, password, limit_user, index, curr_user) values (${userid}, ${status}, '${password}', ${limitUser}, '${roomName}', 0);`;
        await this.chatRoomRepository.query(query);
    }

    async validateSpaceInRoom(roomName : string)
    {
        const query = `select * from "chat_room" where "curr_user" < "limit_user" and "index" = '${roomName}'`;
        const ret = await this.chatRoomRepository.query(query);

        if (ret.length === 0)
            return false;
        return true;
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

    async joinUserToRoom(userid : number, roomName : string, right : number)
    {
        ///예외처리 붙어야 함.
        console.log("in join UserToROOM");
        const query = `insert into "chat_user"("index","user_id","right") values('${roomName}', '${userid}' , ${right});
        update "chat_room" set "curr_user" = "curr_user"+1 where "index" = '${roomName}'`;
        await this.chatRoomRepository.query(query);
    }

    async leaveUserFromRoom(userid : number, roomName : string)
    {
        console.log("in leave User in ROOM");
        const query = `delete from "chat_user" where "user_id"=${userid} and "index"='${roomName}'; 
        update "chat_room" set "curr_user" = "curr_user"-1 where "index" = '${roomName}'`;
        
        const query2 = `select * from "chat_room" where "index" = '${roomName}';`;
        const chatroom = await this.chatRoomRepository.query(query2);
        if (chatroom[0].curr_user === 0)
            return ;
        await this.chatRoomRepository.query(query);
    }
    
    async isNeedDmNoti(userid : number, roomName : string)
    {
        const query = `select user_id from "chat_user" where "user_id"=${userid} and "index" = '${roomName}';`;
        const ret = await this.chatRoomRepository.query(query);
        console.log("======= isNeedDmNoti? =======");
        console.log(ret);
        console.log("======= isNeedDmNoti? =======");

        if (ret.length !== 2) //2
            return true;
        return false;
    }
    async isUserInRoom(userid : number, roomName : string)
    {
        if (roomName === null)
            return false;
        const query = `select * from "chat_user" where ("index" = '${roomName}' and "user_id" = ${userid});`; ///
        const queryList = await this.chatRoomRepository.query(query);
        if (queryList.length === 0)
            return false;
        return true;
    }

    async saveMessage(roomName : string, userid : number, message : string)
    {
        const query = `insert into "chat_room_msg"("index", "user_id", "message", "time") values('${roomName}',${userid},'${message}', now());`;
        await this.chatRoomRepository.query(query);
    }

    async getDmMessage(roomName : string) //객체들의 배열로 갈것! 시간 순 정렬한 값이므로, 프론트는 그대로 보여주면 됌.
    {
        const query = `select "user"."username", "A"."message" from (select message,user_id,time from "chat_room_msg" where "index"='${roomName}') as "A" left join "user" on ("A"."user_id" = "user"."id") order by "A"."time" asc;`;
        return await this.chatRoomRepository.query(query);
    }

    async getChatMessage(userId : number, roomName : string) //객체들의 배열로 갈것! 시간 순 정렬한 값이므로, 프론트는 그대로 보여주면 됌. //내가 블록한 사람 빼고!
    {           
        //select "user_id" from "chat_user" where ("user_id" not in (select "blocked_user_id" from "chat_block" where index = 'hyna,nhwang' and "user_id" = 10) and "chat_user"."user_id"!=10 and index = 'hyna,nhwang');
        //as "A"
        console.log("==========================================");
        console.log("in getChatMessage : ", userId, roomName);
        console.log("==========================================");


        //select "message", "time", "chat_room_msg"."user_id" from (select "user_id" from "chat_user" where ("user_id" not in (select "blocked_user_id" from "chat_block" where index = 'hyna,nhwang' and "user_id" = 10) and "chat_user"."user_id"!=10 and index = 'hyna,nhwang')) as "A" left join "chat_room_msg" on "chat_room_msg"."user_id" = "A"."user_id" where "index" = 'hyna,nhwang'; ->>>
        //ㄴ> 차단안한 유저의 아이디와 메시지, time as "B"


        //select "user"."username", "B"."message" from (select "message", "time", "chat_room_msg"."user_id" from (select "user_id" from "chat_user" where ("user_id" not in (select "blocked_user_id" from "chat_block" where index = 'hyna,nhwang' and "user_id" = 10) and "chat_user"."user_id"!=10 and index = 'hyna,nhwang')) as "A" left join "chat_room_msg" on "chat_room_msg"."user_id" = "A"."user_id" where "index" = 'hyna,nhwang') as "B" left join "user" on "user"."id" = "B"."user_id" order by "B"."time" asc;

        
        // const query = `select "user"."username", "B"."message" from (select "message", "time", "chat_room_msg"."user_id" from (select "user_id" from "chat_user" where ("user_id" not in (select "blocked_user_id" from "chat_block" where index = '${roomName}' and "user_id" = ${userId}) and "chat_user"."user_id"!=${userId} and index = '${roomName}')) as "A" left join "chat_room_msg" on "chat_room_msg"."user_id" = "A"."user_id" where "index" = '${roomName}') as "B" left join "user" on "user"."id" = "B"."user_id" order by "B"."time" asc;`;
        const query = `select "user"."username", "B"."message" from (select "message", "time", "chat_room_msg"."user_id" from (select "user_id" from "chat_user" where ("user_id" not in (select "blocked_user_id" from "chat_block" where index = '${roomName}' and "user_id" = ${userId}) and index = '${roomName}')) as "A" left join "chat_room_msg" on "chat_room_msg"."user_id" = "A"."user_id" where "index" = '${roomName}') as "B" left join "user" on "user"."id" = "B"."user_id" order by "B"."time" asc;`;
        
        return await this.chatRoomRepository.query(query);
    }

    async getRoomList() ///ban이어도 상관없이 보이기는 할 예정
    {
        const query = `select "index","room_stat","limit_user" from "chat_room" where "room_stat" = 0 or "room_stat" = 1;`; //비공개방 안보여줄것임
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
        if (roomName === undefined)
            return true;
        const query = `select "curr_user" from "chat_room" where "index" = '${roomName}' and "curr_user" > 0;`;
        const ret = await this.chatRoomRepository.query(query);
        console.log("======af query=======");
        if (ret.length=== 0)
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
        const dmCheck = await this.isDm(roomName); //not으로!
        console.log("------------dm check------------");
        console.log(dmCheck);
        console.log("------------dm check------------");
        if (dmCheck.length===0) //dm이 아닌 경우
        {
            console.log("------------dm check scope!!!!?????------------");
            await this.deleteChatLog(roomName);
        }
        ///dm이 아닐 경우! message delete!
    }

    async deleteChatLog(roomName : string)
    {
        const query = `delete from "chat_room_msg" where "index" = '${roomName}';`;
        await this.chatRoomRepository.query(query);
    }

    async isDm(roomName : string)
    {
        const query = `select "index" from "chat_room" where "room_stat"=3 and "index" = '${roomName}';`;
        return (await this.chatRoomRepository.query(query));
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
    ///////////////////////채팅방 정보 Scope!///////////////////////
    
    
    async getUserListInChatRoom(roomName : string)//chat_user를 다 가져오면 될것. ///del requestUserName : string,
    {
        // 1. admin과 chat_user가 합쳐졌다고 가정한 쿼리 (right - 0,1,2 -> 0 == just, 1 == admin, 2 == Owner 이런 식의 약속 필요하긴함)
        // const query = `select * from "chat_user" where "index" = '${roomName}';`;
        const query = `select "user"."username", "A"."right" from (select * from "chat_user" where "index" = '${roomName}') as "A" left join "user" on "user"."id" = "A"."user_id";`;
        return await this.chatRoomRepository.query(query);

        // select * from "chat_user" where "index" = '${roomName}';
        // ㄴ> as "A"
        // select "user"."username", "A"."right" from (select * from "chat_user" where "index" = '123') as "A" left join "user" on "user"."id" = "A"."user_id";
        
    }

    async findWhoBlockedMe(userId :number, roomName : string)
    {
        //select "user_id" from "chat_block" where index = 'hyna,nhwang' and "blocked_user_id" = 10;
        //ㄴ> 날 블록한 유저 id -> as A
        // select "user"."socketid" from (select "user_id" from "chat_block" where index = 'hyna,nhwang' and "blocked_user_id" = 10) as "A" left join "user" on "user"."id" = "A"."user_id";
        const query = `select "user"."chat_sockid" from (select "user_id" from "chat_block" where index = '${roomName}' and "blocked_user_id" = ${userId}) as "A" left join "user" on "user"."id" = "A"."user_id";`;
        const ret = await this.chatRoomRepository.query(query);
        let _return = [];
        ret.map((i) => {
            if (i.chat_sockid !== null)
                _return.push(i.chat_sockid);//socketid
        });

        return _return;
    }
    
    async isValidPassword(roomName:string, password : string)
    {
        // const q = `select * from "chat_room" where index='${roomName}';`;
        // const check =  await this.chatRoomRepository.query(q);
        // if (check.length === 0)
        //     return false;
        const query = `select "password" from "chat_room" where index='${roomName}';`;
        const obj = await this.chatRoomRepository.query(query);
        if (await bcrypy.compare(password, obj[0].password))
            return true;
        return false;
        // if (obj[0].password === password) ///복호화 할 필요가 없음!
        //     return true;
        // return false;
    }


    async isMuted(roomName : string, userId : number){
        //상황에 따라 이벤트 쏠수 있도록? -> ft_message에서 처리하는 방식이라면 여기서 로직 추가
        
        const query = `select "mute_end_time" from "chat_user" where "index" = '${roomName}' and "user_id" = ${userId} and "mute_end_time"::timestamp > NOW();`;
        const obj = await this.chatRoomRepository.query(query);
        if (obj.length===0)
            return false;
        return true;
    }

    async checkRight(roomName : string, targetUserId : number)
    {
        const query = `select "right" from "chat_user" where "index" = '${roomName}' and  "user_id"=${targetUserId};`;
        const obj = await this.chatRoomRepository.query(query);
        return (obj[0].right);
    }
    async setAdmin(roomName : string, targetUserId :number)
    {
        const query = `update "chat_user" set "right" = 1 where "index" = '${roomName}' and "user_id" = ${targetUserId}`;
        await this.chatRoomRepository.query(query);
    }

    async getUserRight(userId : number,roomName : string)
    {
        const query = `select "right" from "chat_user" where "index"='${roomName}' and "user_id" = ${userId}`;
        const ret = await this.chatRoomRepository.query(query);
        return (ret[0].right);
    }

    async hashPassword(password : string)
    {
        const salt = await bcrypy.genSalt();
        const hashedPassword = await bcrypy.hash(password, salt);
        return hashedPassword;
    }


    async setBlock(roomName : string, targetUserId : number, userId : number)
    {
        const isAlreadyBlocked = await this.chatRoomRepository.query(`select * from "chat_block" where "user_id" = ${userId} and "index"='${roomName}' and "blocked_user_id"=${targetUserId};`);
        if (isAlreadyBlocked.length !== 0 )//이미 block인 경우
            return false;
        const query = `insert into "chat_block"("user_id","blocked_user_id","index") values(${userId}, ${targetUserId}, '${roomName}');`;
        await this.chatRoomRepository.query(query);
        return true;
    }

    async setBan(roomName : string, targetUserId : number)
    {
        const isAlreadyBaned = await this.chatRoomRepository.query(`select * from "chat_ban" where "ban_user_id" = ${targetUserId} and "index"='${roomName}';`);
        if (isAlreadyBaned.length !== 0 )//이미 block인 경우
            return false;
        const query = `insert into "chat_ban"("ban_user_id","index") values(${targetUserId}, '${roomName}');`;
        await this.chatRoomRepository.query(query);
        return true;
    }

    async setMute(roomName : string, targetUserId: number)
    {
        if (await this.isMuted(roomName,targetUserId)===true)
            return false;
        // const query = `update "chat_user" set "mute_end_time" = "NOW()+" , ;`;
        const query = `update "chat_user" set "mute_end_time" = NOW()+(1 || 'minutes')::interval where "user_id" = ${targetUserId}`; //10분 증가해서 저장!
        await this.chatRoomRepository.query(query);
        //https://stackoverflow.com/questions/21745125/add-minutes-to-current-timestamp-in-postgresql
        
    }

    async checkMuteUnlock(roomName : string)
    {
        //해제된 녀석들의 chatSocket 던져주기
        /*
        select * from "chat_user" where "index" = '${roomName}' and NOW() > "mute_end_time"::timestamp;
        ㄴ-> as "A"

        
        `select "user"."username", "user"."chat_sockid" from (select * from "chat_user" where "index" = '${roomName}' and NOW() > "mute_end_time"::timestamp) as "A" left join "user" on "A"."user_id" = "user"."id";`;
        */

        const query = `select "user"."username", "user"."chat_sockid" from (select * from "chat_user" where "index" = '${roomName}' and NOW() > "mute_end_time"::timestamp) as "A" left join "user" on "A"."user_id" = "user"."id";`;
        const ret = await this.chatRoomRepository.query(query);
        if (ret.length!==0)
        {
            const query2 = `update "chat_user" set "mute_end_time"=null where  NOW() > "mute_end_time"::timestamp;`;
            await this.chatRoomRepository.query(query2);
        }
        return (ret);
    }
    
    async checkInRoom(targetUserId : number)
    {
        const query = `select * from "chat_user" where "user_id" = ${targetUserId};`;
        const ret = await this.chatRoomRepository.query(query);
        if (ret.length===0)
            return ;
        return ret[0].index;
    }
    
    /*
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
