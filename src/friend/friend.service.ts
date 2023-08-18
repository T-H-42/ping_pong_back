import { Injectable, Post } from '@nestjs/common';
import { User } from 'src/entity/user.entity';
import { FriendRepository } from 'src/friend/friend.repository';

@Injectable()
export class FriendService {
  constructor (private friendRepository:FriendRepository) {}

  async acceptFriend(payloadID: number, dataID: number) {
    const query = `update "friend" set "accecpt" = 'true' where "sendIdId" = ${payloadID} and "recvIdId" = ${dataID};`
    await this.friendRepository.query(query);
    //update "friend" set "accecpt" = 'true' where "sendIdId" = ${payload.id} and "recvIdId" = ${data.id};
  }
  
  //유저네임 받아서 유저 객체 리턴해주는
  async addFriend( my_id: number , friend_id:number){
    const query = `insert into "friend"("sendIdId", "recvIdId", accecpt) values (${my_id}, ${friend_id}, 'false')`;
    // const result = await this.userRepository.query(query);
    const result = await this.friendRepository.query(query);
  }
  /////////////
  async findFriendList(user: User): Promise<User[]> {
    const query = `select * from (select case when ${user.id} = "friend"."sendIdId" then "friend"."recvIdId" else "friend"."sendIdId" end as f_id from "friend"
    where (${user.id} = "friend"."sendIdId" and "friend"."accecpt" = true) or (${user.id} = "friend"."recvIdId" and "friend"."accecpt" = true)) as "F" left join "user" on "user"."id" = "F"."f_id";`

    const result = await this.friendRepository.query(query);
    return result;
    }
    async getFriendSocket(username: string): Promise<string[]> {
    // const user = await this.friendRepository.findOne({
    //   where: {
    //  username
    //   }})
    const user = await this.friendRepository.query(`select * from "user" where username='${username}'`);
    if (!user)
    {
      console.log("???????????????????????????????????????");
      console.log("???????????????????????????????????????");
    }
    const friend_list = await this.findFriendList(user[0]);
  
    const friendSocketList:string[] = [];
    friend_list.map((friend) => {
      // console.log(friend);
      if (friend.socketid !== null) {
      friendSocketList.push(friend.socketid);
      }
    });
    // console.log(friendSocketList);
    return friendSocketList;
    }

    async getFriendChatSocket(username: string): Promise<string[]> {
      // const user = await this.friendRepository.findOne({
      //   where: {
      //  username
      //   }})
      const user = await this.friendRepository.query(`select * from "user" where username='${username}'`);
      if (!user)
      {
        console.log("???????????????????????????????????????");
        console.log("???????????????????????????????????????");
      }
      const friend_list = await this.findFriendList(user[0]);
    
      const friendSocketList:string[] = [];
      friend_list.map((friend) => {
        // console.log(friend);
        if (friend.chat_sockid !== null) {
        friendSocketList.push(friend.chat_sockid);
        }
      });
      // console.log(friendSocketList);
      return friendSocketList;
      }

    async isFriend(userId: number,targetUserId: number)
    {
      if (userId === targetUserId)
        return true;
      const query1 = `select * from "friend" where "accecpt"=true and "sendIdId"=${userId} and "recvIdId"=${targetUserId};`;
      const ret1 = await this.friendRepository.query(query1);

      const query2 = `select * from "friend" where "accecpt"=true and "sendIdId"=${targetUserId} and "recvIdId"=${userId};`;
      const ret2 = await this.friendRepository.query(query2);
      if (ret1.length === 0 && ret2.length ===0)
        return false;
      return true;
    }
    async accecptFriend(recv: number,send: number)
    {
      const query = `update "friend" set "accecpt"=true where "sendIdId" = ${send} and "recvIdId" = ${recv};`;
      await this.friendRepository.query(query);
    }
}