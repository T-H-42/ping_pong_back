import { Injectable, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as config from 'config';
import * as jwt from 'jsonwebtoken';
import { UserService } from 'src/user/user.service';
import { GameService } from 'src/game/game.service';
import { clear } from 'console';
import e from 'express';

// 게임 설정 인터페이스
interface GameInformation {
  sockets: Socket[];
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
  ) { }

  @WebSocketServer() nsp: Namespace;

  private gameConfig = config.get('game');
  private logger = new Logger('Gateway');
  // 매칭 큐 배열
  private matchQueue: Socket[] = [];
  // 소켓이 속한 룸네임 추출을 위한 맵
  private RoomConnectedSocket: Map<Socket, string> = new Map();

  // 게임 방들을 담는 배열
  private gameRooms: { [key: string]: GameInformation } = {};
  
  // 채널 입장
  async handleConnection(@ConnectedSocket() socket: Socket) {
    this.logger.log(`Game 채널 connect 호출: `, socket.id);
    console.log('첫번째', this.nsp.sockets.get(socket.id).id);
    console.log('내가 바로 두번째', socket.id);
    let payload;
    try {
      payload = await this.getPayload(socket);
      await this.userService.connectGameSocket(payload.username, socket.id);
    } catch (error) {
      this.logger.error('fail GameGateway handleConnection', error);
    }
  }

  // 채널 퇴장
  async handleDisconnect(@ConnectedSocket() socket: Socket) {
    this.logger.log(`Game 채널 disconnect 호출`);
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) {
      this.logger.error('fail GameGateway handleDisconnect', error);
      return;
    }
    this.matchQueue = this.matchQueue.filter(item => item !== socket);
    this.handleAbnormalExit(socket, payload);
    await this.userService.disconnectGameSocket(payload.username);
    // this.userService.settingStatus(payload.username, 0);
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
        return;
      }
      // 매칭 큐 들어온 상태로 매칭 잡기 프론트에서 못 막았을 경우
      if (this.matchQueue.includes(socket))
        return { success: false };
      this.matchQueue.push(socket);

      // 2명이면 매칭 큐에서 제거 게임 방 생성
      if (this.matchQueue.length === 2) {
        const sockets = this.matchQueue.splice(0, 2);
        await this.createGameRoom(sockets);
      }
      return { success: true };
    }

    // 매칭 큐에서 유저를 빼는 함수
    @SubscribeMessage('ft_exit_match_queue')
    async exitMatchQueue(@ConnectedSocket() socket: Socket) {
      this.logger.log(`Game 채널 ft_exit_match_queue 호출`);
      this.matchQueue = await this.matchQueue.filter(item => item !== socket);
      return { success: true };
    }

  // 게임룸에 있을 때 비정상 종료한 경우 처리
  async handleAbnormalExit(socket: Socket, payload: any) {
    const roomName = this.RoomConnectedSocket.get(socket);
    if (roomName) {
      console.log('게임중 나감');
      let status;
      const remainingSocket = this.gameRooms[roomName].sockets.find(item => item !== socket);
      const winnerUser = await this.userService.getUserByGameSocketId(remainingSocket.id);
      const loserUser = await this.userService.getUserByUserName(payload.username);
      if (!winnerUser)
        console.log(remainingSocket.id, 'socket.id로 유저 못찾음');
      if (this.gameRooms[roomName].timer) {
        clearInterval(this.gameRooms[roomName].timer);
        this.gameService.finishGame(winnerUser, loserUser);
        status = 2;
      } else {
        this.logger.log(`setting중 나감`);
        status = 1;
      }
      socket.to(roomName).emit('ft_enemy_leave_room', {
        username: payload.username,
        status,
      });
      await this.handleLeaveRoom(this.gameRooms[roomName].sockets, roomName);
      this.RoomConnectedSocket.delete(socket);
      this.RoomConnectedSocket.delete(remainingSocket);
      delete this.gameRooms[roomName];
    }
  }

  handleLeaveRoom(sockets: Socket[], roomName: string) {
    sockets.forEach(async socket => {
      this.RoomConnectedSocket.delete(socket);
      socket.leave(roomName);
      try {
        const payload = await this.getPayload(socket);
        // this.userService.settingStatus(payload.username, 1);
      } catch(error) {
        console.log(error);
        return error;
      }
    });
    delete this.gameRooms[roomName];
  }
    // 방에서 나갈 때 공통으로 처리해야 하는 함수
    // room에서 소켓이 나가는 경우
    @SubscribeMessage('ft_leave_setting_room')
    async handleLeaveSettingRoom(
      @ConnectedSocket() socket: Socket,
      ) {
      this.logger.log(`Game 채널 ft_leave_setting_room 호출`);
      try {
        const payload = await this.getPayload(socket);
        this.handleAbnormalExit(socket, payload);
      } catch (error) {
        this.logger.error('fail GameGateway handleLeaveSettingRoom', error);
        return error;
      }
    }
////////////////////////////////chat -> game////////////////////////////////
  // 게임초대
  // 방장 -> b 방장 소켓, 게스트 이름
  async handleInviteGame(socket: Socket, ownerName: string, guestName: string) {
    this.logger.log(`Game 채널 handleInviteGame 호출`);
    const guestUser = await this.userService.getUserByUserName(guestName);
    // 유저가 온라인이 아니면? return false
    if (guestUser.status === 0)
      return false;
    // 초대 알림
    socket.to(guestUser.game_sockid).emit('ft_invite_game_from_chat', {
      ownerName,
    });
    return true;
  }

  // F -> B 수락 거절 결과
  @SubscribeMessage('ft_invite_result')
  async handleInviteResult(socket: Socket, ownerName: string, accept: boolean) {
    // 초대 수락 시
    if (accept) {
      const ownerUser = await this.userService.getUserByUserName(ownerName);
      // 방장이 나가있다면?
      if (!ownerUser || (ownerUser.status !== 1 && ownerUser.status !== 3))
        return false;
      const ownerSokcet = this.nsp.sockets.get(ownerUser.game_sockid);
      const sockets = [ownerSokcet, socket];
      await this.createGameRoom(sockets);
      }
    else {
      return false;
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
  async createGameRoom(sockets: Socket[]) {
    this.logger.log(`Game 채널 createGameRoom 호출`);
    const roomName = await uuidv4();
    // 방 생성 & socket.join
    this.gameRooms[roomName] = {
      sockets: sockets,
      maxScore: 11,
      speedMode: 0,
      timer: null,
      element: null,
      velocityX: this.gameConfig.velocityX,
      velocityY: this.gameConfig.velocityY,
      leftPaddleStatus: 0,
      rightPaddleStatus: 0,
    }
    this.handleJoinRoom(sockets, roomName);
  }



  // 방에 들어갈 때 공통으로 처리해야 하는 함수
  handleJoinRoom(sockets: Socket[], roomName: string) {
    sockets.forEach(async socket => {
      //소켓 인덱스가 0 이면 오너는 true, 1이면 false
      this.RoomConnectedSocket.set(socket, roomName);
      const isOwner = sockets.indexOf(socket) === 0 ? true : false;
      socket.join(roomName);
      try {
        const payload = await this.getPayload(socket);
        this.userService.settingStatus(payload.username, 3);
      } catch(error) {
        console.log(error);
        return error;
      }
      console.log('roomName', roomName);
      console.log('socket.id', socket.id);
      socket.emit('ft_match_success', {
        success: true,
        roomName,
        isOwner,
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
    const sockets = this.gameRooms[roomName].sockets;
    this.gameRooms[roomName].maxScore = data.score;
    this.gameRooms[roomName].speedMode = data.speedMode;
    this.gameRooms[roomName].velocityX; // *= data.speed;
    this.gameRooms[roomName].velocityY; // *= data.speed;
    const remainingSocket = sockets.find(item => item !== socket);
    // 프론트에서 정의한 remainingSocket 에게 발생시킬 이벤트 함수 호출
    this.logger.log(`remainingSocket.id: ${remainingSocket.id}`);
    socket.to(roomName).emit('ft_game_setting_success', {
      success: true,
    })
  }

  // 준비 완료 수신
  // room에 소켓들이 모두 준비완료를 누르면 게임시작
  @SubscribeMessage('ft_game_ready')
  handleGameReady(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,) {
    this.logger.log(`Game 채널 ft_game_ready 호출`);
    console.log('roomName', roomName);
    socket.to(roomName).emit('ft_game_ready_success', {
      success: true,
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
    })
    await this.gameService.createGame(this.gameRooms[roomName].sockets[0].id, this.gameRooms[roomName].sockets[1].id);
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
    await clearInterval(gameRoom.timer);
    const winnerId = gameRoom.element.score.left === gameRoom.maxScore ? gameRoom.sockets[0].id : gameRoom.sockets[1].id;
    const loserId = gameRoom.element.score.left === gameRoom.maxScore ? gameRoom.sockets[1].id : gameRoom.sockets[0].id;
    const winner = await this.userService.getUserByGameSocketId(winnerId);
    const loser = await this.userService.getUserByGameSocketId(loserId);
    await this.gameService.finishGame(winner, loser);
    await this.userService.leaderScoreUpdate(winner, loser);
    const isOwnerWin = gameRoom.element.score.left === gameRoom.maxScore ? true : false;
    this.nsp.to(roomName).emit('ft_finish_game', { isOwnerWin });
    return await this.handleLeaveRoom(this.gameRooms[roomName].sockets, roomName);
  }

  // socket으로 부터 token을 받아서 payload 추출
  async getPayload(socket: Socket) {
    const token = await socket.handshake.auth.token;
    const serverConfig = config.get('jwt');
    const secret = serverConfig.secret;
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
