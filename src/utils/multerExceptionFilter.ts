import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { MulterError } from 'multer';

@Catch(MulterError)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
  
    let status = HttpStatus.BAD_REQUEST;
    let message = '지원하지 않는 파일 확장자 입니다.';
  
    if (exception.code === 'LIMIT_FILE_SIZE') {
      status = HttpStatus.PAYLOAD_TOO_LARGE;
      message = '파일 사이즈가 너무 큽니다.';
    }
  
    response.status(status).json({
      statusCode: status,
      message,
      error: message,
    });
  }
}
