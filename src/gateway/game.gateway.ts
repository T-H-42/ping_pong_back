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
    await this.userService.disconnectGameSocket(payload.username);
    // matchQueue 에서 socket 제거
    this.matchQueue = await this.matchQueue.filter(item => item !== socket);

    // 게임중에 끊긴 경우
    // 세팅중에 끊긴 경우
    // 이 부분은 프론트와 상의 후 처리
  }

  // 매칭 큐에 유저를 넣는 함수
  @SubscribeMessage('ft_enter_match_queue')
  async enterMatchQueue(@ConnectedSocket() socket: Socket) {
    this.logger.log(`Game 채널 ft_enter_match_queue 호출`);
    this.matchQueue.push(socket);
    if (this.matchQueue.length === 2) {
      const sockets = await this.matchQueue.splice(0, 2);
      this.createGameRoom(sockets);
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
      sockets,
      speed: 0,
      score: 0,
      timer: null,
      element: null,
    }
    sockets.forEach(socket => {
      //소켓 인덱스가 0 이면 오너는 true, 1이면 false
      const isOwner = sockets.indexOf(socket) === 0 ? true : false;
      socket.join(roomName);
      socket.emit('ft_match_success', {
        success: true,
        roomName,
        isOwner,
      });
    });
  }

  // room에서 소켓이 나가는 경우
  @SubscribeMessage('ft_leave_setting_room')
  handleLeaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,) {
    this.logger.log(`Game 채널 ft_leave_setting_room 호출`);
    const sockets = this.gameRooms[roomName].sockets;
    socket.leave(roomName);
    // 룸에 남아있는 다른 소켓 추출
    const remainingSocket = sockets.find(item => item !== socket);
    // 프론트에서 정의한 remainingSocket 에게 발생시킬 이벤트 함수 호출
    // 나머지 소켓에서 상대가 나갔음을 감지할 이벤트
    this.nsp.to(roomName).emit('ft_enemy_leave_setting_room', {
      access: true,
    });
    remainingSocket.leave(roomName);
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
    if (roomName === undefined) {
      return { success: false };
    }
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
    const sockets = this.gameRooms[roomName].sockets;
    const remainingSocket = sockets.find(item => item !== socket);
    // 프론트에서 정의한 remainingSocket 에게 발생시킬 이벤트 함수 호출 
    socket.to(roomName).emit('ft_game_ready_success', {
      success: true,
    })
  }

  // ft_game_play 이벤트를 받으면 게임 시작 , 한번만 실행 되어야 함
  // 게임 시작
  // 게임 관련 데이터 초기화 진행
  // 일정 주기 마다 속성들을 업데이트 할 수 있도록 타이머를 설정
  @SubscribeMessage('ft_game_play')
  handleGameStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,) {
    this.logger.log(`Game 채널 ft_game_play 호출`);
    //game table에 데이터 저장
    this.gameService.createGame(this.gameRooms[roomName].sockets[0].id, this.gameRooms[roomName].sockets[1].id);
    this.gameRooms[roomName].element = this.createElement();
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

    //ball의 위치를 전송
    await this.sendPosition(roomName);
  }

  //paddle의 위치를 변경 감지 이벤트
  paddleUpdate(roomName: string) {
  }
  
  ballUpdate(roomName: string) {
    //현재 gameRoom의 Game element ball의 위치를 갱신
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

  // ball 위치 전송
  sendPosition(roomName: string) {
    this.nsp.to(roomName).emit('ft_send_position', {
      ball: this.gameRooms[roomName].element.ball,
      leftPaddle: this.gameRooms[roomName].element.leftPaddle,
      rightPaddle: this.gameRooms[roomName].element.rightPaddle,
      score: this.gameRooms[roomName].element.score,
    })
  }


  // socket으로 부터 token을 받아서 payload 추출
  async getPayload(socket: Socket) {
    const token = await socket.handshake.auth.token;
    const serverConfig = config.get('jwt');
    const secret = serverConfig.secret;
    return await jwt.verify(token, secret) as any;
  }


  createElement() : GameElement {
    return {
      ball: {
        x: 45,
        y: 45,
        radius: 5,
        velocityX: 2,
        velocityY: 1,
      },
      leftPaddle: {
        x: 10,
        y: 30,
        width: 10,
        height: 40,
      },
      rightPaddle: {
        x: 80,
        y: 30,
        width: 10,
        height: 40,
      },
      score: {
        left: 0,
        right: 0,
      }
    }
  }
}
