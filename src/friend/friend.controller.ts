import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { FriendService } from './friend.service';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/user/get-user.dacorator';
import { User } from 'src/entity/user.entity';

@Controller('friend')
export class FriendController {
    constructor(private friendService : FriendService) {}

    @Get('/allfriend')
    @UseGuards(AuthGuard())
    getAllFriend(@GetUser() user: User): Promise<User[]> {
      return this.friendService.findFriendList(user);
    }
}
