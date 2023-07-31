import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UserRepository } from './user.repository';
import { User } from '../entity/user.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    // @InjectRepository(UserRepository)
    private userRepository: UserRepository,
  ) {
    super({
      secretOrKey: 'secret1234',
      //어디서 가져오냐 :            authHeader에서 Bearer타입 토큰으로
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    });
  }

  async validate(payload) {
    const { username } = payload;
    const user: User = await this.userRepository.findOne({
      where: { username },
    });
    
    if (!user) {
      console.log('user not found');
      throw new UnauthorizedException();
    }
    // if (user.fa_on_off) {
    // 	if (user.fa_status === false) {
    // 		console.log('2차인증 실패');
    // 		throw new UnauthorizedException();
    // 	}
    // }
    return user;
  }
}
