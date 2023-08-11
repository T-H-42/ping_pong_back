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
  score: number;
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
  // User 배열을 담는 매칭 큐
  private matchQueue: Socket[] = [];


  // 게임 방들을 담는 배열
  private gameRooms: { [key: string]: GameInformation } = {};

  // 채널 입장
  async handleConnection(@ConnectedSocket() socket: Socket) {
    this.logger.log(`Game 채널 connect 호출`);
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
    }
    await this.userService.disconnectGameSocket(payload.username);
    this.matchQueue = await this.matchQueue.filter(item => item !== socket);
    const roomName = await Array.from(socket.rooms)[1];
    // room에 속해 있는 경우 처리
    this.logger.log(`과감한 interval 삭제`);
    if (roomName) {
      if (this.gameRooms[roomName].timer) { // 게임중
        //임시 처리
        clearInterval(this.gameRooms[roomName].timer);
        this.gameRooms[roomName].sockets[0].leave(roomName);
        this.gameRooms[roomName].sockets[1].leave(roomName);
        delete this.gameRooms[roomName];
      }
      else { // 세팅중
        socket.to(roomName).emit('ft_enemy_leave_setting_room', {
          username: payload.username,
          access: true,
        });
        this.gameRooms[roomName].sockets[0].leave(roomName);
        this.gameRooms[roomName].sockets[1].leave(roomName);
        delete this.gameRooms[roomName];
      }
    }
    // 세팅중에 끊긴 경우 세팅 room 삭제?
    // 게임중에 끊긴 경우 들어오면 이어서 하게?
    // 이 부분은 프론트와 상의 후 처리
  }

  // 매칭 큐에 유저를 넣는 함수
  @SubscribeMessage('ft_enter_match_queue')
  async enterMatchQueue(@ConnectedSocket() socket: Socket) {
    this.logger.log(`Game 채널 ft_enter_match_queue 호출`);
    try {
      const payload = await this.getPayload(socket);
    } catch (err) {
      this.logger.error('fail GameGateway enterMatchQueue', err);
    }

    // 근데 이건 프론트가 막아줘야지 두번 누른다고 두번 넣어주기 있기?
    // ft_exit_match_queue 를 아예 빼버려?
    if (this.matchQueue.includes(socket)) {
      console.log('이미 있음');
      return { success: false };
    }
    this.matchQueue.push(socket);
    if (this.matchQueue.length === 2) {
      const sockets = await this.matchQueue.splice(0, 2);
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

  // room 생성
  async createGameRoom(sockets: Socket[]) {
    this.logger.log(`Game 채널 createGameRoom 호출`);
    const roomName = await uuidv4();
    // 방 생성 & socket.join
    this.gameRooms[roomName] = {
      sockets: sockets,
      score: 1,
      timer: null,
      element: null,
      velocityX: this.gameConfig.velocityX,
      velocityY: this.gameConfig.velocityY,
      leftPaddleStatus: 0,
      rightPaddleStatus: 0,
    }
    sockets.forEach(socket => {
      //소켓 인덱스가 0 이면 오너는 true, 1이면 false
      const isOwner = sockets.indexOf(socket) === 0 ? true : false;
      socket.join(roomName);
      console.log('roomName', roomName);
      socket.emit('ft_match_success', {
        success: true,
        roomName,
        isOwner,
      });
    });
  }

  // room에서 소켓이 나가는 경우
  @SubscribeMessage('ft_leave_setting_room')
  async handleLeaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,) {
    this.logger.log(`Game 채널 ft_leave_setting_room 호출`);
    const sockets = await this.gameRooms[roomName].sockets;
    // 나간 유저 네임 추출
    const payload = await this.getPayload(socket);
    socket.to(roomName).emit('ft_enemy_leave_setting_room', {
      username: payload.username,
      access: true,
    });
    sockets[0].leave(roomName);
    sockets[1].leave(roomName);
    console.log('이제 삭제');
    delete this.gameRooms[roomName];
  }

  // 게임 설정
  @SubscribeMessage('ft_game_setting')
  handleGameSetting(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: ISettingInformation,) {
    this.logger.log(`Game 채널 ft_game_setting 호출`);
    this.logger.log(`data.score: ${data.score}, data.speed: ${data.speed}, data.roomName: ${data.roomName}`);
    const roomName = data.roomName;
    const sockets = this.gameRooms[roomName].sockets;
    this.gameRooms[roomName].score = data.score;
    this.gameRooms[roomName].velocityX *= data.speed;
    this.gameRooms[roomName].velocityY *= data.speed;
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
    }, 40)
    this.gameRooms[roomName].timer = timer;
  }

  // 게임 속성 업데이트
  // 게임 주요 로직 관리 부분
  async positionUpdate(roomName: string) {
    // ball의 위치를 업데이트
    await this.ballUpdate(roomName);

    // Ball 충돌 감
    await this.ballCollision(roomName);

    // 게임 점수 체크
    const gamefinished = await this.gameScoreCheck(roomName);

    // 객체 위치 정보 전송 일해라 프론트
    this.nsp.to(roomName).emit('ft_position_update', {
      GameElement: this.gameRooms[roomName].element
    })

    // 종료 조건 충족하면 게임 종료 
    if (gamefinished)
      this.finishGame(roomName);
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

  ballUpdate(roomName: string) {
    const gameRoom = this.gameRooms[roomName];
    gameRoom.element.ball.x += gameRoom.velocityX;
    gameRoom.element.ball.y += gameRoom.velocityY;

    if (gameRoom.leftPaddleStatus === 1) {
      gameRoom.element.leftPaddle.y -= this.gameConfig.paddleSpeed;
      if (gameRoom.element.leftPaddle.y < 0) {
        gameRoom.element.leftPaddle.y = 0;
      }
    }
    else if (gameRoom.leftPaddleStatus === 2) {
      gameRoom.element.leftPaddle.y += this.gameConfig.paddleSpeed;
      if (gameRoom.element.leftPaddle.y > 100 - gameRoom.element.leftPaddle.height) {
        gameRoom.element.leftPaddle.y = 100 - gameRoom.element.leftPaddle.height;
      }
    }
    if (gameRoom.rightPaddleStatus === 1) {
      gameRoom.element.rightPaddle.y -= this.gameConfig.paddleSpeed;
      if (gameRoom.element.rightPaddle.y < 0) {
        gameRoom.element.rightPaddle.y = 0;
      }
    }
    else if (gameRoom.rightPaddleStatus === 2) {
      gameRoom.element.rightPaddle.y += this.gameConfig.paddleSpeed;
      if (gameRoom.element.rightPaddle.y > 100 - gameRoom.element.rightPaddle.height) {
        gameRoom.element.rightPaddle.y = 100 - gameRoom.element.rightPaddle.height;
      }
    }
  }

  ballCollision(roomName: string) {
    const ball = this.gameRooms[roomName].element.ball;
    const leftPaddle = this.gameRooms[roomName].element.leftPaddle;
    const rightPaddle = this.gameRooms[roomName].element.rightPaddle;

    // 천장과 바닥 충돌 확인
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > 100) {
      this.gameRooms[roomName].velocityY = -this.gameRooms[roomName].velocityY;
    }

    //ball이 paddle에 부딪히면 부딪힌 각도에 따라 방향을 바꿈
    if (ball.x - ball.radius < leftPaddle.x + leftPaddle.width &&
      ball.y + ball.radius >= leftPaddle.y &&
      ball.y - ball.radius <= leftPaddle.y + leftPaddle.height) {
      const deltaY = ball.y - (leftPaddle.y + leftPaddle.height / 2);
      this.gameRooms[roomName].velocityX = -this.gameRooms[roomName].velocityX;
      this.gameRooms[roomName].velocityY = deltaY * 0.1;  // 0.1은 부드러운 각도 조절 나중에 수정 필요
    }
    if (ball.x + ball.radius > rightPaddle.x &&
      ball.y + ball.radius >= rightPaddle.y &&
      ball.y - ball.radius <= rightPaddle.y + rightPaddle.height) {
      const deltaY = ball.y - (rightPaddle.y + rightPaddle.height / 2);
      this.gameRooms[roomName].velocityX = -this.gameRooms[roomName].velocityX;
      this.gameRooms[roomName].velocityY = deltaY * 0.1;
    }
  }

  // 스코어 관리 및 종료 조건 확인 반환
  gameScoreCheck(roomName: string): boolean {
    const gameRoom = this.gameRooms[roomName];
    let gamefinished = false;

    //ball이 paddle을 넘어가면 score를 올림
    if (gameRoom.element.ball.x + gameRoom.element.ball.radius < gameRoom.element.leftPaddle.x) {
      gameRoom.element.score.right += 1;
      this.resetBallPosition(roomName, -1);
    }
    if (gameRoom.element.ball.x - gameRoom.element.ball.radius > gameRoom.element.rightPaddle.x + gameRoom.element.rightPaddle.width) {
      gameRoom.element.score.left += 1;
      this.resetBallPosition(roomName, 1);
    }

    // score가 설정값과 일치하면 게임 종료
    if (gameRoom.element.score.left === gameRoom.score || gameRoom.element.score.right === gameRoom.score) {
      return true;
    }
    return gamefinished;
  }

  // ball 위치 초기화
  resetBallPosition(roomName: string, direct: number) {
    this.gameRooms[roomName].element.ball.x = 45;
    this.gameRooms[roomName].element.ball.y = 45;
    this.gameRooms[roomName].velocityX = this.gameConfig.velocityX * direct;
    this.gameRooms[roomName].velocityY = this.gameConfig.velocityY;
  }

  async finishGame(roomName: string) {
    const gameRoom = this.gameRooms[roomName];
    clearInterval(gameRoom.timer);
    const winner = gameRoom.element.score.left === gameRoom.score ? gameRoom.sockets[0].id : gameRoom.sockets[1].id;
    const loser = gameRoom.element.score.left === gameRoom.score ? gameRoom.sockets[1].id : gameRoom.sockets[0].id;
    await this.gameService.finishGame(winner, loser);
    this.nsp.to(roomName).emit('finishGame', { msg: '게임 끝났어요' });
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
        x: 45,
        y: 45,
        radius: this.gameConfig.radius,
      },
      leftPaddle: {
        x: 0,
        y: 40,
        width: this.gameConfig.paddleWidth,
        height: this.gameConfig.paddleHeight,
      },
      rightPaddle: {
        x: 100 - this.gameConfig.paddleWidth,
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
