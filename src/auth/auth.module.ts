import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { DatabaseModule } from '../database/database.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const jwtSignOptions: JwtSignOptions = {
  expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ??
    '15m') as JwtSignOptions['expiresIn'],
};

@Module({
  imports: [
    DatabaseModule,
    JwtModule.register({
      global: false,
      secret: process.env.JWT_SECRET ?? 'development-jwt-secret-change-me',
      signOptions: jwtSignOptions,
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
