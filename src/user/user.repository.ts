import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { User } from '../entity/user.entity';

@Injectable()
export class UserRepository extends Repository<User> {
  constructor(private dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  async createUser(username: string, email: string): Promise<User> {
    // const { username, email };
    console.log('email = ', email);
    const user = this.create({
      username,
      intra_id: username,
      email,
      status: 1,
      two_factor_authentication_status: false,
    });

    try {
      await this.save(user);
    } catch (error) {
      if (error.code == 23505) {
        throw new ConflictException('already Exist');
      } else {
        throw new InternalServerErrorException();
      }
    }
    return user;
  }

  async updateProfileImage(username: string, imageName: string) {
    return await this.update({ username: username }, { image_url: imageName });
  }

  async updateUsername(nickname: string, intraID: string) {
    return await this.update({ intra_id: intraID }, { username: nickname });
  }
}
