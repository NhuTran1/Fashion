import { randomUUID } from 'node:crypto';
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ApiHttpException } from './api-http.exception';

const HTTP_ERRORS: Readonly<
  Partial<Record<number, { code: string; message: string }>>
> = {
  400: { code: 'VALIDATION_ERROR', message: 'Invalid request.' },
  401: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' },
  403: { code: 'FORBIDDEN', message: 'Access is denied.' },
  404: { code: 'NOT_FOUND', message: 'Resource not found.' },
  409: {
    code: 'RESOURCE_CONFLICT',
    message: 'The request conflicts with the current resource.',
  },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'Request payload is too large.' },
  415: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Unsupported media type.' },
  422: { code: 'VALIDATION_ERROR', message: 'Invalid request.' },
  429: { code: 'RATE_LIMITED', message: 'Too many requests.' },
};

// Chuyển ngoại lệ HTTP thành cấu trúc lỗi dùng chung và ẩn chi tiết nội bộ.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.adapterHost;
    const response = host.switchToHttp().getResponse();
    if (httpAdapter.isHeadersSent(response)) {
      httpAdapter.end(response);
      return;
    }

    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const requestId = randomUUID();
    const error =
      status >= 500
        ? { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' }
        : exception instanceof ApiHttpException
          ? { code: exception.code, message: exception.message }
          : (HTTP_ERRORS[status] ?? {
              code: 'HTTP_ERROR',
              message: 'The request failed.',
            });

    if (status >= 500) {
      this.logger.error(`HTTP ${status} (requestId=${requestId})`);
    }
    httpAdapter.setHeader(response, 'X-Request-Id', requestId);
    httpAdapter.reply(response, { ...error, requestId }, status);
  }
}
