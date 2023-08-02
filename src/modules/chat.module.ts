import { Module } from '@nestjs/common';
import { UserModule } from 'src/modules/user.module';
import { ChatGateway } from '../gateway/chat.gateway';
import { ChatRoomModule } from 'src/chat_room/chat_room.module';
// import { UserService } from 'src/user/user.service';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { UserRepository } from 'src/user/user.repository';
// import { HttpModule } from '@nestjs/axios';
// import { JwtModule } from '@nestjs/jwt';

@Module({
	imports:[UserModule, ChatRoomModule /*TypeOrmModule.forFeature([UserRepository]), HttpModule, JwtModule*/], // TypeOrmModule.forFeature([UserRepository]), HttpModule, JwtModule
	providers:[ChatGateway, /*UserRepository,JwtModule,UserService*/], //UserRepository JwtModule UserService
})
export class ChatModule {}
