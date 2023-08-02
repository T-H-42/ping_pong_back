import { BaseEntity, Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Chat_User } from "./chat_user.entity";

@Entity()
export class Chat_Room extends BaseEntity {
    @PrimaryGeneratedColumn()
    chat_id : number;
    
    @Column()
    owner_id : number;

    @Column()//
    room_stat : number;

    @Column({nullable:true})
    password : string;

    @Column()
    limit_user : number;

    @Column()
    curr_user : number;

    @Column()
    chat_title : string;
}