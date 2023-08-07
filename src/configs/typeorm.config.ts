import { TypeOrmModuleOptions } from "@nestjs/typeorm";

export const typeORMConfig: TypeOrmModuleOptions = {
	type: 'postgres',
	host: 'localhost',
	port: 5432,
	username: 'hyna', //세팅 변경시 마다 바꾸세요
	password: 'postgres',
	database: 'websocket',
	entities: [__dirname + '/../**/*.entity.{js,ts}'],
	synchronize: true,
	logging: false // true 이면 query 어떻게 가는지 콘솔로 확인
}