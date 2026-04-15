import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DriftController } from './drift.controller';
import { DriftService } from './drift.service';

@Module({
  imports: [DatabaseModule, AuthModule, AlertsModule],
  controllers: [DriftController],
  providers: [DriftService],
  exports: [DriftService],
})
export class DriftModule {}
