import { Logger, UnauthorizedException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import * as config from 'config';
import { UserService } from 'src/user/user.service';
import * as jwt from 'jsonwebtoken';
import { FriendService } from 'src/friend/friend.service';

@WebSocketGateway({
  namespace: 'ping_pong',
  cors: {
    origin: ['http://10.15.1.4:3000'],
  },
})
export class PingPongGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private userService: UserService,
    private friendService: FriendService,
  ) {}

  private logger = new Logger('Gateway');
  afterInit(/* server: any */) {
    // this.nsp.adapter.on('create-room',(room)=> {
    //   this.logger.log("room 생성");
    // })
  }
  async handleConnection(@ConnectedSocket() socket: Socket) {
    this.logger.log('ping-pong 채널 connect 호출: ', socket.id);
    try {
      this.logger.log('====ping_nsp_입장====');
      const payload = await this.getPayload(socket);
      console.log(payload);
      await this.userService.connectPingPongSocket(payload.username, socket.id);
      const socketList = await this.friendService.getFriendSocket(
        payload.username,
      );
      if (socketList.length === 0) {
        return {checktoken: true};
      }
      socket.to(socketList).emit('ft_connect', {
        status: `${payload.username}`,
        checktoken: true,
      });
    } catch (error) {
      console.log('in ping_pong channel');
      this.logger.error('1. validate_token fail in ping', error);
      return { checktoken: false };
    }
    // const token = socket.handshake.auth.token;
  }
  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    this.logger.log('ping-pong 채널 Disconnect 호출');
    try {
      const payload = await this.getPayload(socket);
      await this.userService.disconnectPingPongSocket(payload.username);
      const socketList = await this.friendService.getFriendSocket(
        payload.username,
      );
      if (socketList.length === 0) {
        console.log('-=-=-=-=-=-=-=-=-=-=-=-=-==-=');
        return;
      }
      //const socketList = await friendsocketlist.socketid.map(user => user.user_socketid);
      // console.log("-----me?: ", payload.username);
      // console.log("====in disconnect====");
      // console.log(socketList);
      socket.to(socketList).emit('ft_disconnect', {
        status: `${payload.username}`,
      });
    } catch (error) {
      this.logger.error('validate_token fail', error);
      return { checktoken: false };
    }
  }

  // @SubscribeMessage('ft_invite_friend') //front에서 친구추가 버튼 눌르면 발생시키는 이벤트
  // async inviteFriend(
  //   @ConnectedSocket() socket: Socket,
  //   @MessageBody() data: any,
  // ) {
  //   //친구추가는 채팅방에서 이루어지므로, 그때 채채팅팅방방의 userlist를 어차피 가지고 있을 텐데 반드시 그때 id를 준다. => data에는 무조건 id가 있다.
  //   let payload;
  //   try {
  //     // const payload = await this.getPayload(socket);
  //     payload = await this.getPayload(socket);
  //   } catch (error) {
  //     return {checktoken: false};
  //   }
  //   //DB에 저장
  //   await this.friendService.addFriend(payload.id, data.id); //payload -> 나, data -> 대상(미래의 친구)
  //   //query =
  //   const friendSocket = await this.userService.getUserByPingPongSocketId(
  //     data.id,
  //   );
  //   `select "socketid" from "user" where data.id = id;`;
  //   socket.to(friendSocket.socketid).emit('ft_invited', {
  //     //이값을 프론트에서 저장하고 있어야 함. (화면)
  //     username: payload.username,
  //     id: payload.id,
  //     checktoken: true,
  //   });
  // }
  //invite -> invited ()
  //front

  // @SubscribeMessage('ft_accecpt_friend') //front에서 친구추가를 수락한 친구가 보내는 이벤트
  // async accecptFriend(
  //   @ConnectedSocket() socket: Socket,
  //   @MessageBody() data: any, //반드시 친구추가를 보낸 사람의 id가 data에 포함되어서 와야함.
  // ) {
  //   const payload = await this.getPayload(socket);
  //   await this.friendService.acceptFriend(payload.id, data.id);
  //   // payload -> 친추를 수락한 사람, data.id -> 친추를 보낸 사람
  // }

  // const result = await this.
  //=${payload.id} =${data.id}
  // const query = `select * from (select case when ${user.id} = "friend"."sendIdId" then "friend"."recvIdId" else "friend"."sendIdId" end as f_id from "friend" where (${user.id} = "friend"."sendIdId" and "friend"."accecpt" = true) or (${user.id} = "friend"."recvIdId" and "friend"."accecpt" = true)) as "F" left join "user" on "user"."id" = "F"."f_id";`
  // const result = await this.userRepository.query(query);

  async getPayload(socket: Socket) {
    const token = await socket.handshake.auth.token;
    this.logger.log('======ping token in get payload=======');
    this.logger.log(token);
    this.logger.log('======ping token in get payload=======');
    const serverConfig = config.get('jwt');
    const secret = serverConfig.secret;
    return (await jwt.verify(token, secret)) as any;
  }
  // return await jwt.verify(token, secret) as any;
  // @SubscribeMessage('message')
  // handleMessage(client: any, payload: any): string {
  //   return 'Hello world!';
  // }

  ///////////////////////////친구 요청/////////////////////////
  /*
  
  */
}
