import { BaseEntity, Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Chat_Mute extends BaseEntity {
    @PrimaryGeneratedColumn()
    id : number;

    @Column()
    chat_room_id : number;

    @Column()
    user_id : number;

    @Column({nullable: true})
    mute_end_time : string;
}
