import { HttpException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { UserRepository } from './user.repository';
import { JwtService } from '@nestjs/jwt';
import { Response, query } from 'express';
import { User } from './user.entity';
import * as crypto from 'crypto';
import { MailerService } from '@nestjs-modules/mailer';
import { CertificateDto } from './dto/certificate.dto';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { HttpService } from '@nestjs/axios';
import * as config from 'config';
import { Any } from 'typeorm';
import { Socket } from 'dgram';

@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private jwtService: JwtService,
    private mailService: MailerService,
    private readonly httpService: HttpService
  ) { }

// @Post('/login')
  // async login(@Body() testDto: TestDto) {
  //   const { code } = testDto;
  //   console.log('code = ',code);
  //   const url = `https://api.intra.42.fr/oauth/token?grant_type=authorization_code&client_id=u-s4t2ud-801649286a9bd1a88b32e7f924abb1e0439fff57438b05157c59b7a6ef8c98a1&client_secret=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&code=${code}&redirect_uri=http://10.15.1.6:3000/redirect`;

  //   const { data } = await firstValueFrom(
  //     this.httpService.post(url).pipe(
  //       catchError((error:AxiosError) => {
  //         throw 'An error happend!';
  //       })
  //     )
  //   )
  //   // const response = this.httpService.axiosRef.post(url);
  //   console.log('accessToken = ', data); //response(asis)

  //   return data;
  //   // return this.httpService.post(`https://api.intra.42.fr/oauth/token?grant_type=authorization_code&client_id=u-s4t2ud-801649286a9bd1a88b32e7f924abb1e0439fff57438b05157c59b7a6ef8c98a1&client_secret=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&code=${code}&redirect_uri=http://10.15.1.6:3000/redirect`);
  // }

  async signin(loginDto: LoginDto, res: Response) {
    const { code } = loginDto;
    //findOne
    // console.log("test not loged in");
    const oauth_config = config.get('oauth');
    console.log('======================================== sigin in ===============================');
    console.log('redir', oauth_config.oauth_redirect_uri);
    const url = `https://api.intra.42.fr/oauth/token?grant_type=authorization_code&client_id=u-s4t2ud-801649286a9bd1a88b32e7f924abb1e0439fff57438b05157c59b7a6ef8c98a1&client_secret=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&code=${code}&redirect_uri=${oauth_config.oauth_redirect_uri}`; //http://10.19.210.104:3000/redirect;
    const { data } = await firstValueFrom(
      this.httpService.post(url).pipe(
        catchError((error:AxiosError) => {
          if (error.response)
          {
            console.log("test signin");
            throw new HttpException(error.response.data, error.response.status);
          }
          else
            throw new InternalServerErrorException();
        })
      )
    )
    const headers = {
      Authorization: `Bearer ${data.access_token}`,
    };
    const _url = 'https://api.intra.42.fr/v2/me';
    const response = await firstValueFrom(
      this.httpService.get(_url, { headers }).pipe(
        catchError((error:AxiosError) => {
          if (error.response)
            throw new HttpException(error.response.data, error.response.status);
          else
            throw new InternalServerErrorException();
        })
      )
    )
    console.log("========");
    // console.log('response username ', response.data.login);
    console.log("========");

    const user = await this.userRepository.findOne({
      where: {
        username: response.data.login
      },
    });
    // console.log("test not loged in2");

    if (!user) {
      console.log("test1");

      const _user = await this.userRepository.createUser(response.data.login, response.data.email);
      const _res = await this.setToken(_user, res);
      return (await _res).send({two_factor_authentication_status:false, username: _user.username})
    }
    if (user.two_factor_authentication_status===true) {
      // await this.sendMail(loginDto);
      console.log("test2");
      await this.sendMail(user.username);
      return res.send({two_factor_authentication_status:true, username: user.username});
    }
    ////////////////////////////////////////////////////////////////////////////////////
    console.log("test3");
    const test = await this.setToken(user, res);
    // console.log(test); ///리턴 전 객체의 jwt가 있으면 토큰 세팅이 되어 있는 상홤.
    return test.send({two_factor_authentication_status:false, username: user.username});
    // return test.send();
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
    // return res.send();n
  }


  async sendMail(username: string) {
    // const {username, email} = loginDto;
    // const username = loginDto.username;
    const digits = 6;
    const buffer = crypto.randomBytes(digits);
    const randomValue = parseInt(buffer.toString('hex'), 16);
    const randomCode = randomValue % (10 ** digits);
    console.log(randomCode);

    // const username = loginDto.username;
    const user = await this.userRepository.findOne({ where: { username } });
    const email = user.email;
    console.log("test?");
    console.log(email);

    await this.mailService.sendMail({
      from: `"맘스터치 다스킴" <42-Ping-Pong@42.com>`,
      to: `${email}`,
      subject: '2차 인증 코드를 입력',
      text: `인증 코드: ${randomCode}`
    });
    console.log("test_email");

    user.two_factor_authentication_code = randomCode;
    return this.userRepository.save(user);
  }

  async certificateUser(certificateDto: CertificateDto, res: Response) {
    const { username, two_factor_authentication_code } = certificateDto;
    const user = await this.userRepository.findOne({where: {username}})

    if (user.two_factor_authentication_code === two_factor_authentication_code) {
      console.log("ㅁㅏㅈ느ㄴ지?");
      const test = await this.setToken(user, res);
      // console.log("==========");
      // console.log(test);
      // console.log("==========");
      // console.log("=------------=");
      // console.log(res);
      // console.log("=------------=");
      // console.log(test);
      return test.send();
      // return this.setToken(user.username, res);
    }
    else {
      console.log("fail token");
      throw new UnauthorizedException('failed auth_code');
    }
  }


  async connectSocket(username: string, socketid: string) {
    await this.userRepository.update(
      { username: username },
      { socketid: socketid, status: 1 },
    );
  }

  async connect_chat_Socket(username: string, socketid: string) {
    // console.log('123123');
    // await this.userRepository.update(
    //   { username: username },
    //   { chat_sockid: socketid },
    // );
    const query = `update "user" set "chat_sockid"='${socketid}' where "username"='${username}'`;
    await this.userRepository.query(query);
  }

  async getFriendSocket(username: string): Promise<string[]> {

    //유저네임으로 유저객체찾는 함수 호출
    /////////////////////07.14/////////////
    // const user = await this.getUserByUsername(username);
    // // const query =
    // const query = this.userRepository.createQueryBuilder('user');
    // query
    //   .leftJoin('user.send_friend', 'send_id')
    //   .leftJoin('user.recv_friend', 'recv_id')
    //   .where('send_id.accecpt = true AND user.socketid is not null AND send_id.recv_id = :userId')
    //   .orWhere('recv_id.accecpt = true AND user.socketid is not null AND recv_id.send_id = :userId')
    //   .setParameter('userId', user.id)
    //   .select('user.socketid');
    // console.log(query.getRawMany);
    // return query.getRawMany();
    /////////////////////07.14/////////////
    const user = await this.userRepository.findOne({
      where: {
        username
      }})
    if (!user)
    {
      console.log("???????????????????????????????????????");
      console.log("???????????????????????????????????????");
    }
    const friend_list = await this.findFriendList(user);

    const friendSocketList:string[] = [];
    friend_list.map((friend) => {
      // console.log(friend);
      if (friend.socketid !== null) {
        friendSocketList.push(friend.socketid);
      }
    });
    // console.log(friendSocketList);
    return friendSocketList;




    //console.log("result!!!!!!!!!" + JSON.stringify(result));
  }//이거는 업데이트가 아니니레포지토리에서는 정의할필요없어보입니다.

  async getUserByUsername(username: string): Promise<User> {

    const user = await this.userRepository.findOne({
      where:
      {
        username: username
      }
    })
    return user;
  }

  async disConnectSocket(username: string) {
    await this.userRepository.update({ username }, { socketid: null, status: 0 ,chat_sockid: null });//gamesocketid 또한 null로 바꾸는 기능 필요합니다.
  }

  async disConnect_chat_Socket(username: string) {
    await this.userRepository.update({ username }, { chat_sockid: null });
  }

  async findFriendList(user: User): Promise<User[]> {
    const query = `select * from (select case when ${user.id} = "friend"."sendIdId" then "friend"."recvIdId" else "friend"."sendIdId" end as f_id from "friend"
    where (${user.id} = "friend"."sendIdId" and "friend"."accecpt" = true) or (${user.id} = "friend"."recvIdId" and "friend"."accecpt" = true)) as "F" left join "user" on "user"."id" = "F"."f_id";`
    const result = await this.userRepository.query(query);
    // console.log("============fr==========");
    // console.log(result);
    // console.log("============fr==========");

    return result;
  }

  //
  /*
  {
    f_id : 4,
    id : 4,
    ladder_lv : 1000,
    status : 1,
    two_factor_auth : true,
    sockid_pingpong : ~!#$@#!$#@ddfd,
    sockid_chat : %@#$%$,
    sockid_game : !@#$%#$,
    image_url : http://~~~~~,
    two_factor_authentication_code : 123456
    username : "hyna",
  }
  f_id 는 id와 같습니다.
  */ 


  //유저네임 받아서 유저 객체 리턴해주는
  async addFriend( my_id: number , friend_id:number)
  {
    const query = `insert into "friend"("sendIdId", "recvIdId", accecpt) values (${my_id}, ${friend_id}, 'false')`;
    // const result = await this.userRepository.query(query);
    const result = await this.userRepository.query(query);
  }

  async getUserSocketId(id: number) {
    const query = `select "socketid" from "user" where socketid = ${id};`;
    return await this.userRepository.query(query);
  }

  async acceptFriend(payloadID: number, dataID: number) {
    const query = `update "friend" set "accecpt" = 'true' where "sendIdId" = ${payloadID} and "recvIdId" = ${dataID};`
    await this.userRepository.query(query);
    //update "friend" set "accecpt" = 'true' where "sendIdId" = ${payload.id} and "recvIdId" = ${data.id};
  }

  async chat_GetUserName(chat_socketid: string) {
    const query = await `select "username" from "user" where "chat_sockid" = '${chat_socketid}';`;
    console.log("in chat_getusername");
    console.log(query);
    console.log("in chat_getusername");
    return await this.userRepository.query(query);
  }

}

