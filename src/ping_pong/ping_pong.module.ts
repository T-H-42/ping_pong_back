import { Module } from '@nestjs/common';
import { PingPongGateway } from './ping_pong.gateway';
import { UserModule } from 'src/user/user.module';
import { FriendService } from 'src/friend/friend.service';
import { FriendModule } from 'src/friend/friend.module';
// import { UserRepository } from 'src/user/user.repository';
// import { UserService } from 'src/user/user.service';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { JwtModule } from '@nestjs/jwt';
// import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [UserModule, FriendModule/*TypeOrmModule.forFeature([UserRepository]), JwtModule, HttpModule*/], // TypeOrmModule.forFeature([UserRepository]), JwtModule, HttpModule
  providers: [PingPongGateway/*,UserService, UserRepository*/], //UserService, UserRepository
})
export class PingPongModule {}
