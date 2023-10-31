import { TypeOrmModuleOptions } from '@nestjs/typeorm';
// only for local
import * as dotenv from 'dotenv';
dotenv.config();
// 

export const typeORMConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_CONTAINER_HOSTNAME,
  port: parseInt(process.env.DB_CONTAINER_PORT, 10),
  username: process.env.NEW_POSTGRES_USER, //세팅 변경시 마다 바꾸세요
  password: process.env.NEW_POSTGRES_PASSWORD,
  database: process.env.NEW_DATABASE_NAME,
  entities: [__dirname + '/../**/*.entity.{js,ts}'],
  synchronize: true,
  logging: false, // true 이면 query 어떻게 가는지 콘솔로 확인
};
