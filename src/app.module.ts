import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeORMConfig } from './configs/typeorm.config';
import { FriendModule } from './friend/friend.module';
// import { FriendGatewayGateway } from './friend-gateway/friend-gateway.gateway';
// import { FriendGatewayModule } from './friend-gateway/friend-gateway.module';
// import { ChatGateway } from './chat/chat.gateway';
import { ChatModule } from './chat/chat.module';
import { PingPongModule } from './ping_pong/ping_pong.module';
import { ChatMuteModule } from './chat_mute/chat_mute.module';
import { ChatBlockModule } from './chat_block/chat_block.module';
import { ChatUserModule } from './chat_user/chat_user.module';
import { GameModule } from './game/game.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeORMConfig),
    UserModule,
    FriendModule,
    // FriendGatewayModule,
    ChatModule,
    PingPongModule,
    ChatMuteModule,
    ChatBlockModule,
    ChatUserModule,
    GameModule
  ],
  controllers: [AppController],
  providers: [AppService,], //FriendGatewayGateway, ChatGateway
})
export class AppModule {}