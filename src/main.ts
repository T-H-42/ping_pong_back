import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

async function bootstrap() {
  
  const corsOptions: CorsOptions = {
    origin: true,
    credentials: true,
  };

  
  const app = await NestFactory.create(AppModule);
  app.enableCors(corsOptions);
  await app.listen(4000);
}
bootstrap();
