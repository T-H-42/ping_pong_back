import { Friend } from 'src/entity/friend.entity';
import {
  BaseEntity,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity()
export class User extends BaseEntity {
  // @unique
  @PrimaryGeneratedColumn()
  id: number;

  @Column({unique: true})
  username: string;

  @Column({ nullable: true })
  intraID: string;

  @Column({ nullable: true })
  socketid: string; //sockid_pingpong

  @Column({ nullable: true })
  ladder_lv: number;

  @Column({ nullable: true })
  chat_sockid: string; //sockid_chat

  @Column({ nullable: true })
  game_sockid: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  status: number;

  @Column({ nullable: true })
  two_factor_authentication_status: boolean; //two_factor_auth로 변경

  @Column({ nullable: true })
  two_factor_authentication_code: number;

  @OneToMany((type) => Friend, (friend) => friend.send_id, { eager: true })
  send_friend: Friend[];

  @OneToMany((type) => Friend, (friend) => friend.recv_id, { eager: true })
  recv_friend: Friend[];
}
