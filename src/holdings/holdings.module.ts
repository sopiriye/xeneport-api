import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { DriftModule } from '../drift/drift.module';
import { PricesModule } from '../prices/prices.module';
import { HoldingsController } from './holdings.controller';
import { HoldingsService } from './holdings.service';

@Module({
  imports: [DatabaseModule, AuthModule, PricesModule, DriftModule],
  controllers: [HoldingsController],
  providers: [HoldingsService],
})
export class HoldingsModule {}
