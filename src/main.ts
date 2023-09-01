import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import * as multer from 'multer';

async function bootstrap() {
  
  const corsOptions: CorsOptions = {
    origin: true,
    credentials: true,
  };
    
    const app = await NestFactory.create(AppModule);
    app.enableCors(corsOptions);
    
    //app.use((err, req, res, next) => {
    //  if (err instanceof multer.MulterError) {
    //    res.status(400).json({ error: 'Multer Error: ' + err.message });
    //  } else {
    //    next(err);
    //  }
    //});

    await app.listen(4000);
}
bootstrap();
