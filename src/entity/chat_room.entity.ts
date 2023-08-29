import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

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
    index : string; //chat_title
}

/*

*/