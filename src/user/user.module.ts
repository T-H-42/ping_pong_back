import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { JwtModule, JwtService } from '@nestjs/jwt';
import * as config from 'config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtStrategy } from './jwt.strategy';
import { AuthOptionsFactory, PassportModule } from '@nestjs/passport';
import { MailerModule } from '@nestjs-modules/mailer';
import { HttpModule } from '@nestjs/axios'; //HttpService



@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      maxRedirects : 5,
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: config.get('jwt').secret,
      signOptions: {
        expiresIn: 60 * 600,
      },
    }),
    TypeOrmModule.forFeature([UserRepository]),
    MailerModule.forRoot({
      transport:{
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user:'wkddlstn132@gmail.com',
          pass: 'jemndcujhaldsknv',
          method: 'PLAIN',
        }
      }
    }),
  ],
  controllers: [UserController],
  providers: [UserService, UserRepository, JwtStrategy,],//HttpService
  exports: [UserService, TypeOrmModule, JwtStrategy, HttpModule, JwtModule, TypeOrmModule.forFeature([UserRepository]),],//HttpService
})
export class UserModule {}
