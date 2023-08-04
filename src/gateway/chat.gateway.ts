import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import * as config from 'config';
import { UserService } from 'src/user/user.service';
import { Chat_Room } from 'src/entity/chat_room.entity';
import { ChatRoomService } from 'src/chat_room/chat_room.service';
import { Server } from 'http';

interface MessagePayload {
  roomName: string;
  message: string;
  receiver : string;
}


let createdRooms: string[] = [];

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: ['http://10.15.1.4:3000'],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  constructor(
    private userService: UserService,
    private chatRoomService: ChatRoomService,
  ) { }
  private logger = new Logger('Gateway');


  ///모든 이벤트에 우리는 getPayload를 쓴다!

  @WebSocketServer() nsp: Namespace;

  afterInit() {
    this.logger.log('afterInit');
    this.nsp.adapter.on('delete-room', (room) => {
      const deletedRoom = createdRooms.find(
        (createdRoom) => createdRoom === room,
      );
      if (!deletedRoom) return;

      this.nsp.emit('delete-room', deletedRoom); //socket.emit과 다르다. nsp.emit은 내부에서 내부로 돌리는 것인지?
      createdRooms = createdRooms.filter(
        (createdRoom) => createdRoom !== deletedRoom,
      );
    });

    this.logger.log('Websock_server_init');
  }

  ////////////////////////////////////// - channel dis/connection - start //////////////////////////////////////
  async handleConnection(@ConnectedSocket() socket: Socket) {
    try {
      console.log("handle_connn!!! in chat");
      const payload = await this.getPayload(socket);
      // console.log("handle_connn!!! in chat1");
      await this.userService.connectChatSocket(payload.username, socket.id);
      // console.log("handle_connn!!! in chat2");
      this.logger.log(`chat 채널 connect 호출: ${payload.username}  ${socket.id}`);
    }
    catch (error) {
      this.logger.error('1. validate_token fail in chat', error);
    }
  }

  // 채널(네임스페이스) 탈주
  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    this.logger.log('chat 채널 Disconnect 호출');
    try {
      const payload = await this.getPayload(socket);
      await this.userService.disconnectChatSocket(payload.username);
      this.logger.log(`Sock_disconnected ${payload.username} ${socket.id}`);
    }
    catch (error) {
      console.log('get payload err in chatDisconnect');
    }
  }
////////////////////////////////////// - channel dis/connection - end //////////////////////////////////////

  
  // 채팅방(룸)에 메세지 보내기
  @SubscribeMessage('ft_message')
  async handleMessage(  //정상동작으로 만든 뒤, 함수명만 바꿔서 잘 동작하는 지 확인(handleMessage가 예약어인지 확인 필요)
    @ConnectedSocket() socket: Socket,
    @MessageBody() { roomName, message }: MessagePayload,
  ) {
      console.log("======ft_message 이벤트 수신======");
      console.log(message);
      console.log(roomName);
      let payload;
      try {
        payload = await this.getPayload(socket);
        this.logger.log(`msg 전송: ${payload.username} ${socket.id}`);
        console.log("======ft_message 이벤트 수신======");
      } catch (error) { //나중에 throw 로 교체
        console.log("payloaderr in msg");
        return error;
      }
      ////////////////////delete! or add on ft_message
      // console.log("testestestest");
      // const requestUser = await this.userService.getUserByUserName(payload.username); // 유저의 이름으로 유저 id를 가져옴 join, create 등에서 id로 쓰고 싶었기 때문.
      // const userId = requestUser.id;
      // console.log("testestestest");
      // const status = await this.chatRoomService.isNeedDmNoti(userId, roomName);
      // console.log(status);
      ////////////////////delete! or add on ft_message

      await socket.broadcast.to(roomName).emit('ft_message', {
        username: `${payload.username}`,
        message
      });
    
    return { username: payload.username, message };
  }

  // 채팅방(룸) 목록 반환
  @SubscribeMessage('room-list')
  handleRoomList() {
    this.logger.log('채팅방 목록 반환하기 호출');
    return createdRooms;
  }

  // 채팅방(룸) 만들기
  @SubscribeMessage('create-room') //chat_room세팅 및 admin 테이블에 세팅
  async handleCreateRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  ) {
      let payload;
      try {
        payload = await this.getPayload(socket);
        this.logger.log(`채팅방 만들기 호출: ${payload.username} ${socket.id}`);
      } catch(error) {
        console.log('chatroom create 에러');
      }
    // this.logger.log("create-room in!!!!");
      const exist = await createdRooms.find((createdRoom) => createdRoom === roomName);
      if (exist) {
        return { success: false, payload: `${roomName} 방이 이미 존재합니다.` };
      }
    
      console.log('creat room name: ', roomName);
      socket.join(roomName);
      console.log(`${payload.username} ${socket.id}`);
      createdRooms.push(roomName);
      this.nsp.emit('create-room', roomName);
    // socket.emit('create-room', roomName);

      return { success: true, payload: roomName };
  }

  // 채팅방(룸) 들어가기
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  ) {
      
      this.logger.log('채팅방 입장하기 호출: ', socket.id);
      socket.join(roomName);
      let payload;
      try {
        payload = await this.getPayload(socket);
      } catch (error) { //나중에 throw 로 교체
        return error;
      }
      // console.log(payload.username, ' ', socket.id);

      socket.broadcast.to(roomName).emit('ft_message', {
        username: `${payload.username}`,
        message: `님이 ${roomName}에 참가했습니다.`
      });

      return { success: true }; //
  }

  // 채팅방(룸) 탈주
  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  ) {
    this.logger.log('채팅방 퇴장하기 호출');
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) { //나중에 throw 로 교체
      return error;
    }
    socket.leave(roomName);
    socket.broadcast.to(roomName).emit('ft_message', {
      username: `${payload.username}`,
      message: `님이 ${roomName}에서 나갔습니다`
    });
    return { success: true };
  }



////////////////////////////////////// - DM Scope - start //////////////////////////////////////
  @SubscribeMessage('ft_dm_invitation') //DM 버튼 눌눌렸렸을  때  호출!
  async handleInvitationDm(
    @ConnectedSocket() socket: Socket,
    @MessageBody() userName: string,
  ) {
    this.logger.log('dm 입장하기 호출: ', socket.id);
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) { //나중에 throw 로 교체
      return error;
    }
    //////////////dm room 이름 고유값 설정
      let arr= [];
      arr.push(userName);
      arr.push(payload.username);
      arr.sort();
      let roomName = arr.join()
    //////////////dm room 이름 고유값 설정
      const friend_sock= await this.userService.getChatSocketByUserName(userName); // 대상의 socket 가져오기
      let roomUserSocks = [];                                                      // room에 포함된 유저의 소켓을 배열에 담을 것.
      roomUserSocks.push(friend_sock[0].chat_sockid);
      roomUserSocks.push(socket.id);
      let friend_socks = [];
      friend_socks.push(friend_sock[0].chat_sockid);                              // broadcast.to([friend_sock.chat_sockid]) -> 이런식으로 주면 소켓통신이 되지 않는 이슈가 있어 배열에 담아서 리턴!

      const requestUser = await this.userService.getUserByUserName(payload.username); // 유저의 이름으로 유저 id를 가져옴 join, create 등에서 id로 쓰고 싶었기 때문.
      const userId = requestUser.id;

      const responseUser = await this.userService.getUserByUserName(userName);
      const resUserId = responseUser.id;

      const isExist = await this.chatRoomService.isExistRoom(roomName);               // 방이 있는지 DB에 유효성 체크
      if (isExist === true)
      {
        console.log("already exist room!");
        return { username:null, index: null, success: false };
      }
      else
      {
        console.log("make room, join", isExist);
        await this.chatRoomService.createDmRoom(userId, roomName); ////DB에만 넣고 실제 join은 join-dm 이벤트에서!
        
        await this.chatRoomService.joinUserToRoom(userId, roomName);
        await this.chatRoomService.joinUserToRoom(resUserId, roomName); ////DB에만 넣고 실제 join은 join-dm 이벤트에서!
      }
      
      // this.nsp.to(roomUserSocks).emit('create-dm', {
      //   roomname:`${roomName}`,
      //   // username: userName,
      //   sender:`${payload.username}`,
      //   receiver:`${userName}`,
      //   success : true
      // }); //create-dm 이벤트를 통해 프론트에 룸 생성 된 것 표기!

      socket.broadcast.to(friend_socks).emit('ft_dm_invitation', { //emit -> 수신 클라이언트에게!
        username: `${payload.username}`,
        index: `${roomName}`,
        success : true
      }); 
      return { username: `${userName}`, index: `${roomName}`, success : true}; //return -> 발신 클라이언트에게!
  }
  
  // @SubscribeMessage('dm-list')
  // async handleDmList(
  //   @ConnectedSocket() socket: Socket,
  //   ) {
  //   this.logger.log('dm 목록 반환하기 호출');
  //   let payload;
  //   try {
  //     payload = await this.getPayload(socket);
  //   } catch (error) { //나중에 throw 로 교체
  //     return error;
  //   }
  //   const requestUser = await this.userService.getUserByUserName(payload.username); // 마찬가지로 아래 쿼리에서 id 사용을 원해서 사용한 함수.
  //   const userId = requestUser.id;
  //   const tempDmList = await this.chatRoomService.dmListByUserName(userId); 
  //   // let dmList = tempDmList.map(i => i.index);
  //   let dmList = tempDmList.map(i => i); // 쿼리의 변경으로 인해 객체들을 전달하니까(before : 문자열들의 배열을 전달하고 있었음) 이 부분은 필요없이 즉시 tempDmList를 반환하면 될 것 같기도 함.

  
  //   console.log(".====dmlist====");
  //   console.log(dmList);
  //   console.log(".====dmlist====");

  //   return dmList;
  // }

  @SubscribeMessage('join-dm')
  async handleJoinDm(
    @ConnectedSocket() socket: Socket,
    @MessageBody() userName: string,
  ) {
      console.log("join dm");
      let payload;
      try {
        payload = await this.getPayload(socket);
      } catch (error) { //나중에 throw 로 교체
        return { success: false };
      }
      let arr= [];
      arr.push(userName);
      arr.push(payload.username);
      arr.sort();
      let roomName = arr.join()
      const requestUser = await this.userService.getUserByUserName(payload.username); // 유저의 이름으로 유저 id를 가져옴 join, create 등에서 id로 쓰고 싶었기 때문.
      const userId = requestUser.id;
      const isExist = await this.chatRoomService.isExistRoom(roomName);               // 방이 있는지 DB에 유효성 체크
      console.log("========");
      console.log(userId, roomName);
      console.log("========");
      if (isExist !== true)
      {
        await this.chatRoomService.createDmRoom(userId, roomName);
      }
      if (await this.chatRoomService.isUserInRoom(userId, roomName) !== true)
        await this.chatRoomService.joinUserToRoom(userId, roomName); //이미 유저 네임이 있으면 만들지 않음
      socket.join(roomName);
      console.log("========???여기까지???");
      return { success: true, index:roomName};
  }

  @SubscribeMessage('leave-dm') ///DM의 경우에 뒤로가기나, 떠나기 버튼 눌러도 leave-dm을 호출하지는 않는동작이고, "X"를 눌러야만 호출되게끔 한다.
  async handleLeaveDmRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  ) {
    // console.log(this.server.
    this.logger.log('채팅방 퇴장하기 호출');
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) { //나중에 throw 로 교체
      return error;
    }

    const requestUser = await this.userService.getUserByUserName(payload.username); // 유저의 이름으로 유저 id를 가져옴 join, create 등에서 id로 쓰고 싶었기 때문.
    const userId = requestUser.id;
    await this.chatRoomService.leaveUserToRoom(userId, roomName);
    socket.leave(roomName); //DM과 다르게, 상대방 소켓을 찾아내서 leave 시켜야 한다.
    socket.broadcast.to(roomName).emit('ft_message', {
      username: `${payload.username}`,
      message: `님이 ${roomName}에서 나갔습니다`
    });
    return { success: true };
  }


  @SubscribeMessage('ft_dm')
  async handleDmMessage(  //정상동작으로 만든 뒤, 함수명만 바꿔서 잘 동작하는 지 확인(handleMessage가 예약어인지 확인 필요)
    @ConnectedSocket() socket: Socket,
    @MessageBody() { roomName, message, receiver }: MessagePayload,
  ) {
      console.log("======ft_dm 이벤트 수신======");
      // console.log(message);
      // console.log(roomName);
      let payload;
      try {
        payload = await this.getPayload(socket);
        this.logger.log(`msg 전송: ${payload.username} ${socket.id}`);
        // console.log("======ft_dm 이벤트 수신======");
      } catch (error) { //나중에 throw 로 교체
        console.log("payloaderr in msg");
        return error;
      }
      const requestUser = await this.userService.getUserByUserName(payload.username); // 유저의 이름으로 유저 id를 가져옴 join, create 등에서 id로 쓰고 싶었기 때문.
      const userId = requestUser.id;
      const status = await this.chatRoomService.isNeedDmNoti(userId, roomName);
      // ㄴ이거 반환값이 2보다 작으면 무조건 상대에게 가야함.
      if (status === true)
      {
        const friend = await this.userService.getChatSocketByUserName(receiver);
        let friends = [];
        friends.push(friend[0].chat_sockid);
        // roomName, user_id, msg, time으로 저장
        console.log("========???여기까지???2222");
        await this.chatRoomService.saveMessage(roomName, userId, message);
        console.log("========???여기까지???3333");

        await socket.broadcast.to(friends).emit('ft_dm', { //상대방에게 필요함. status에 따라 내가 쏘는 부분도 다름
          username: `${payload.username}`,
          message,
          status,
        });
      }
      else
      {
        await socket.broadcast.to(roomName).emit('ft_dm', { //상대방에게 필요함. status에 따라 내가 쏘는 부분도 다름
            username: `${payload.username}`,
            message,
            status,
          });
      }
    return { username: payload.username, message, status };
  }
////////////////////////////////////// - DM Scope - end //////////////////////////////////////

  async getPayload(socket: Socket) {
    const token = await socket.handshake.auth.token;
    // this.logger.log("======chat token in get payload=======");
    this.logger.log(token);
    // this.logger.log("======chat token in get payload=======");
    const serverConfig = config.get('jwt');
    const secret = serverConfig.secret;
    return await jwt.verify(token, secret) as any;
  }
}