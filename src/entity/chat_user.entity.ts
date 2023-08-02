import { BaseEntity, Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Chat_Room } from "./chat_room.entity";

@Entity()
export class Chat_User extends BaseEntity
{
    @PrimaryGeneratedColumn()
    id : number;
    
	@Column({nullable:true})
    chat_room_id : number;

    @Column()
    user_id : number;

    @Column({nullable:true})
    chat_title : string;
}