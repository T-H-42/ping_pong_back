import { TypeOrmModuleOptions } from "@nestjs/typeorm";

export const typeORMConfig: TypeOrmModuleOptions = {
	type: 'postgres',
	host: 'localhost',
	port: 5432,
	username: 'nhwang',
	password: 'postgres',
	database: 'websoket-test',
	entities: [__dirname + '/../**/*.entity.{js,ts}'],
	synchronize: true,
	logging: false // true 이면 query 어떻게 가는지 콘솔로 확인
}