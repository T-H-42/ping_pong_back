import { Module } from '@nestjs/common';
import { UserModule } from 'src/user/user.module';
import { ChatGateway } from './chat.gateway';
// import { UserService } from 'src/user/user.service';
// import { TypeOrmModule } from '@nestjs/typeorm';
// import { UserRepository } from 'src/user/user.repository';
// import { HttpModule } from '@nestjs/axios';
// import { JwtModule } from '@nestjs/jwt';

@Module({
	imports:[UserModule, /*TypeOrmModule.forFeature([UserRepository]), HttpModule, JwtModule*/], // TypeOrmModule.forFeature([UserRepository]), HttpModule, JwtModule
	providers:[ChatGateway, /*UserRepository,JwtModule,UserService*/], //UserRepository JwtModule UserService
})
export class ChatModule {}
