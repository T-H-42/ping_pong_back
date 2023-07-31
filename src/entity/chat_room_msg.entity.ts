import { BaseEntity, Column, Entity, PrimaryColumn } from "typeorm";

@Entity()
export class Chat_Room_Msg extends BaseEntity {
    @PrimaryColumn()
    id : number;

    @Column()
    chat_room_id : number;

	@Column()
	user_id : number;

	@Column()
	msg : string;
	
	@Column()
	time : string;
}