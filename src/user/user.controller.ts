import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  Response as CResponse,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  Header,
  Headers,
  Req,
  BadRequestException,
} from '@nestjs/common';
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
import { FileInterceptor } from '@nestjs/platform-express';
import { brotliCompress } from 'zlib';

///!!!!RESTful -> no verb,method use noun.

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {} //, private readonly httpService: HttpService

  @Post('/adminSignin')
  adminSignIn(@Body() data:{username: string}, @Res() res: Response) {
    console.log(`adminSignin 프로토콜 start ${data.username}`);
    return this.userService.adminSignIn(data.username, res);
  }

  @Post('/signin')
  signIn(@Body(ValidationPipe) loginDto: LoginDto, @Res() res: Response) {
    console.log('signin 프로토콜 start');
    return this.userService.signIn(loginDto, res);
  }

  @Post('/certificate')
  certificateUser(
    @Body() certificateDto: CertificateDto,
    @Res() res: Response,
  ) {
    console.log('test_certificate');
    return this.userService.certificateUser(certificateDto, res);
  }

  // @Get('/allfriend')
  // @UseGuards(AuthGuard())
  // getAllFriend(@GetUser() user: User): Promise<User[]> {
  //   return this.userService.findFriendList(user);
  // }

  @Get('/profile')
  @UseGuards(AuthGuard())
  async getUserProfile(@Query('username') username?: string) {
    if (!username) {
      throw new BadRequestException('프로파일 요청 시 유저의 이름에 대한 정보가 필요합니다.');
    }
    return await this.userService.getUserProfile(username);
  }

  @UseInterceptors(FileInterceptor('image'))
  @Post('/profile/upload')
  @UseGuards(AuthGuard())
  async uploadProfileImage(
    @GetUser() user: User,
    @UploadedFile() image: Express.Multer.File,
  ) {
    return await this.userService.uploadProfileImage(user.username, image);
  }

  @Post('/nickname')
  @UseGuards(AuthGuard())
  async changeNickname(
    @GetUser() user: User,
    @Body() body: { nickname: string },
    @Res() res: Response,
  ) {
    if (!body?.nickname) {
      throw new BadRequestException('닉네임을 입력해주세요');
    }
    return await this.userService.changeNickname(user, body?.nickname, res);
  }

  @Get('/token_validation')
  async tokenValidation(@Headers('authorization') token: string) {
    const jwtToken = token.split(' ')[1];
    //const token = body.token;
    console.log(jwtToken);

    return await this.userService.tokenValidation(token);
  }
}
