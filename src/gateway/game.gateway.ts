import { Injectable, Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as config from 'config';
import * as jwt from 'jsonwebtoken';
import { UserService } from 'src/user/user.service';
import { GameService } from 'src/game/game.service';

// 게임 설정 인터페이스
interface GameSetting {
  sockets: Socket[];
  speed: number;
  score: number;
  timer: NodeJS.Timeout | null;
}


interface Paddle {
  x: number
  y: number
  width: number
  height: number
  color: string
  score: number
}

interface Ball {
  x: number
  y: number
  radius: number
  speed: number
  velocityX: number
  velocityY: number
  color: string
}

// Back -> front
interface GameElement {
  leftPaddle: Paddle,
  rightPaddle: Paddle,
  ball: Ball,
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
  private gameRooms: { [key: string]: GameSetting } = {};

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
    }
    sockets.forEach(socket => {
      //소켓 인덱스가 0 이면 오너
      socket.join(roomName);
      socket.emit('ft_match_success', {
        success: true,
        roomName,
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
    console.log('dho dksehosirh tq',this.gameRooms[roomName].sockets);
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

  // 게임 정보를 주기적으로 프론트에게 전달
  @SubscribeMessage('ft_game_play')
  handleGameStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() roomName: string,) {
    const timer = setInterval(() => {
      this.sendPosition(roomName);
    }, 20)
    this.gameRooms[roomName].timer = timer;
  }

  @SubscribeMessage('ft_send_position')
  sendPosition(roomName: string) {
    //....
  }
  // socket으로 부터 token을 받아서 payload 추출
  async getPayload(socket: Socket) {
    const token = await socket.handshake.auth.token;
    const serverConfig = config.get('jwt');
    const secret = serverConfig.secret;
    return await jwt.verify(token, secret) as any;
  }

}
