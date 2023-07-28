import { User } from 'src/entity/user.entity';
import {
  BaseEntity,
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Friend extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  //요청
  @ManyToOne((type) => User, (user) => user.send_friend, { eager: false })
  send_id: User;

  //요청 대기
  @ManyToOne((type) => User, (user) => user.recv_friend, { eager: false })
  recv_id: User;
  //

  @Column({ default: false })
  accecpt: boolean;
}
