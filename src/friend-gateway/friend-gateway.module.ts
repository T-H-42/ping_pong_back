import { Module } from '@nestjs/common';
import { FriendGatewayGateway } from './friend-gateway.gateway';
import { UserModule } from 'src/user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from 'src/user/user.service';
import { UserRepository } from 'src/user/user.repository';
import { JwtModule } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [UserModule, TypeOrmModule.forFeature([UserRepository]), JwtModule, HttpModule],
  providers: [FriendGatewayGateway, UserService, UserRepository], //UserRepository
})
export class FriendGatewayModule {}
