import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadApiConfig } from './config';
import { configureHttp } from './http';

// Điểm khởi động NestJS: nạp module gốc và mở HTTP server cục bộ.
async function bootstrap(): Promise<void> {
  const { host, port } = loadApiConfig();
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  configureHttp(app);
  await app.listen(port, host);
}

bootstrap().catch((error: unknown) => {
  console.error('Unable to start the FashionCommerce API:', error);
  process.exitCode = 1;
});
