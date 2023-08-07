import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './modules/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeORMConfig } from './configs/typeorm.config';
import { FriendModule } from './modules/friend.module';
// import { FriendGatewayGateway } from './friend-gateway/friend-gateway.gateway';
// import { FriendGatewayModule } from './friend-gateway/friend-gateway.module';
// import { ChatGateway } from './chat/chat.gateway';
import { ChatModule } from './modules/chat.module';
import { PingPongModule } from './modules/ping_pong.module';
import { ChatMuteModule } from './modules/chat_mute.module';
import { ChatBlockModule } from './modules/chat_block.module';
import { ChatUserModule } from './modules/chat_user.module';
import { GameModule } from './modules/game.module';
import { ChatRoomModule } from './chat_room/chat_room.module';
import { GameGateway } from './gateway/game.gateway';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

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
    GameModule,
    ChatRoomModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public', 'uploads'),
    }),
  ],
  controllers: [AppController],
  providers: [AppService], //FriendGatewayGateway, ChatGateway
})
export class AppModule {}
