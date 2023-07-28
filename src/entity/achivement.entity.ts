// import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Achivement extends BaseEntity {
    @PrimaryGeneratedColumn()
    id : number;

    @Column()
    user_id : number;
    
    @Column({nullable : true})
    achivement : string;

}

// @Entity()
// export class Chat_Block extends BaseEntity {
//     @PrimaryGeneratedColumn()
//     id : number;

//     @Column()
//     chat_room_id : number;

//     @Column()
//     user_id : number;

//     @Column()
//     blocked_user_id : number;
// }