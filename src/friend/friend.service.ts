import { Injectable, Post } from '@nestjs/common';
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
}