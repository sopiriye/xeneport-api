import { Module } from '@nestjs/common';
import { AllocationModule } from './allocation/allocation.module';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { DriftModule } from './drift/drift.module';
import { HoldingsModule } from './holdings/holdings.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { PricesModule } from './prices/prices.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AllocationModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    PortfoliosModule,
    HoldingsModule,
    PricesModule,
    DriftModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

//i am still yet to read all the swagger schema in the whole codebase
