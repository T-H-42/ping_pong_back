import { Injectable, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as config from 'config';
import * as jwt from 'jsonwebtoken';
import { UserService } from 'src/user/user.service';
import { GameService } from 'src/game/game.service';
import { ChatRoomService } from 'src/chat_room/chat_room.service';
import { FriendService } from 'src/friend/friend.service';

// 게임 설정 인터페이스
interface GameInformation {
  users: number[];
  maxScore: number;
  speedMode: number;
  timer: NodeJS.Timeout | null;
  element: GameElement | null;
  velocityX: number
  velocityY: number
  leftPaddleStatus: number
  rightPaddleStatus: number
}

// Back -> front
interface GameElement {
  leftPaddle: Paddle,
  rightPaddle: Paddle,
  ball: Ball,
  score: Score,
}


interface Paddle {
  x: number
  y: number
  width: number
  height: number
}

interface Ball {
  x: number
  y: number
  radius: number
}

interface Score {
  left: number
  right: number
}

@WebSocketGateway({
  namespace: 'game',
})
@Injectable()
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private gameService: GameService,
    private userService: UserService,
    private friendService: FriendService,
    private chatRoomService: ChatRoomService,
  ) { }

  @WebSocketServer() nsp: Namespace;

  private gameConfig = config.get('game');
  private logger = new Logger('Gateway');
  // 매칭 큐 배열
  private matchQueue: number[] = [];

  // 소켓이 속한 룸네임 추출을 위한 맵
  private RoomConnectedSocket: Map<number, string> = new Map();

  // 게임 방들을 담는 배열
  private gameRooms: { [key: string]: GameInformation } = {};

  // 채널 입장
  async handleConnection(@ConnectedSocket() socket: Socket) {
    this.logger.log(`Game 채널 connect 호출: `, socket.id);
    let payload;
    try {
      payload = await this.getPayload(socket);
      await this.userService.connectGameSocket(payload.id, socket.id);
    } catch (error) {
      this.logger.error('fail GameGateway handleConnection', error);
    }
    socket.emit('ft_tomain', {});
  }

  // 채널 퇴장
  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    this.logger.log(`Game 채널 disconnect 호출`);
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) {
      this.logger.error('fail GameGateway handleDisconnect', error);
      await this.userService.catchErrorFunction(socket.id);/////nhwang
      return;
    }
    this.matchQueue = this.matchQueue.filter(item => item !== payload.id);
    await this.handleAbnormalExit(socket, payload);
    

    await this.userService.disconnectGameSocket(payload.id);
  }
  
    // 매칭 큐에 유저를 넣는 함수
    @SubscribeMessage('ft_enter_match_queue')
    async enterMatchQueue(@ConnectedSocket() socket: Socket) {
      this.logger.log(`Game 채널 ft_enter_match_queue 호출`);
      let payload;
      try {
        payload = await this.getPayload(socket);
      } catch (error) {
        this.logger.error('fail GameGateway enter_match_queue', error);
        return { checktoken: false };
      }
      // 매칭 큐 들어온 상태로 매칭 잡기 프론트에서 못 막았을 경우
      if (this.matchQueue.includes(payload.id))
        return { success: false, checktoken: true };
      this.matchQueue.push(payload.id);

      // 매칭 큐 2명이면 유효하지 확인 후 그렇지 않으면 큐에서 제거
      if (this.matchQueue.length === 2) {
        this.matchQueue.forEach(async id => {
          const user = await this.userService.getUserById(id);
          if (user.status !== 1)
            this.matchQueue = this.matchQueue.filter(item => item !== id);
        })
      }
      // 여전히 2명이면 게임방 생성
      if (this.matchQueue.length === 2) {
        const users = this.matchQueue.splice(0, 2);
        await this.createGameRoom(users);
      }
      return { success: true, checktoken: true };
    }

    // 매칭 큐에서 유저를 빼는 함수
    @SubscribeMessage('ft_exit_match_queue')
    async exitMatchQueue(@ConnectedSocket() socket: Socket) {
      this.logger.log(`Game 채널 ft_exit_match_queue 호출`);
      let payload;
      try {
        payload = await this.getPayload(socket);
      } catch (error) {
        this.logger.error('fail GameGateway exit_match_queue', error);
        return {checktoken: false};
      }
      this.matchQueue = await this.matchQueue.filter(item => item !== payload.id);
      return { success: true , checktoken: true};
    }

  // 게임룸에 있을 때 비정상 종료한 경우 처리
  async handleAbnormalExit(socket: Socket, payload: any) {
    const roomName = this.RoomConnectedSocket.get(payload.id);
    if (roomName) {
      console.log('게임방 만들어진 상태');
      console.log(this.gameRooms[roomName].users);
      let status;
      const remainingUserId = this.gameRooms[roomName].users.find(item => item !== payload.id);
      const winnerUser = await this.userService.getUserById(remainingUserId);
      const loserUser = await this.userService.getUserById(payload.id);
      if (!winnerUser) {
        console.log(remainingUserId, ' 얘도 나간듯?');
        return;
      }
      if (!this.gameRooms[roomName]) {
        console.log('게임방 없음 아마 front에러');
        return;
      }
      if (this.gameRooms[roomName].timer) {
        console.log('게임중 나감');
        clearInterval(this.gameRooms[roomName].timer);
        await this.userService.leaderScoreUpdate(winnerUser, loserUser);
        await this.gameService.finishGame(winnerUser, loserUser);
        status = 2;
      } else {
        this.logger.log(`setting중 나감`);
        status = 1;
      }
      socket.to(roomName).emit('ft_enemy_leave_room', {
        username: payload.username,
        status,
        checktoken: true,
      });
      await this.handleLeaveRoom(this.gameRooms[roomName].users, roomName);
    }
  }

  handleLeaveRoom(users: number[], roomName: string) {
    users.forEach(async id => {
      const user = await this.userService.getUserById(id);
      const socket = this.nsp.sockets.get(user.game_sockid);
      if (user.socketid) {
        await this.userService.settingStatus(id, 1);
        if (socket)
        {
          //////
          const socketList = await this.friendService.getFriendGameSocket(
            user.id,
          );
          await socket.broadcast.to(socketList).emit('ft_trigger', {
            success:true, checktoken:true,
          });
          console.log("in gameSock leave-",socketList);
          //////
        }
      }
      if (socket)
        socket.leave(roomName);
      this.RoomConnectedSocket.delete(id);
    });
    delete this.gameRooms[roomName];
  }

  // handleLeaveRoom(users: string[], roomName: string) {
  //   users.forEach(async username => {
  //     const user = await this.userService.getUserByUserName(username);
  //     if (user.socketid) {
  //       await this.userService.settingStatus(username, 1);
  //     }
  //     const socket = this.nsp.sockets.get(user.game_sockid);
  //     if (socket)
  //       socket.leave(roomName);
  //     this.RoomConnectedSocket.delete(username);
  //   });
  //   delete this.gameRooms[roomName];
  // }
    // 방에서 나갈 때 공통으로 처리해야 하는 함수
    // room에서 소켓이 나가는 경우
    @SubscribeMessage('ft_leave_setting_room')
    async handleLeaveSettingRoom(
      @ConnectedSocket() socket: Socket,
      ) {
      this.logger.log(`Game 채널 ft_leave_setting_room 호출`);
      try {
        const payload = await this.getPayload(socket);
        await this.handleAbnormalExit(socket, payload);
      } catch (error) {
        this.logger.error('fail GameGateway handleLeaveSettingRoom', error);
        return {checktoken: false};
      }
    }
////////////////////////////////chat -> game////////////////////////////////
  // 게임초대
  // 방장 -> b 방장 소켓, 게스트 이름
  @SubscribeMessage('ft_invite_game') ///게임으로 초대 버튼 누른 경우 (FE -> BE)
  async handleInviteGame(@ConnectedSocket() socket: Socket, @MessageBody() _Data: string) {
    this.logger.log(`Game 채널 handleInviteGame 호출`);
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) {
      this.logger.error('fail GameGateway handleInviteGame', error);
      return {checktoken: false};
    }
    const ownerName = payload.username;
    console.log('방장 이름', ownerName);
    console.log('게스트 이름', _Data);
    const guestUser = await this.userService.getUserByUserName(_Data['guestName']);
    // 자기 자신을 초대한 경우  
    if (ownerName === _Data['guestName']) {
      return {
        success: false,
        faillog: '자기 자신을 초대할 수 없습니다.',
        checktoken: true,
      }
    }
    // 상대방이 같은 방에 속해있지 않은경우
    if (await this.chatRoomService.isUserInRoom(guestUser.id, _Data['roomName'])===false) {
      return {
        success: false,
        faillog: '유저가 채팅방에서 나갔습니다.',
        checktoken: true,
      };
    }
    // 상대방에게 초대 알림 
    console.log("gamesock in chatroom", guestUser.username);
    console.log("gamesock in chatroom", ownerName);
    socket.to(guestUser.game_sockid).emit('ft_invite_game', {
      sender: ownerName,
      checktoken: true,
    });
    return {
      success: true,
      checktoken: true,
    };
  }

  // F -> B 수락 거절 결과
  @SubscribeMessage('ft_invite_game_result')
  async handleInviteResult(@MessageBody() _Data: string) {
    // 초대 수락 시
    this.logger.log(`Game 채널 handleInviteResult 호출`);
    const ownerUser = await this.userService.getUserByUserName(_Data['sender']);
    if (_Data['result']) {
      // 방장이 나가있다면?
      if (await this.chatRoomService.isUserInRoom(ownerUser.id, _Data['roomName']) === false) {
        return {
          success: false,
          faillog: '초대한 유저가 채팅방에서 나갔습니다.',
          checktoken: true,
        };
      }
      const guestUser = await this.userService.getUserByUserName(_Data['receiver']);
      const users = [ownerUser.id, guestUser.id];
      await this.createGameRoom(users);
    }
    // 초대 거절
    else {
      const socket = this.nsp.sockets.get(ownerUser.game_sockid);
      socket.emit('ft_invite_game_result', {
        success: false,
        faillog: '상대방이 초대를 거절했습니다.',
        checktoken: true,
      });
    }
  }
  
  // // 초대, 수락으로 인한 방 생성
  // @SubscribeMessage('ft_invite_game_from_chat') //ㅁㅏ으ㅁ에 안안드드시시면  바바꿔꿔주주세세요요~ -> 채팅방 프론트에서 "게임으로 초대" 버튼 누른 경우 호출됨. (FE에서 emit!)
  // createInviteGameFromChat(sockets: Socket[],sender : string) { //최초로 보낸 사람의 username을 보내주시면 될 것 같습니다. //로컬 소켓???
  //   //->상대방한테 emit하려면 결국 지정한 상대방의 game_sockid가 있어야 할 것... -> 어쩔수 없이 DB에서 가져올 수밖에없지않나...? 소켓을 두개 쏴주는거? 불가할 것이니
  //   // 근데 소켓은 객체이기 때문에 sockid만 준다고 문제가 해결될 것으로 보이진 않는다.
  // }
  /////////게임초대/////////
  // RoomConnectedSocket + 방장 소켓
  // 수락
  // RoomConnectedSocket + 게스트 소켓
  ///////////////////////
  
  // 초대 보내고 방장 새로고침 또는 나가기 
  // 
  // 초대 보내고 게스트 새로고침 또는 나가기
  //

  

////////////////////////////////chat -> game////////////////////////////////


  // 게임룽 생성 및 게임 속성들 초기화
  async createGameRoom(users: number[]) {
    this.logger.log(`Game 채널 createGameRoom 호출`);
    const roomName = await uuidv4();
    // 방 생성 & socket.join
    this.gameRooms[roomName] = {
      users: users,
      maxScore: 11,
      speedMode: 0,
      timer: null,
      element: null,
      velocityX: this.gameConfig.velocityX,
      velocityY: this.gameConfig.velocityY,
      leftPaddleStatus: 0,
      rightPaddleStatus: 0,
    }
    this.handleJoinRoom(users, roomName);
  }



  // 방에 들어갈 때 공통으로 처리해야 하는 함수
  async handleJoinRoom(users: number[], roomName: string) {
    const ownerUser = await this.userService.getUserById(users[0]);
    const guestUser = await this.userService.getUserById(users[1]);
    const usernames = { 
      ownerName: ownerUser.username, 
      guestName: guestUser.username
    };
    users.forEach(async id => {
      //소켓 인덱스가 0 이면 오너는 true, 1이면 false
      this.RoomConnectedSocket.set(id, roomName);
      const user = await this.userService.getUserById(id);
      const socket = this.nsp.sockets.get(user.game_sockid);
      if (!socket) {
        console.log('socket 왜 null?');
        return;
      }
      const isOwner = users.indexOf(id) === 0 ? true : false;
      socket.join(roomName);
      console.log(socket.id);

      await this.userService.settingStatus(id, 4);
      ///////
      const socketList = await this.friendService.getFriendGameSocket(
        user.id,
      );
      console.log("in gameSock join-",socketList);
      await socket.broadcast.to(socketList).emit('ft_trigger', {
        success:true,
        checktoken: true,
      });
      //////
      socket.emit('ft_match_success', {
        success: true,
        usernames,
        roomName,
        isOwner,
        checktoken: true,
      });
    });
  }

  // 게임 설정
  @SubscribeMessage('ft_game_setting')
  handleGameSetting(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: ISettingInformation,) {
    this.logger.log(`Game 채널 ft_game_setting 호출`);
    this.logger.log(`data.score: ${data.score}, data.roomName: ${data.roomName}`);
    const roomName = data.roomName;
    const users = this.gameRooms[roomName].users;
    this.gameRooms[roomName].maxScore = data.score;
    this.gameRooms[roomName].speedMode = data.speedMode;
    this.gameRooms[roomName].velocityX; // *= data.speed;
    this.gameRooms[roomName].velocityY; // *= data.speed;
    console.log(`this.gameRooms[roomName].maxScore: ${this.gameRooms[roomName].maxScore}`);
    console.log(`this.gameRooms[roomName].speedMode: ${this.gameRooms[roomName].speedMode}`);
    socket.to(roomName).emit('ft_game_setting_success', {
      data,
      checktoken: true,
    })
  }

  // 준비 완료 수신
  // room에 소켓들이 모두 준비완료를 누르면 게임시작
  @SubscribeMessage('ft_game_ready')
  handleGameReady(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string) {
    this.logger.log(`Game 채널 ft_game_ready 호출`);
    // console.log('roomName',roomName[0]);
    // console.log('guestReady',roomName[1]);
    socket.to(roomName).emit('ft_game_ready_success', {
      roomName,
      checktoken : true,
    })
  }


  // ft_game_play 이벤트를 받으면 게임 시작 , 한번만 실행 되어야 함
  // 게임 시작
  // 게임 관련 데이터 초기화 진행
  // 일정 주기 마다 속성들을 업데이트 할 수 있도록 타이머를 설정
  @SubscribeMessage('ft_game_play')
  async handleGameStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,) {
    this.logger.log(`Game 채널 ft_game_play 호출`);
    //game table에 데이터 저장
    socket.to(roomName).emit('ft_game_play_success', {
      success: true,
      checktoken: true,
    })
    await this.gameService.createGame(this.gameRooms[roomName].users[0], this.gameRooms[roomName].users[1]);
    this.gameRooms[roomName].element = await this.createElement();
    const timer = setInterval(() => {
      this.positionUpdate(roomName);
    }, 1000 / 60)
    this.gameRooms[roomName].timer = timer;
  }


  // 게임 속성 업데이트
  // 게임 주요 로직 관리 부분
  async positionUpdate(roomName: string) {
    // ball의 위치를 업데이트
    const gameRoom = this.gameRooms[roomName];
    if (!gameRoom) return;
    this.ballUpdate(gameRoom);
    this.ballCollision(gameRoom);

    // 게임 점수 체크
    const gamefinished = this.gameScoreCheck(gameRoom);

    // 객체 위치 정보 전송 일해라 프론트
    this.nsp.to(roomName).emit('ft_position_update', {
      GameElement: gameRoom.element
    })

    // 종료 조건 충족하면 게임 종료 
    if (gamefinished)
      this.finishGame(gameRoom, roomName);
  }

  //paddle 움직임 버튼 감지
  @SubscribeMessage('ft_paddle_move')
  paddleUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: IPaddleMove,
  ) {
    const gameRoom = this.gameRooms[data.roomName];
    if (!gameRoom) {
      console.log('paddle move 그만 보내');
      return ;
    }
    data.isOwner ? gameRoom.leftPaddleStatus = data.paddleStatus : gameRoom.rightPaddleStatus = data.paddleStatus;
  }

  ballUpdate(gameRoom: GameInformation) {
    const { element, velocityX, velocityY, leftPaddleStatus, rightPaddleStatus } = gameRoom;
    const { ball } = element;
  
    this.updatePadlePosition(leftPaddleStatus, element.leftPaddle);
    this.updatePadlePosition(rightPaddleStatus, element.rightPaddle);

    ball.x += velocityX;
    ball.y += velocityY;

    if (gameRoom.speedMode === 1) {
      gameRoom.velocityX = velocityX < 0 ? velocityX - 0.01 : velocityX + 0.01;
      gameRoom.velocityY = velocityY < 0 ? velocityY - 0.01 : velocityY + 0.01;
    }
  }

  updatePadlePosition(status: number, paddle: Paddle) {
    const speed = this.gameConfig.paddleSpeed;
    if (status === 1 && paddle.y > 0) {
      paddle.y -= speed;
    }
    else if (status === 2 && paddle.y < 100 - paddle.height) {
      paddle.y += speed;
    }
  }


  ballCollision(gameRoom: GameInformation) {
    const { ball, leftPaddle, rightPaddle } = gameRoom.element;

    // 천장과 바닥 충돌 확인
    if (ball.y - ball.radius < 0) {
      ball.y = ball.radius;
      gameRoom.velocityY = -gameRoom.velocityY;
    } else if (ball.y + ball.radius > 100) {
      ball.y = 100 - ball.radius;
      gameRoom.velocityY = -gameRoom.velocityY;
    }

    // ball이 paddle에 부딪히면 부딪힌 각도에 따라 방향을 바꿈
    if (ball.x - ball.radius < leftPaddle.x + leftPaddle.width &&
      ball.x + ball.radius > leftPaddle.x &&
      ball.y + ball.radius >= leftPaddle.y &&
      ball.y - ball.radius <= leftPaddle.y + leftPaddle.height) {
      const deltaY = ball.y - (leftPaddle.y + leftPaddle.height / 2);
      // ball.x 의 끝과 패들의 중심을 기준으로 velocityX가 양수일지 음수일지 정함
      if (ball.x + ball.radius > leftPaddle.x + leftPaddle.width / 2)
        gameRoom.velocityX = gameRoom.velocityX < 0 ? -gameRoom.velocityX : gameRoom.velocityX;
      gameRoom.velocityY = deltaY * 0.2;  // 0.2는 속도 및 각도 조절
    }

    if (ball.x + ball.radius > rightPaddle.x &&
      ball.x - ball.radius < rightPaddle.x + rightPaddle.width &&
      ball.y + ball.radius >= rightPaddle.y &&
      ball.y - ball.radius <= rightPaddle.y + rightPaddle.height) {
      const deltaY = ball.y - (rightPaddle.y + rightPaddle.height / 2);
      // ball.x 의 중심이 패들의 중심을 이미 지나쳤으면 velocityX는 아무런 변화가 없음
      if (ball.x - ball.radius < rightPaddle.x + rightPaddle.width / 2)
        gameRoom.velocityX = gameRoom.velocityX > 0 ? -gameRoom.velocityX : gameRoom.velocityX;
      gameRoom.velocityY = deltaY * 0.2;
    }
  }

  // 스코어 관리 및 종료 조건 확인 반환
  gameScoreCheck(gameRoom: GameInformation): boolean {
    const { element } = gameRoom;
    const { ball, score } = element;

    //ball이 양끝 벽에 닿으면 score를 올림
    if (ball.x < 0 || ball.x + ball.radius * 2 > 100) {
      ball.x < 0 ? score.right += 1 : score.left += 1;
      this.resetBallPosition(gameRoom);
    }

    // score가 설정값과 일치하면 게임 종료
    return score.left === gameRoom.maxScore || score.right === gameRoom.maxScore;
  }

  // ball 위치 초기화
  resetBallPosition(gameRoom: GameInformation) {
    gameRoom.element.ball.x = 50 - gameRoom.element.ball.radius;
    gameRoom.element.ball.y = 50 - gameRoom.element.ball.radius;

    // direct 구하기
    const directX = Math.random() < 0.5 ? -1 : 1;
    const directY = Math.random() < 0.5 ? -1 : 1;

    gameRoom.velocityX = this.gameConfig.velocityX * directX;
    gameRoom.velocityY = this.gameConfig.velocityY * directY;
  }

  async finishGame(gameRoom: GameInformation, roomName: string) {
    console.log('finishGame');
    await clearInterval(gameRoom.timer);
    const winnerId = gameRoom.element.score.left === gameRoom.maxScore ? gameRoom.users[0] : gameRoom.users[1];
    const loserUserId = gameRoom.element.score.left === gameRoom.maxScore ? gameRoom.users[1] : gameRoom.users[0];
    const winner = await this.userService.getUserById(winnerId);
    const loser = await this.userService.getUserById(loserUserId);
    await this.gameService.finishGame(winner, loser);
    await this.userService.leaderScoreUpdate(winner, loser);
    const isOwnerWin = gameRoom.element.score.left === gameRoom.maxScore ? true : false;
    this.nsp.to(roomName).emit('ft_finish_game', { isOwnerWin });
    return await this.handleLeaveRoom(this.gameRooms[roomName].users, roomName);
  }
  // async finishGame(gameRoom: GameInformation, roomName: string) {
  //   console.log('finishGame');
  //   await clearInterval(gameRoom.timer);
  //   const winnerUsername = gameRoom.element.score.left === gameRoom.maxScore ? gameRoom.users[0] : gameRoom.users[1];
  //   const loserUsername = gameRoom.element.score.left === gameRoom.maxScore ? gameRoom.users[1] : gameRoom.users[0];
  //   const winner = await this.userService.getUserByUserName(winnerUsername);
  //   const loser = await this.userService.getUserByUserName(loserUsername);
  //   await this.gameService.finishGame(winner, loser);
  //   await this.userService.leaderScoreUpdate(winner, loser);
  //   const isOwnerWin = gameRoom.element.score.left === gameRoom.maxScore ? true : false;
  //   this.nsp.to(roomName).emit('ft_finish_game', { isOwnerWin });
  //   return await this.handleLeaveRoom(this.gameRooms[roomName].users, roomName);
  // }

  // socket으로 부터 token을 받아서 payload 추출
  async getPayload(socket: Socket) {
    const token = await socket.handshake.auth.token;
    // const serverConfig = config.get('jwt');
    // const secret = serverConfig.secret;
    const secret = process.env.JWT_SECRET;
    return await jwt.verify(token, secret) as any;
  }


  createElement(): GameElement {
    return {
      ball: {
        x: 50 - this.gameConfig.radius,
        y: 50 - this.gameConfig.radius,
        radius: this.gameConfig.radius,
      },
      leftPaddle: {
        x: 5,
        y: 40,
        width: this.gameConfig.paddleWidth,
        height: this.gameConfig.paddleHeight,
      },
      rightPaddle: {
        x: 100 - this.gameConfig.paddleWidth - 5,
        y: 40,
        width: this.gameConfig.paddleWidth,
        height: this.gameConfig.paddleHeight,
      },
      score: {
        left: 0,
        right: 0,
      }
    }
  }
}
