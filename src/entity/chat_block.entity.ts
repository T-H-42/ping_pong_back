import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Chat_Block extends BaseEntity {
    @PrimaryGeneratedColumn()
    id : number;

    @Column()
    chat_room_id : number;

    @Column()
    user_id : number;

    @Column()
    blocked_user_id : number;
}

// situation
/*
 프론트엔드에서의 상황
  - 유저가 채팅방에 입장함.
 백에서 가져와야하는 정준
  - 가능한 것을 던져준다
    - 가능한 것?
	  - muted나 block이 아닌 "유저 리스트" //유저 리스트에 대한 타입은 미정. 화이트 리스트 형태
*/

// target
/*
  채팅방 아이디와 접속한 유저 기준, 블락 리스트와 뮤트 리스트가 제거된 채팅방 참여자 화이트 리스트
*/

/*
function takePictureAfter90Seconds() {
  // Get the current date and time
  const currentTime = new Date();

  // Add 90 seconds (60,000 milliseconds) to the current time
  const timeAfter90Seconds = new Date(currentTime.getTime() + 60000);

  // Convert the timeAfter90Seconds to an ISO string
  const isoString = timeAfter90Seconds.toISOString();

  console.log(isoString);
  // You can use the ISO string here to take a picture or perform any other task.
}
*/


/*

---------------------------------------07.26---------------------------------------
mute 시간이 지나지 않은 유저 -> 2,4
mute 시간이 지난 유저 -> 3,7,8

block 유저

만들어야 할 케이스 (block의 경우, 다른 사람이 블록한 부분은 보여야함.)

1. mute시간이 안지났고, block인 유저 -> 보이지 말아야함 -> <user_id가 1>인 유저가 쿼리 날리기 :: 2,4(mute)과 3,4(block)는 보이지 말아야 한다. --->(OK!)
        1-2) 다른 사람이 block한 유저(mute이기 때문에 상관없음!) -> 보이지 말아야함 -> <user_id가 1>인 유저가 쿼리 날리기 :: 2,4(mute)와 3,4는 보이지 않되, 다른 유저인 user_id=4가 블록한 나머지 유저들은 보여야 한다. --->(OK!)

2. mute시간이 안지났고, block이 아닌 유저 -> 보이지 말아야함 -> <user_id가 6>인 유저(block한 유저가 없는 유저)가 쿼리 날리기 --->(OK!)



3. mute시간이 지났고 block인 유저 -> 보이지 말아야 함. <user_id가 8>인 유저(3,7만 블락한 유저)가 쿼리 날리기 :: 3,7이 보이지 말아야 함.  --->(OK!)
        3-2) 다른 사람이 block한 유저 -> 보여야함 -> <user_id가 6>인 유저(3,7,8)을 블락하지 않은 유저가 쿼리 날리기 :: 3,7,8이 보여야함. --->(OK!)


4. mute시간이 지났고 block이 아닌 유저 -> 보여야함 (mute시간이 지났고 block된 게 없는 새로운 유저=8 에 대해서는 보여야 함.) 쿼리를 날리는 <1,2,3,4,6,7,8,9 중 임의의 유저>가 날려도 8은 보여야함. --->(OK!)
        
5. mute도, block에도 없는 유저들 -> 전부 보여야함 user_id가 2인 유저가 쿼리 날리면 2,4빼고 다 보여야 함. --->(OK!)

CHAT_USER
 id | chat_room_id | user_id 
----+--------------+---------
  1 |            1 |       1
  2 |            1 |       2
  3 |            1 |       3
  4 |            1 |       4
  5 |            2 |       5 ---> 2번방입니다.
  6 |            1 |       6
  7 |            1 |       7
  8 |            1 |       8
  9 |            1 |       9


CHAT_MUTE
 id | chat_room_id | user_id |      mute_end_time       
----+--------------+---------+--------------------------
  3 |            2 |       2 |                              ---------> 2번방 입니다.
  2 |            1 |       3 | 2023-07-24T06:28:39.296Z
  1 |            1 |       2 | 2023-08-20T06:28:39.296Z      /// 뮤트됨
  4 |            1 |       4 | 2023-08-20T06:28:39.296Z      // 뮤트됨
  5 |            1 |       7 | 2023-07-20T06:28:39.296Z
  6 |            1 |       8 | 2023-07-20T06:28:39.296Z

  
CHAT_BLOCK
 id | chat_room_id | user_id | blocked_user_id 
----+--------------+---------+-----------------
  1 |            1 |       1 |               3
  2 |            1 |       4 |               1
  3 |            1 |       1 |               4
  4 |            1 |       4 |               2
  5 |            1 |       4 |               6
  6 |            1 |       4 |               7
  7 |            1 |       8 |               3
  8 |            1 |       8 |               7
  
chat_mute.mute_end_time::timestamp < NOW()

nhwang
--------------------------------------------------------
select user_id from "chat_mute" where "chat_room_id"=${user가 소속된 방id};


1. 1번방에 mute된 놈들
select user_id, chat_room_id from "chat_mute" where "chat_room_id"=1 and NOW() < "chat_mute".mute_end_time::timestamp;

2. block으로 내가 block
select blocked_user_id, chat_room_id from "chat_block" where "chat_room_id"=1 and "user_id" = 1;

3. (1번 n 2번) 
select user_id, chat_room_id from "chat_mute" where "chat_room_id"=1 and NOW() < "chat_mute".mute_end_time::timestamp union select blocked_user_id, chat_room_id from "chat_block" where "chat_room_id"=1 and "user_id" = 1;

---- fin -----
select "user_id" from "chat_user" where ("user_id" not in (select user_id from "chat_mute" where "chat_room_id"=1 and NOW() < "chat_mute".mute_end_time::timestamp union select blocked_user_id from "chat_block" where "user_id" = 1) and chat_room_id = 1);
---- fin -----

ㄴ> 이 fin이랑 일치하는 chat_socket들의 리스트가 필요하고, 이것에서 

--------------------------------------------------------
SELECT column1, column2, column3, ...
FROM set_a
WHERE column1 NOT IN (SELECT column1 FROM subset_b);


broadcast.except하는 방법도 있음.

mute면 msg 눌렀을때, 안된다는 모달 띄워줄 수도 있고, 그냥 안되게 할 수도 있음.
msg 눌렀을때, 바로 띄우기보다, muted 상태를 보내주면 프론트에서 보고나서 처리해야할 것. -> 시간이 지났으면 delete 하는 로직이 있는게 나아보이기도 함.

block으로 except하기만 하면 될듯?
select "user"."chat_sockid" from (select "user_id" from "chat_block" where "chat_room_id"=1 and "blocked_user_id" = 3) as "A" left join "user" on "user"."id" = "A"."user_id" where "user"."chat_sockid" is not null;
ㄴ> 나를 block 한 유저들의 socket id >> except할 것임.


*/




