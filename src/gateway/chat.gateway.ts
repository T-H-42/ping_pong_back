import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import * as config from 'config';
import { UserService } from 'src/user/user.service';
import { Chat_Room } from 'src/entity/chat_room.entity';
import { ChatRoomService } from 'src/chat_room/chat_room.service';

interface MessagePayload {
  roomName: string;
  message: string;
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
      this.logger.log(`Sock_disconnected ${payload.username} ${socket.id}`); // ping_pong의 소켓과 다를 것인데데... 관리 어떻게 해줘야 할지 설계필요!
    }
    catch (error) {
      console.log('get payload err');
    }
  }
////////////////////////////////////// - channel dis/connection - end //////////////////////////////////////

  
  // 채팅방(룸)에 메세지 보내기
  @SubscribeMessage('ft_message')
  async handleMessage(  //정상동작으로 만든 뒤, 함수명만 바꿔서 잘 동작하는 지 확인(handleMessage가 예약어인지 확인 필요)
    @ConnectedSocket() socket: Socket,
    @MessageBody() { roomName, message }: MessagePayload,
  ) {
      let payload;
      try {
        payload = await this.getPayload(socket);
        this.logger.log(`msg 전송: ${payload.username} ${socket.id}`);
      } catch (error) { //나중에 throw 로 교체
        console.log("payloaderr in msg");
        return error;
      }

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
  @SubscribeMessage('ft_dm_invitation')
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
      let roomUserSocks = [];                                                      // room에 포함된 유저의 소켓에 전부
      roomUserSocks.push(friend_sock[0].chat_sockid);
      roomUserSocks.push(socket.id);
      let friend_socks = [];
      friend_socks.push(friend_sock[0].chat_sockid);

      const requestUser = await this.userService.getUserByUserName(payload.username);
      const userId = requestUser.id;

      const responseUser = await this.userService.getUserByUserName(userName);
      const resUserId = responseUser.id;

      const isExist = await this.chatRoomService.isExist(roomName);
      if (isExist === true)
      {
        console.log("error!! -> status를 false로 줄 예정!");
        return { username:null, chat_title: null, success: false };
      }
      else
      {
        console.log("in is Exist False??", isExist);
        await this.chatRoomService.createDmRoom(userId, roomName);
        await this.chatRoomService.joinUserToRoom(userId, roomName);
        await this.chatRoomService.joinUserToRoom(resUserId, roomName); ////상대에게 넣어줌
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
        chat_title: `${roomName}`,
        success : true
      }); 
      return { username: `${userName}`, chat_title: `${roomName}`, success : true}; //return -> 발신 클라이언트에게!
  }
  
  @SubscribeMessage('dm-list')
  async handleDmList(
    @ConnectedSocket() socket: Socket,
    ) {
    this.logger.log('dm 목록 반환하기 호출');
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) { //나중에 throw 로 교체
      return error;
    }
    const requestUser = await this.userService.getUserByUserName(payload.username);
    const userId = requestUser.id;
    const tempDmList = await this.chatRoomService.dmListByUserName(userId);
    // let dmList = tempDmList.map(i => i.chat_title);
    let dmList = tempDmList.map(i => i);

  
    console.log(".====dmlist====");
    console.log(dmList);
    console.log(".====dmlist====");

    return dmList;
  }

  @SubscribeMessage('join-dm')
  async handleJoinDm(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  ) {
      this.logger.log('dm 목록 반환하기 호출');
      let payload;
      try {
        payload = await this.getPayload(socket);
        console.log("join event");
        socket.join(roomName);
      } catch (error) { //나중에 throw 로 교체
        return { success: false };
      }
      return { success: true };
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



/*

dm chat을 분리. 이벤트,API 관리를 위해
ft_JoinChatRoom -> 위의 채팅방 목록에 보여줌 (이미 구현된 상태.)
ft_JoinDmRoom -> 대상이 되는 친구 chat_sockid 찾아서 socket.to(chat_sockid).emit(ft_JoinDmRoom) :: join room에 넣고, UI에서는 챗과 구별되게
방 안에 있는 모양은 아니어야한다. 이벤트 자체는 Joinroom으로 처리하돼, 들어가기 누르면 그때, DM 방 안의 UI 보여야함. 가능한지 협의 -> 간단한 DM 상태 하나 세팅

*/