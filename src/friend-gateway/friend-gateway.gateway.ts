import { Logger } from '@nestjs/common';
import { ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace, Server, Socket } from 'socket.io';
import * as config from 'config';
import * as jwt from 'jsonwebtoken';
import { UserService } from 'src/user/user.service';

@WebSocketGateway({
  namespace: 'friend', //ping_pong
  cors: {
    origin: ['http://localhost:3000'], //
  },
})
export class FriendGatewayGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private userService: UserService
  ) { }

  private logger = new Logger('Gateway');
  @WebSocketServer()
  nsp: Namespace;

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.nsp.adapter.on('create-room', (room) => {
      this.logger.log(`"Room:${room}"이 생성되었습니다.`);
    })

    this.nsp.adapter.on('join-room', (room, id) => { //id로 접근 가능해보임
      this.logger.log(`"Socket:${id}"이 "Room:${room}"에 참여하였습니다.`);
    })


    this.nsp.adapter.on('leave-room', (room, id) => {
      this.logger.log(`"Socket:${id}"이 "Room:${room}"에서 나갔습니다.`);
    })

    this.nsp.adapter.on('delete-room', (roomName) => {
      this.logger.log(`"Room:${roomName}"이 삭제되었습니다.`);
    })

    this.logger.log('웹소켓 서버 초기화 ✅');
  }

  async handleConnection(@ConnectedSocket() socket: Socket) {
    const token = socket.handshake.auth.token; //진입시점의 token을 받아옴
    this.logger.log(token);
    const serverConfig = config.get('jwt');
    const secret = serverConfig.secret;
    try {
      const payload = await jwt.verify(token, secret) as any; //token의 해석된 객체? = payload
      ///db애서 payload.username을 찾아 socketid에 매핑
      await this.userService.connectSocket(payload.username, socket.id); //Maping해주는 것.

      //broeacast.emit을 to emit으로 대체한다.
      //connect
      const socketList = await this.userService.getFriendSocket(payload.username);
      if (socketList === [] as string[]) {
        return ;
      }
      //const socketList = await friendsocketlist.map(user => user.socketid);
      this.logger.log(`friendList = ${socketList}`);
      console.log(`Connect emit`);
      socket.to(socketList).emit('username', {
        status: `${payload.username}`,
      });

      // socket.broadcast.emit('connection', {
      //   connect: `${payload.username}`
      // });
    }
    catch (error) { //token 해석 혹은 connectSocketErr
      this.logger.error('validate_token OR connectSocketErr fail:', error);
    }
  }
// ()  {}  !  []  =>
  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    const token = socket.handshake.auth.token; //진입시점의 token을 받아옴
    const serverConfig = config.get('jwt');
    const secret = serverConfig.secret;
    try {
      const payload = await jwt.verify(token, secret) as any; //token의 해석된 객체? = payload
      await this.userService.disConnectSocket(payload.username);
      const socketList = await this.userService.getFriendSocket(payload.username);
      if (socketList === [] as string[]) {
        this.logger.log('왜 나옴?');
        return ;
      }
      //const socketList = await friendsocketlist.map(user => user.user_socketid);
      console.log(`DisConnect emit`);
      socket.to(socketList).emit('logout', {
        status: `${payload.username}`
      });
      // socket.broadcast.emit('disconnect', {
      //   disconnect: `${payload.username}가 나감.`,
      // });
    }
    catch (error) {
      this.logger.error('validate_token OR disConnectSocketErr fail:', error);
    }

    // this.logger.log(`${socket.id} 소켓 연결 해제 ❌`);
    // socket.broadcast.emit('friend', {
    //  friend: true
    // })
  }

  // 친구요청 {
   @SubscribeMessage('friendadd')
  friendAdd(socket: Socket, friendname) { // -> friendname 프론트 로컬에 가지고 있을테니, 요청에 대한
  // 약속만 정하고, 이대로 진행하면 될 듯.
  //  ~~~
  // payload.username
  //  대상
  }



  @SubscribeMessage('message')
  handleMessage(client: any, payload: any): string {
    return 'Hello world!';
  }



}