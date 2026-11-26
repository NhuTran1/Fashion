import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthService } from './auth.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, MeService],
  exports: [AuthService],
})
export class AuthModule {}
