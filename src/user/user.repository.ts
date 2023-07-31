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
    const user = this.create({ username, email, status: 1, two_factor_authentication_status: false });

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
    // return user;//없애도 됩니다.
  }
}
