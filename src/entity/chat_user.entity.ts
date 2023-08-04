import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Chat_User extends BaseEntity
{
    @PrimaryGeneratedColumn()
    id : number;
    
	@Column({nullable:true})
    chat_room_id : number;

    @Column()
    user_id : number;

    // @Column()
    // chat_title: string;

    //chat_title -> index
    @Column()
    index: string;
}