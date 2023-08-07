import { BaseEntity, Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Chat_Room_Msg extends BaseEntity {
    @PrimaryGeneratedColumn()
    id : number;

    @Column()
    index : string;

	@Column()
	user_id : number;

	@Column()
	msg : string;
	
	@Column()
	time : string;
}