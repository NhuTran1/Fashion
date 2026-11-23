import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { abortOnError: false });
  await app.listen(3000, '127.0.0.1');
}

bootstrap().catch((error: unknown) => {
  console.error('Unable to start the FashionCommerce API:', error);
  process.exitCode = 1;
});
