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

///!!!!RESTful -> no verb,method use noun.

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {} //, private readonly httpService: HttpService

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
  async getUserProfile(@Query('username') username: string) {
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

  @Get('/token_validation')
  async tokenValidation(@Headers('authorization') token : string)
  {
    const jwtToken = token.split(' ')[1];
    //const token = body.token;
    console.log(jwtToken);
    
    return await this.userService.tokenValidation(token);
  }  
}
