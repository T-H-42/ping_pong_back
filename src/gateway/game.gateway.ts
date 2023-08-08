import { Injectable, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as config from 'config';
import * as jwt from 'jsonwebtoken';
import { UserService } from 'src/user/user.service';
import { GameService } from 'src/game/game.service';

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
  velocityX: number
  velocityY: number
}

interface Score {
  left: number
  right: number
}

// Back -> front
interface GameElement {
  leftPaddle: Paddle,
  rightPaddle: Paddle,
  ball: Ball,
  score: Score,
}


// 게임 설정 인터페이스
interface GameInformation {
  sockets: Socket[];
  speed: number;
  score: number;
  timer: NodeJS.Timeout | null;
  element: GameElement | null;
}

interface ISettingInformation {
  score: number;
  speed: number;
  roomName: string;
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
  async handleDisconnect(socket: Socket) {
    let payload;
    try {
      payload = await this.getPayload(socket);
    } catch (error) {
      this.logger.error('fail GameGateway handleDisconnect', error);
    }
    await this.userService.disconnectGameSocket(payload?.username);
    this.matchQueue = await this.matchQueue.filter(item => item !== socket);

    // 세팅중에 끊긴 경우 room 삭제?
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
      speed: 0,
      score: 0,
      timer: null,
      element: null,
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
    // socket.leave(roomName);
    // remainingSocket.leave(roomName);
    delete this.gameRooms[roomName];
  }

  // 게임 설정
  @SubscribeMessage('ft_game_setting')
  handleGameSettingScore(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: ISettingInformation,) {
    this.logger.log(`Game 채널 ft_game_setting 호출`);
    this.logger.log(`data.score: ${data.score}, data.speed: ${data.speed}, data.roomName: ${data.roomName}`);
    const roomName = data.roomName;
    const sockets = this.gameRooms[roomName].sockets;
    this.gameRooms[roomName].speed = data.speed;
    this.gameRooms[roomName].score = data.score;
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
    this.gameRooms[roomName].element = await this.createElement(this.gameRooms[roomName].speed);
    const timer = setInterval(() => {
      this.positionUpdate(roomName);
    }, 20)
    this.gameRooms[roomName].timer = timer;
  }

  // 1972 pong 게임 속성 업데이트
  async positionUpdate(roomName: string) {
    //ball의 위치를 업데이트
    await this.ballUpdate(roomName);

    //Ball 충돌 감지 이벤트 호출
    await this.ballCollision(roomName);

    // 게임 끝났는지 확인
    const gameStatus = await this.gameScoreCheck(roomName);

    //ball의 위치를 전송
    if (gameStatus) {
      this.nsp.to(roomName).emit('ft_position_update', {
        GameElement: this.gameRooms[roomName].element
      })
    }
    // await this.sendPosition(roomName);
  }

  //paddle의 위치를 변경 감지 이벤트
  // paddleUpdate(roomName: string) {
  // }

  ballUpdate(roomName: string) {
    this.gameRooms[roomName].element.ball.x += this.gameRooms[roomName].element.ball.velocityX;
    this.gameRooms[roomName].element.ball.y += this.gameRooms[roomName].element.ball.velocityY;
  }

  ballCollision(roomName: string) {
    const ball = this.gameRooms[roomName].element.ball;
    const leftPaddle = this.gameRooms[roomName].element.leftPaddle;
    const rightPaddle = this.gameRooms[roomName].element.rightPaddle;

    if (ball.y - ball.radius < 0 || ball.y + ball.radius > 100) {
      this.gameRooms[roomName].element.ball.velocityY = -this.gameRooms[roomName].element.ball.velocityY;
    }

    //ball이 paddle에 부딪히면 부딪힌 각도에 따라 방향을 바꿈
    if (ball.x - ball.radius < leftPaddle.x + leftPaddle.width &&
      ball.y + ball.radius >= leftPaddle.y &&
      ball.y - ball.radius <= leftPaddle.y + leftPaddle.height) {
      const deltaY = ball.y - (leftPaddle.y + leftPaddle.height / 2);
      this.gameRooms[roomName].element.ball.velocityX = -this.gameRooms[roomName].element.ball.velocityX;
      this.gameRooms[roomName].element.ball.velocityY = deltaY * 0.1;  // 0.1은 부드러운 각도 조절 나중에 수정 필요
    }
    if (ball.x + ball.radius > rightPaddle.x &&
      ball.y + ball.radius >= rightPaddle.y &&
      ball.y - ball.radius <= rightPaddle.y + rightPaddle.height) {
      const deltaY = ball.y - (rightPaddle.y + rightPaddle.height / 2);
      this.gameRooms[roomName].element.ball.velocityX = -this.gameRooms[roomName].element.ball.velocityX;
      this.gameRooms[roomName].element.ball.velocityY = deltaY * 0.1;
    }

    //ball이 paddle을 넘어가면 score를 올림
    if (this.gameRooms[roomName].element.ball.x < 0) {
      this.gameRooms[roomName].element.score.right += 1;
      this.resetBallPosition(roomName);
    }
    if (this.gameRooms[roomName].element.ball.x > 100) {
      this.gameRooms[roomName].element.score.left += 1;
      this.resetBallPosition(roomName);
    }
  }

  // ball 위치 초기화
  resetBallPosition(roomName: string) {
    this.gameRooms[roomName].element.ball.x = 50;
    this.gameRooms[roomName].element.ball.y = 50;
    this.gameRooms[roomName].element.ball.velocityX = 2;
    this.gameRooms[roomName].element.ball.velocityY = 1;
  }

  // 게임이 끝났는지 확인
  gameScoreCheck(roomName: string) {
    const gameRoom = this.gameRooms[roomName];
    if (gameRoom.element.score.left === gameRoom.score || gameRoom.element.score.right === gameRoom.score) {
      clearInterval(this.gameRooms[roomName].timer);
      this.gameRooms[roomName].timer = null;
      this.gameRooms[roomName].element = null;
      return false;
    }
    return true;
  }

  // socket으로 부터 token을 받아서 payload 추출
  async getPayload(socket: Socket) {
    const token = await socket.handshake.auth.token;
    const serverConfig = config.get('jwt');
    const secret = serverConfig.secret;
    return await jwt.verify(token, secret) as any;
  }


  createElement(speed: number): GameElement {
    return {
      ball: {
        x: 45,
        y: 45,
        radius: this.gameConfig.radius,
        velocityX: this.gameConfig.velocityX * speed,
        velocityY: this.gameConfig.velocityY * speed,
      },
      leftPaddle: {
        x: 10,
        y: 30,
        width: this.gameConfig.paddleWidth,
        height: this.gameConfig.paddleHeight,
      },
      rightPaddle: {
        x: 80,
        y: 30,
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
