import {
  BaseEntity,
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity()
export class Game extends BaseEntity {
  @PrimaryGeneratedColumn()
  game_id: number;

  @Column()
  winner: number;

  @Column({ nullable: true })
  loser: number;

  @Column()
  time: string;

  @Column()
  finished: boolean;

  /*
  @ManyToOne((type) => User, (user) => user.send_friend, { eager: false })
  send_id: User;

  //요청 대기
  @ManyToOne((type) => User, (user) => user.recv_friend, { eager: false })
  recv_id: User;
  */
}
