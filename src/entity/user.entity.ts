import { Friend } from 'src/entity/friend.entity';
import {
  BaseEntity,
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class User extends BaseEntity {
  // @unique
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column({ nullable: true })
  socketid: string;

  @Column ({nullable : true})
  chat_sockid : string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  status: number;

  @Column({nullable: true})
  two_factor_authentication_status: boolean;

  @Column({nullable: true})
  two_factor_authentication_code: number;

  @OneToMany((type) => Friend, (friend) => friend.send_id, { eager: true })
  send_friend: Friend[];

  @OneToMany((type) => Friend, (friend) => friend.recv_id, { eager: true })
  recv_friend: Friend[];
}
