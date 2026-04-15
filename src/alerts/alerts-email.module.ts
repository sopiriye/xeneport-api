import { Module } from '@nestjs/common';
import { AlertsEmailService } from './alerts-email.service';

@Module({
  providers: [AlertsEmailService],
  exports: [AlertsEmailService],
})
export class AlertsEmailModule {}
