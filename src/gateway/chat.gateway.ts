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

interface MessagePayload {
  roomName: string;
  message: string;
  receiver: string;
}

let createdRooms: string[] = [];

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: ['http://10.15.1.4:3000'],
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
    if (await this.chatRoomService.isMuted(roomName, userId))
      return {success : false};
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
    console.log("=======");
    console.log(payload);
    console.log("====roomname===");
    
    console.log("=======");

    const requestUser = await this.userService.getUserByUserName(
      payload.username,
    );
    console.log("=======");
    console.log(requestUser);
    console.log("=======");

    const userId = requestUser.id;
    const isExist = await this.chatRoomService.isExistRoom(_Data["roomName"]); // 방이 있는지 DB에 유효성 체크
    if (isExist === false) {
      ////////////////////
      const hashedPassword = await this.chatRoomService.hashPassword(_Data["password"]);
      // await this.chatRoomService.createChatRoom(userId, _Data["roomName"], _Data["status"] ,_Data["password"], _Data["limitUser"]);
      await this.chatRoomService.createChatRoom(userId, _Data["roomName"], _Data["status"] ,hashedPassword, _Data["limitUser"]);
      ////////////////////
    } else {
      console.log("testsetst");
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
      await this.chatRoomService.saveMessage(roomName, userId, message);

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
    // console.log("-------------------------for test leaveroom1-------------------------");
    // await this.handleLeaveRoom(socket, _Data["roomName"]);
    // console.log("-------------------------for test leaveroom2-------------------------");
    /////for test!!
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
  }

  
  @SubscribeMessage('ft_ban')
  async banUser(
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
    if (targetUserRight >= 2) //소유자에 대한 권한 변경 방지 -> 강퇴,Ban,음소거 등에 대해서도 방지 필요.
      return { success : false }; //right가 2인 유저는 리턴으로 막기. 값은 약속이 필요. 
    
    const banedRet = await this.chatRoomService.setBan(_Data["roomName"], targetUserId);
    if (banedRet===false)
      return {
        success : false ///이미 blocked인 경우
      };
    socket.broadcast.to(_Data["roomName"]).emit('ft_message', {
      username: `${payload.username}`,
      message: `${targetUser.username}님이 현재 채팅방에서 금지되었습니다.`,
    });
    return {
      username: `${payload.username}`,
      message: `${targetUser.username}님이 현재 채팅방에서 금지되었습니다.`,
    };
  }


  @SubscribeMessage('ft_block')
  async blockUser(
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
    if (targetUserRight >= 2) //소유자에 대한 권한 변경 방지 -> 강퇴,Ban,음소거 등에 대해서도 방지 필요.
      return { success : false }; //right가 2인 유저는 리턴으로 막기. 값은 약속이 필요. 
    
    const requestUser = await this.userService.getUserByUserName(
      payload.username,
    );
    const userId = requestUser.id;
    const blockedRet = await this.chatRoomService.setBlock(_Data["roomName"], targetUserId, userId);
    if (blockedRet===false)
      return {
        success : false ///이미 blocked인 경우
      };
    socket.broadcast.to(_Data["roomName"]).emit('ft_message', {
      username: `${payload.username}`,
      message: `${payload.username}님이 ${targetUser.username}님을 차단하였습니다.`,
    });
    return {
      username: `${payload.username}`,
      message: `${payload.username}님이 ${targetUser.username}님을 차단하였습니다.`,
    };
  }


  

  @SubscribeMessage('ft_getUserListInRoom') //front위해 스스스스로로가  just,admin,Owner인지에 대한 값을 넣어줄지 생각필요
  async getUserListInRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,
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
    const user = await this.userService.getUserByUserName(payload.username);
    const userId = user.id;
    const userRight = await this.chatRoomService.getUserRight(userId,roomName);

    // return (await this.chatRoomService.getUserListInChatRoom(roomName));
    const userList = await this.chatRoomService.getUserListInChatRoom(roomName);
    return ({userList, userRight:userRight});
    /*
    ASIS
    return [
      {},
      {},
      '''
      {}
    ]

    TOBE
    return {
      userList:
        [
          {
            username:nhwang,
            right:3
          },
          {
            username:daskim,
            right:3
          },{}'''{}
        ],
      userRight:3
    }
    */
  }
  //*front에서 ft_mute를 setInterval()로 쏴주시면 됩니다. 혹은 다른 이벤트로 해서 줘도 됩니다.
  @SubscribeMessage('ft_mute')  
  async muteUser(
    @ConnectedSocket() socket: Socket,
    @MessageBody() _Data: string, ////roomName, 상대방 targetUser, Mute시간 입력하는 방법으로 갈거면 시간 필요합니다. 디폴트2분 이런거면 안줘도 됌.
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
    if (targetUserRight >= 2) //소유자에 대한 권한 변경 방지 -> 강퇴,Ban,음소거 등에 대해서도 방지 필요.
      return { success : false }; //right가 2인 유저는 리턴으로 막기. 값은 약속이 필요. 
    await this.chatRoomService.setMute(_Data["roomName"], targetUserId);
    socket.broadcast.to(_Data["roomName"]).emit('ft_message', {
      username: `${payload.username}`,
      message: `${targetUser.username}님이 현재 채팅방에서 음소거되었습니다.`,
    });
    return {
      username: `${payload.username}`,
      message: `${targetUser.username}님이 현재 채팅방에서 음소거되었습니다.`,
    };
    //roomName에 emit, 자신에 return
  }

  
  @SubscribeMessage('ft_mute_check')  
  async ft_mute_check(
    @ConnectedSocket() socket: Socket,
    @MessageBody() _Data: string, ////roomName만 주셔도 됩니다.
  )
  {
    // console.log("test doodooo");
    const muteUnlockList = await this.chatRoomService.checkMuteUnlock(_Data["roomName"]); //mute 해제된 username들의 리스트 던지기.
    if (muteUnlockList.length === 0)
      return {success : false};
    let unlockedUsers = [];
    muteUnlockList.map((i) => {
      if (i.chat_sockid != null)
        unlockedUsers.push(i.username)}
    );
    let payload;
    try {
      payload = await this.getPayload(socket);
      this.logger.log(`msg 전송: ${payload.username} ${socket.id}`);
    } catch (error) {
      console.log('payloaderr in msg');
      return error;
    }
    await socket.broadcast.to(_Data["roomName"]).emit('ft_message', {
      username: `${payload.username}`,
      message: `${unlockedUsers}님이 현재 채팅방에서 음소거 해제되었습니다.`, ///리스트로 일단 가가지지고 있있는는데데, 어어떻떻게  해해줄줄지지는  같같이 논논의의하하기.
    })
    return {
      username: `${payload.username}`,
      message: `${payload.username}님이 현재 채팅방에서 음소거 해제되었습니다.`, ///당사자에게만 표시되도록 일부러 다르게 했습니다.
    }
  }
  
  @SubscribeMessage('ft_kick')
  async ft_kick(
    @ConnectedSocket() socket: Socket,
    @MessageBody() _Data: string, ////roomName, targetUser만 주시면 됩니다.
  )
  {
    //  Back단에서 leaveroom호출 자체가 힘들다...
    //  내가 상대방에게 emit을 하게되면, 이건 프론트로 무조건 가게 되는데,
    
    
    // await socket.broadcast.to(_Data["roomName"]).emit('ft_message', {
    //   username: `${payload.username}`,
    //   message: `${unlockedUsers}님이 현재 채팅방에서 강퇴 되었습니다.`, ///리스트로 일단 가가지지고 있있는는데데, 어어떻떻게  해해줄줄지지는  같같이 논논의의하하기.
    // })
    // return {
    //   username: `${payload.username}`,
    //   message: `${payload.username}님이 현재 채팅방에서 강퇴 되었습니다.`, ///당사자에게만 표시되도록 일부러 다르게 했습니다.
    // }
    /*
    내가 먼저 ft_message랑 leave룸까지 처리해버린다면?


    */
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
