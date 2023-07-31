import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Chat_Room_Admin extends BaseEntity {
    @PrimaryGeneratedColumn()
    id : number;

    @Column()
    chat_room_id : number;

    @Column()
    admin_id : number;
}