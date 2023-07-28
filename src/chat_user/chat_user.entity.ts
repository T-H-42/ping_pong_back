import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Chat_User extends BaseEntity
{
    @PrimaryGeneratedColumn()
    id : number;
    
	@Column()
    chat_room_id : number;

    @Column()
    user_id : number;
}