import { Body, Controller, Get, Post, Res, UseGuards, ValidationPipe } from '@nestjs/common';
import { UserService } from './user.service';
import { LoginDto } from './dto/login.dto';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { User } from '../entity/user.entity';
import { GetUser } from './get-user.dacorator';
import { CertificateDto } from './dto/certificate.dto';
import { HttpService } from '@nestjs/axios'; //HttpModule
// import { TestDto } from './dto/test.dto';
import { catchError, firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

///!!!!RESTful -> no verb,method use noun. 


@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}//, private readonly httpService: HttpService


  @Post('/signin')
  signIn(@Body(ValidationPipe) loginDto: LoginDto, @Res() res: Response) {
    console.log('signin 프로토콜 start');
    return this.userService.signIn(loginDto, res);
  }

  
  @Post('/certificate')
  certificateUser(@Body() certificateDto: CertificateDto, @Res() res: Response)
  {
    console.log("test_certificate");
    return this.userService.certificateUser(certificateDto, res);
  }

  // @Get('/allfriend')
  // @UseGuards(AuthGuard())
  // getAllFriend(@GetUser() user: User): Promise<User[]> {
  //   return this.userService.findFriendList(user);
  // }




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
