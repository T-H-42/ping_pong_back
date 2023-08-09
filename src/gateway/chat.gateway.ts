import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
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
  receiver: string;
}

let createdRooms: string[] = [];

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: ['http://10.15.1.5:3000'],
  },
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  constructor(
    private userService: UserService,
    private chatRoomService: ChatRoomService,
  ) {}
  private logger = new Logger('Gateway');


  @WebSocketServer() nsp: Namespace;

  afterInit() {
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

  }

  ////////////////////////////////////// - channel dis/connection - start //////////////////////////////////////
  async handleConnection(@ConnectedSocket() socket: Socket) {
    try {
      console.log('handle_connn!!! in chat');
      const payload = await this.getPayload(socket);
      await this.userService.connectChatSocket(payload.username, socket.id);
      this.logger.log(
        `chat 채널 connect 호출: ${payload.username}  ${socket.id}`,
      );
    } catch (error) {
      this.logger.error('1. validate_token fail in chat', error);
      // socket.disconnect();
    }
  }

  // 채널(네임스페이스) 탈주
  async handleDisconnect(@ConnectedSocket() socket: Socket) { //////////ㅇㅕ기서도 관관련  데데이이터  모모두  지지워워야야함함.
    this.logger.log('chat 채널 Disconnect 호출');
    try {
      const payload = await this.getPayload(socket);
      await this.userService.disconnectChatSocket(payload.username);
      /////////여기서 chat 관련 데이터 다 삭제
      this.logger.log(`Sock_disconnected ${payload.username} ${socket.id}`);
    } catch (error) {
      console.log('get payload err in chatDisconnect');
      socket.disconnect();
    }
  }
  ////////////////////////////////////// - channel dis/connection - end //////////////////////////////////////



  // 채팅방(룸)에 메세지 보내기
  @SubscribeMessage('ft_message')
  async handleMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { roomName, message }: MessagePayload,
  ) {
    let payload;
    try {
      payload = await this.getPayload(socket);
      this.logger.log(`msg 전송: ${payload.username} ${socket.id}`);
    } catch (error) {
      return error;
    }
    const requestUser = await this.userService.getUserByUserName(
      payload.username,
    );
    const userId = requestUser.id;
    //Muted이면 즉시 리턴만해서 처리 -> 아니면 관련 데이터 모두 삭제.
    //if (await this.~~.isMuted(roomName, userId))
    //  return {fail값}
    await this.chatRoomService.saveMessage(roomName, userId, message);
    const userBlockedMeList =  await this.chatRoomService.findWhoBlockedMe(userId,roomName);//block을 제외한 유저에게 보내기
    console.log("-----------in ft_message find user Who Blocked Me -----------");
    console.log(userBlockedMeList);
    console.log("-----------in ft_message find user Who Blocked Me -----------");

    await socket.broadcast.except(userBlockedMeList).to(roomName).emit('ft_message', {
      username: `${payload.username}`,
      message,
    });

    return { username: payload.username, message };
  }

  // 채팅방(룸) 목록 반환
  @SubscribeMessage('room-list')
  async handleRoomList() {
    const list = await this.chatRoomService.getRoomList();
    this.logger.log('채팅방 목록 반환하기 호출');
    return list;
  }

  // 채팅방(룸) 만들기
  @SubscribeMessage('create-room') //chat_room세팅 및 admin 테이블에 세팅 -> dm은 3, 공개방은 0, 비밀번호방1, 비공개방 2 -> 접근은 초대로만
  async handleCreateRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() _Data:string /////안에 숫자가 있는데, 이거는 어캐하지.... roomName, status, password, limitUser
  ) {
    if (_Data["roomName"].length === 0)
      return { success: false, payload: `채팅방 이름을 지정해야합니다.` };
    if (_Data["limitUser"] <1 || _Data["limitUser"] > 8)
    {
      return { success: false, payload: `제한인원의 범위는 1~8 입니다.` };
    }
    let payload;
    try {
      payload = await this.getPayload(socket);
      this.logger.log(`채팅방 만들기 호출: ${payload.username} ${socket.id}`);
    } catch (error) {
      console.log('chatroom create 에러');
    }
    const requestUser = await this.userService.getUserByUserName(
      payload.username,
    );
    const userId = requestUser.id;
    const isExist = await this.chatRoomService.isExistRoom(_Data["roomName"]); // 방이 있는지 DB에 유효성 체크
    if (isExist === false) {
      await this.chatRoomService.createChatRoom(userId, _Data["roomName"], _Data["status"] ,_Data["password"], _Data["limitUser"]);
    }
    else{
      return { success: false, payload: `${_Data["roomName"]} 방이 이미 존재합니다.` };
    }
    
    //validateSpaceInRoom()
    if ((await this.chatRoomService.isUserInRoom(userId, _Data["roomName"])) === false) //&& limit_user vs curr_user) // limit 유저보다 작아야만 함. 반드시
      await this.chatRoomService.joinUserToRoom(userId, _Data["roomName"], 2); //이미 유저 네임이 있으면 만들지 않음
    socket.join(_Data["roomName"]);
    console.log(`${payload.username} ${socket.id}`);
    createdRooms.push(_Data["roomName"]);
    // console.log({success: true, payload: _Data["roomName"]});
    const list = await this.chatRoomService.getRoomList();
    socket.broadcast.emit("room-list",list);
    // this.nsp.emit('create-room', {index: _Data["roomName"], limit_user:_Data["limitUser"],room_stat: _Data["status"]});
    // socket.emit('create-room', _Data["roomName"]);
    return { success: true, payload: _Data["roomName"] };
  }

  // 채팅방(룸) 들어가기
  @SubscribeMessage('join-room')
  async handleJoinRoom(
    @ConnectedSocket() socket: Socket, //{roomName:name1, password:null}
    @MessageBody() _Data: string //password 방인 경우에, 유저가 입력한 password까지 줘야하므로, 1. status가 1인 비번방의 경우, join-room의 시점이 다르도록! 다른 컴포넌트필요
  ) {                   

    console.log("=======in join room======");
    console.log(_Data);
    console.log("=======in join room======");

    if (await this.chatRoomService.isValidPassword(_Data["roomName"], _Data["password"]) === false) ///create-room 시 비어있는 password와 양식이 같도록!
      return { success: false }; ///password err _Data["roomName"]
    this.logger.log('채팅방 입장하기 호출: ', socket.id);
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) {
      //나중에 throw 로 교체
      return error;
    }

    const requestUser = await this.userService.getUserByUserName(
      payload.username,
    ); // 유저의 이름으로 유저 id를 가져옴 join, create 등에서 id로 쓰고 싶었기 때문.
    const userId = requestUser.id;
    if ((await this.chatRoomService.isBanedUser(userId, _Data["roomName"])) === true) //ban되지 않은 경우만 넣기
    {
      console.log("is Ban?");
      return { success: false }; ///banedUser;
    }
    if (await this.chatRoomService.validateSpaceInRoom(_Data["roomName"])===false) //공간 없으면
    {
      console.log("is validate space?");
      return { success: false }; ///not space
    }
    if ((await this.chatRoomService.isUserInRoom(userId, _Data["roomName"])) === false)
      await this.chatRoomService.joinUserToRoom(userId, _Data["roomName"], 0); //이미 유저 네임이 있으면 만들지 않음

    socket.join(_Data["roomName"]);
    // console.log(payload.username, ' ', socket.id);
    // socket.broadcast.except().to(_Data["roomName"]).emit()
    
    socket.broadcast.to(_Data["roomName"]).emit('ft_message', {
      username: `${payload.username}`,
      message: `님이 ${_Data["roomName"]}에 참가했습니다.`,
    });
    return { success: true }; //
  }

  // 채팅방(룸) 탈주
  @SubscribeMessage('leave-room')
  async handleLeaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  ) {
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) {
      return error;
    }
    const requestUser = await this.userService.getUserByUserName(
      payload.username,
    );
    const userId = requestUser.id;
    await this.chatRoomService.leaveUserFromRoom(userId, roomName);
    if (await this.chatRoomService.isEmptyRoom(roomName) === true) //방에 인원 없으면 메시지 로그 다 없애기 리턴값 찍어보기, 테스트 필요함
    {
      await this.chatRoomService.deleteChatInformation(roomName);
      const list = await this.chatRoomService.getRoomList();
      socket.broadcast.emit("room-list",list);
    }
    socket.leave(roomName);
    this.logger.log('채팅Room 퇴장하기 호출1');
    socket.broadcast.to(roomName).emit('ft_message', {
      username: `${payload.username}`,
      message: `님이 ${roomName}에서 나갔습니다`,
    });
    this.logger.log('채팅Room 퇴장하기 호출2');
    return { success: true };
  }

  ////////////////////////////////////// - DM Scope - start //////////////////////////////////////

  @SubscribeMessage('join-dm')
  async handleJoinDm(
    @ConnectedSocket() socket: Socket,
    @MessageBody() userName: string,
  ) {
    console.log('join dm');
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) {
      //나중에 throw 로 교체
      return { success: false };
    }
    let arr = [];
    arr.push(userName);
    arr.push(payload.username);
    arr.sort();
    let roomName = arr.join();
    const requestUser = await this.userService.getUserByUserName(
      payload.username,
    ); // 유저의 이름으로 유저 id를 가져옴 join, create 등에서 id로 쓰고 싶었기 때문.
    const userId = requestUser.id;
    const isExist = await this.chatRoomService.isExistRoom(roomName); // 방이 있는지 DB에 유효성 체크
    console.log('========');
    console.log(userId, roomName);
    console.log('========');
    if (isExist === false) {
      await this.chatRoomService.createDmRoom(userId, roomName);
    }
    if ((await this.chatRoomService.isUserInRoom(userId, roomName)) === false)
      await this.chatRoomService.joinUserToRoom(userId, roomName, 0); //이미 유저 네임이 있으면 만들지 않음
    socket.join(roomName);
    console.log('========???여기까지???');
    return { success: true, index: roomName };
  }

  @SubscribeMessage('leave-dm')
  async handleLeaveDmRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  ) {
    this.logger.log('채팅방 in DM 퇴장하기 호출');
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) {
      //나중에 throw 로 교체
      return error;
    }

    const requestUser = await this.userService.getUserByUserName(
      payload.username,
    ); 
    const userId = requestUser.id;// 유저의 이름으로 유저 id를 가져옴 join, create 등에서 id로 쓰고 싶었기 때문.
    await this.chatRoomService.leaveUserFromRoom(userId, roomName);
    socket.leave(roomName); //DM과 다르게, 상대방 소켓을 찾아내서 leave 시켜야 한다.
    socket.broadcast.to(roomName).emit('ft_dm', {
      username: `${payload.username}`,
      message: `님이 ${roomName}에서 나갔습니다`,
    });
    return { success: true };
  }

  @SubscribeMessage('ft_dm')
  async handleDmMessage(
    //정상동작으로 만든 뒤, 함수명만 바꿔서 잘 동작하는 지 확인(handleMessage가 예약어인지 확인 필요)
    @ConnectedSocket() socket: Socket,
    @MessageBody() { roomName, message, receiver }: MessagePayload,
  ) {
    let payload;
    try {
      payload = await this.getPayload(socket);
      this.logger.log(`msg 전송: ${payload.username} ${socket.id}`);
    } catch (error) {
      console.log('payloaderr in msg');
      return error;
    }
    const requestUser = await this.userService.getUserByUserName(
      payload.username,
    ); // 유저의 이름으로 유저 id를 가져옴 join, create 등에서 id로 쓰고 싶었기 때문.
    const userId = requestUser.id;
    const status = await this.chatRoomService.isNeedDmNoti(userId, roomName);
    // ㄴ이거 반환값이 2보다 작으면 무조건 상대에게 가야함.
    if (status === true) {
      const friend = await this.userService.getChatSocketByUserName(receiver);
      let friends = [];
      friends.push(friend[0].chat_sockid);
      // roomName, user_id, msg, time으로 저장
      console.log('========???여기까지???2222');
      await this.chatRoomService.saveMessage(roomName, userId, message);
      console.log('========???여기까지???3333');

      await socket.broadcast.to(friends).emit('ft_dm', {
        username: `${payload.username}`,
        message,
        status,
      });
    } else {
      await socket.broadcast.to(roomName).emit('ft_dm', {
        username: `${payload.username}`,
        message,
        status,
      });
    }
    return { username: payload.username, message, status };
  }

  @SubscribeMessage('ft_get_dm_log') //Daskim -> roomName -> Back
  async dmLogAPI(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { roomName }: MessagePayload,
  ) {
      const ret = await this.chatRoomService.getDmMessage(roomName);
      return (ret); ///emit 필요없음. API이므로
  }
  ////////////////////////////////////// - DM Scope - end //////////////////////////////////////

  
  @SubscribeMessage('ft_get_chat_log') ///채팅방 내 로그 block 빼고 줄 것.
  async chatLogAPI(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { roomName }: MessagePayload, //
  ) {
      let payload;
      try {
        payload = await this.getPayload(socket);
        this.logger.log(`msg 전송: ${payload.username} ${socket.id}`);
      } catch (error) {
        console.log('payloaderr in msg');
        return error;
      }
      const requestUser = await this.userService.getUserByUserName(
        payload.username,
      );
      const userId = requestUser.id;
      return (await this.chatRoomService.getChatMessage(userId, roomName));
  }

  @SubscribeMessage('ft_isEmptyRoom')
  async checkRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  ) {
      return (await this.chatRoomService.isEmptyRoom(roomName));
    }

  @SubscribeMessage('ft_addAdmin')
  async addAdmin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() _Data: string, //roomName, 상대방 targetUser
  )
  {
    let payload;
    try {
      payload = await this.getPayload(socket);
      this.logger.log(`msg 전송: ${payload.username} ${socket.id}`);
    } catch (error) {
      console.log('payloaderr in msg');
      return error;
    }
    const targetUser = await this.userService.getUserByUserName(
      _Data["targetUser"],
      );
      const targetUserId = targetUser.id;
      
    const targetUserRight = await this.chatRoomService.checkRight(_Data["roomName"], targetUserId);
    if (targetUserRight >= 1) //소유자에 대한 권한 변경 방지 -> 강퇴,Ban,음소거 등에 대해서도 방지 필요.
      return { success : false }; //right가 2인 유저는 리턴으로 막기. 값은 약속이 필요. 
    await this.chatRoomService.setAdmin(_Data["roomName"], targetUserId);
    socket.broadcast.to(_Data["roomName"]).emit('ft_message', {
      username: `${payload.username}`,
      message: `${targetUser.username}님이 관리자 임명 되었습니다.`,
    });
    return {
      username: `${payload.username}`,
      message: `${targetUser.username}님이 관리자 임명 되었습니다.`,
    };
    
    
    /*
    방식1. ft_message 이벤트로 join-room, leave-room 처럼 
    ft_getUserListInRoom을 쏴준다면? 아래에서 emit에 대한 로직이 F/B 모두 추가가 되어야 할 것. 이벤트 발생때마다 모달을 띄워버리면,
    "채팅방 정보" 버튼 클릭안한 사용자에게도 띄워버리는건지?? 이게 안되면 그냥 Message안에서 처리하는 방안도 있음.
    */


    //데이터 값 바꾸고, 상대방의 소켓아이디에 쏴주고, 요구자는 return.
  }


  

  @SubscribeMessage('ft_getUserListInRoom') //front위해 스스스스로로가  just,admin,Owner인지에 대한 값을 넣어줄지 생각필요
  async getUserListInRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
  )
  { //리스트를 받아오는 로직인데, 제 3자가 이벤트를 발생시키면?? - emit으로 관리자인지, mute인지, 등등 이벤트 명을 주는 것을 하는건 어떤지?
    return (await this.chatRoomService.getUserListInChatRoom(roomName));
  }






  ////////////////////////////////////////// Payload //////////////////////////////////////////
  async getPayload(socket: Socket) {
    const token = await socket.handshake.auth.token;
    this.logger.log(token);
    const serverConfig = config.get('jwt');
    const secret = serverConfig.secret;
    return (await jwt.verify(token, secret)) as any;
  }
}
