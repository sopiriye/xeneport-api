import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DriftController } from './drift.controller';
import { DriftService } from './drift.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [DriftController],
  providers: [DriftService],
})
export class DriftModule {}
