import {
  BadRequestException,
  Body,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { UserRepository } from './user.repository';
import { JwtService } from '@nestjs/jwt';
import { Response, query } from 'express';
import { User } from '../entity/user.entity';
import * as crypto from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';
import { CertificateDto } from './dto/certificate.dto';
import { catchError, firstValueFrom } from 'rxjs';
import axios, { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import * as config from 'config';
import { Any } from 'typeorm';
import { Socket } from 'dgram';
import { createReadStream } from 'fs';
import path from 'path';
import { JwtStrategy } from './jwt.strategy';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private mailService: MailerService,
    private readonly httpService: HttpService,
  ) {}

  async tokenValidation(token: string) {
    try {
      await jwt.verify(token, 'secret1234');
      return true;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async signIn(loginDto: LoginDto, res: Response) {
    const { code } = loginDto;
    console.log('code', code);
    //findOne
    // console.log("test not loged in");
    /////---------------------------- for test except 42 auth----------------------------
    const oauthConfig = config.get('oauth');
    console.log(
      '======================================== sigin in ===============================',
    );
    console.log('redir', oauthConfig.oauth_redirect_uri);
    const url = `https://api.intra.42.fr/oauth/token?grant_type=authorization_code&client_id=${oauthConfig.oauth_id}&client_secret=${oauthConfig.oauth_secret}&code=${code}&redirect_uri=${oauthConfig.oauth_redirect_uri}`; //http://10.19.210.104:3000/redirect;
    const { data } = await firstValueFrom(
      this.httpService.post(url).pipe(
        catchError((error: AxiosError) => {
          if (error.response) {
            console.log('test signin');
            throw new HttpException(error.response.data, error.response.status);
          } else {
            console.log('이 로그가 찍히면 42서버가 문제');
            console.log(error);
            throw new InternalServerErrorException();
          }
        }),
      ),
    );
    console.log(
      '======================================== sigin in2 ===============================',
    );
    const headers = {
      Authorization: `Bearer ${data.access_token}`,
    };
    console.log(data.access_token);
    const _url = 'https://api.intra.42.fr/v2/me';
    const response = await firstValueFrom(
      this.httpService.get(_url, { headers }).pipe(
        catchError((error: AxiosError) => {
          if (error.response)
            throw new HttpException(error.response.data, error.response.status);
          else throw new InternalServerErrorException();
        }),
      ),
    );
    /////---------------------------- for test except 42 auth----------------------------

    // console.log("========");
    // console.log('response username ', response.data.login);
    // console.log("========");

    let user = await this.userRepository.findOne({
      where: {
        intra_id: response.data.login,
      },
    });
    if (!user) {
      console.log("user doesn't exist");
      // <<<<<<< HEAD
      //       const _user = await this.userRepository.createUser(response.data.login, response.data.email);
      //       //////////////////////add///////////////////
      //       const payload = {
      //         username: _user.username,
      //         id: _user.id,
      //       };

      //       const accessToken = await this.jwtService.sign(payload);
      //       //////////////////////add///////////////////
      //       const _res = await this.setToken(_user, res);
      //       return (await _res).send({two_factor_authentication_status:false, username: _user.username,accessToken})
      //     }

      // =======
      const _user = await this.userRepository.createUser(
        response.data.login,
        response.data.email,
      );
      const _res = await this.setToken(_user, res);
      user = await this.userRepository.findOne({
        where: {
          intra_id: response.data.login,
        },
      });
    }
    // >>>>>>> develop
    //////////////////////add///////////////////
    const payload = {
      username: user.username,
      id: user.id,
    };
    console.log('===========');
    console.log(user);
    console.log('===========');

    const accessToken = await this.jwtService.sign(payload);
    //////////////////////add///////////////////
    console.log('===========');
    console.log(accessToken);
    console.log('===========');

    if (user.two_factor_authentication_status === true) {
      // await this.sendMail(loginDto);
      console.log('user exist');
      await this.sendMail(user.username);
      return res.send({
        two_factor_authentication_status: true,
        username: user.username,
        // accessToken,
      });
    }

    ////////////////////////////////////////////////////////////////////////////////////
    const responseWithToken = await this.setToken(user, res);
    // console.log(responseWithToken); ///리턴 전 객체의 jwt가 있으면 토큰 세팅이 되어 있는 상홤.
    return responseWithToken.send({
      two_factor_authentication_status: false,
      username: user.username,
      accessToken,
    });
    //origin response
    //return responseWithToken.send({two_factor_authentication_status:false, username: user.username});
  }

  async setToken(user: User, res: Response) {
    const payload = {
      username: user.username,
      id: user.id,
    };

    const accessToken = await this.jwtService.sign(payload);
    await res.setHeader('Authorization', 'Bearer ' + accessToken);
    res.cookie('jwt', accessToken);
    console.log('~~~~~~~~토큰 발급 ', accessToken);
    return res;
    // return res.send();
  }

  async sendMail(username: string) {
    const digits = 6;
    const buffer = crypto.randomBytes(digits);
    const randomValue = parseInt(buffer.toString('hex'), 16);
    const randomCode = randomValue % 10 ** digits;
    console.log(randomCode);

    // const username = loginDto.username;
    const user = await this.userRepository.findOne({ where: { username } });
    const email = user.email;

    await this.mailService.sendMail({
      from: `"sendMail" <42-Ping-Pong@42.com>`,
      to: `${email}`,
      subject: '2차 인증 코드를 입력',
      text: `인증 코드: ${randomCode < 100000 ? randomCode * 10 : randomCode} `,
    });
    user.two_factor_authentication_code = randomCode;
    return this.userRepository.save(user);
  }

  async certificateUser(certificateDto: CertificateDto, res: Response) {
    const { username, two_factor_authentication_code } = certificateDto;
    const user = await this.userRepository.findOne({ where: { username } });

    if (
      user.two_factor_authentication_code === two_factor_authentication_code
    ) {
      // console.log("2way_auth_user", user);
      const test = await this.setToken(user, res);
      const payload = {
        username: user.username,
        id: user.id,
      };
      const accessToken = await this.jwtService.sign(payload);
      // <<<<<<< HEAD
      //       return test.send({accessToken});
      //     }
      //     else {
      //       console.log("2way_auth_user ::: fail token");
      // =======
      //////////add_for_another_com///////

      return test.send({ accessToken });
      // return this.setToken(user.username, res);
    } else {
      console.log('2way_auth_user ::: fail token');
      // >>>>>>> develop
      throw new UnauthorizedException('failed auth_code for 2Auth user');
    }
  }

  async connectPingPongSocket(username: string, socketid: string) {
    //connectPingPongSocket
    //connectPingPongSocket
    await this.userRepository.update(
      { username: username },
      { socketid: socketid, status: 1 },
    );
  }

  async connectChatSocket(username: string, socketid: string) {
    //connectChatSocket
    const query = `update "user" set "chat_sockid"='${socketid}' where "username"='${username}'`;
    await this.userRepository.query(query);
  }

  async connectGameSocket(username: string, socketid: string) {
    //connectGameSocket
    const query = `update "user" set "game_sockid"='${socketid}' where "username"='${username}'`;
    await this.userRepository.query(query);
  }

  async disconnectGameSocket(username: string | undefined) {
    //if (!username) {
    //  return;
    //}
    await this.userRepository.update({ username }, { game_sockid: null });
  }

  async getUserByUserName(username: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: {
        username: username,
      },
    });
    return user;
  }

  async disconnectPingPongSocket(username: string) {
    await this.userRepository.update(
      { username },
      { socketid: null, status: 0, chat_sockid: null },
    ); //gamesocketid 또한 null로 바꾸는 기능 필요합니다.
  }

  async disconnectChatSocket(username: string) {
    await this.userRepository.update({ username }, { chat_sockid: null });
    const user = await this.getUserByUserName(username);
    // console.log("test in disconnect");
    // console.log(user);
    // console.log("test in disconnect");
    const query = `delete from "chat_user" where "user_id"=${user.id};`; ///delete chat_user에서 일치하는 것 전부 삭제
    await this.userRepository.query(query);
    // dm은 삭제가 안되더라도, 일반 채팅방일 경우 삭제하면 owner에 대한 처리 어떻게 할지?
    // 혹은 방을 터트릴지... 이런거 다 생각하긴 해야함.
  }

  async getUserByPingPongSocketId(id: number) {
    const query = `select "socketid" from "user" where socketid = ${id};`;
    return await this.userRepository.query(query);
  }

  async getUserNameByChatSockId(chat_socketid: string) {
    const query =
      await `select "username" from "user" where "chat_sockid" = '${chat_socketid}';`;
    console.log('in chat_getusername');
    console.log(query);
    console.log('in chat_getusername');
    return await this.userRepository.query(query);
  }

  async getChatSocketByUserName(username: string) {
    const query =
      await `select "chat_sockid" from "user" where "username" = '${username}';`;
    return await this.userRepository.query(query);
  }

  async getUserProfile(username: string) {
    const user = await this.userRepository.query(
      `select id, username, status, ladder_lv, image_url from "user" where "username" = '${username}';`,
    );
    const userAchievement = await this.userRepository.query(
      `select achievement from achievement where user_id = ${user[0].id};`,
    );
    const userGameHistory = await this.userRepository.query(
      `select winner, loser, time from game where (game.finished and (game.winner = ${user[0].id} or game.loser = ${user[0].id}));`,
    );
    const userProfile = await {
      ...user[0],
      achievements: [] as string[],
      userGameHistory,
    };
    await userAchievement.map((achievement) =>
      userProfile.achievements.push(achievement.achievement),
    );
    return await userProfile;
  }

  async uploadProfileImage(username: string, image: Express.Multer.File) {
    if (!image) {
      throw new BadRequestException();
    }
    const imageUpdate = await this.userRepository.updateProfileImage(
      username,
      image.filename,
    );
    if (!imageUpdate.affected) throw new UnauthorizedException();
    return 'succeed';
  }

  async changeNickname(user:User, nickname: string, res: Response) {
    if (user.intra_id !== nickname) {
      const oath = config.get('oauth');
      const token = await axios
        .post('https://api.intra.42.fr/oauth/token', {
          grant_type: 'client_credentials',
          client_id: oath.oauth_id,
          client_secret: oath.oauth_secret,
        })
        .then((res) => {
          return res.data.access_token;
        });
      const res = await axios
        .get(`https://api.intra.42.fr/v2/users/${nickname}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        .then((res) => {
          return '닉네임은 다른 사람의 intraID로 생성 불가능합니다.';
        })
        .catch((error) => {
          return '';
        });
      if (res) {
        throw new BadRequestException(
          '닉네임은 다른 사람의 intraID로 생성 불가능합니다.',
        );
      }
    }
    let nicknameUpdate;
    try{
        nicknameUpdate = await this.userRepository.updateUsername(
        nickname,
        user.intra_id,
        )
      }
      catch(error) { // 중복된 닉네임일 경우 해당 에러 객체로 오류 처리
        if (error.code === '23505')
          throw new BadRequestException('이미 있는 닉네임 입니다.');
      };
      if (!nicknameUpdate.affected) { // 영향 안받았으면 updqte 안된거임
        throw new InternalServerErrorException('Something went wrong!!!');
      }
    user.username = nickname;
    console.log("user!!!!!!!!!!");
    console.log(user);
    console.log("user!!!!!!!!!!");

    const _res = await this.setToken(user, res);
    console.log("user!!!!!!!!!!");
    console.log(_res);
    console.log("user!!!!!!!!!!");

    return (_res.send());
    
    // return 'succeed';
  }
}
