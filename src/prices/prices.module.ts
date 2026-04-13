import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [PricesController],
  providers: [PricesService],
})
export class PricesModule {}
