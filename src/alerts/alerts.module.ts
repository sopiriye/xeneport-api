import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AlertsController } from './alerts.controller';
import { AlertsEmailService } from './alerts-email.service';
import { AlertsService } from './alerts.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsEmailService],
  exports: [AlertsService],
})
export class AlertsModule {}

//the entire alert module folder has not been reviewed yet
