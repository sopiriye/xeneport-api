import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HoldingsController],
  providers: [HoldingsService],
})
export class HoldingsModule {}
