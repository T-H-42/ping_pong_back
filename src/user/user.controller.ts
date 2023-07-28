import { Body, Controller, Get, Post, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { UserService } from './user.service';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { User } from './user.entity';
import { GetUser } from './get-user.dacorator';
import { CertificateDto } from './dto/certificate.dto';
import { HttpService } from '@nestjs/axios'; //HttpModule
// import { TestDto } from './dto/test.dto';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}//, private readonly httpService: HttpService

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

  @Post('/signin')
  signin(@Body(ValidationPipe) loginDto: LoginDto, @Res() res: Response) {
    console.log('signin 프로토콜 start');
    return this.userService.signin(loginDto, res);
  }

  
  @Post('/certificate')
  certificateUser(@Body() certificateDto: CertificateDto, @Res() res: Response)
  {
    console.log("test_certificate");
    return this.userService.certificateUser(certificateDto, res);
  }

  @Get('/allfriend')
  @UseGuards(AuthGuard())
  getAllFriend(@GetUser() user: User): Promise<User[]> {
    return this.userService.findFriendList(user);
  }




  // @Get('/friend')
  // @UseGuards(AuthGuard())
  // findFriendList(@GetUser() user: User) {
  // 	return this.authService.findFriendList(user);
  // }

  ///ㄱㅣ조ㄴ의 쿼쿼리리문문입입니니다. (user.service)

  // async findFriendList(user: User) {
  // 	const query = this.userRepository.createQueryBuilder('user');
  // 	query
  // 		.leftJoin('user.friend_one', 'friend')
  // 		.leftJoin('user.friend_two', 'friend2')
  // 		.where('friend.status = true AND friend.user_two = :userId')
  // 		.orWhere('friend2.status = true AND friend2.user_one = :userId')
  // 		.setParameter('userId', user.id)
  // 		.select('user');

  // 	const result = await query.getRawMany();
  // 	return result;
  // }
}
