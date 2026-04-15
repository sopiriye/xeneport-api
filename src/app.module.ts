import { Module } from '@nestjs/common';
import { AllocationModule } from './allocation/allocation.module';
import { AlertsModule } from './alerts/alerts.module';
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
    AlertsModule,
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

// i will trim the response of the different routes in the controller
// i will also trim the different services and repositories to only include the relevant code for the swagger schema
// another thing i will do is review the variables in the modules to ensure they better suit the context in the application where they are being used. I will also ensure that the variables are named in a way that is more descriptive of their purpose in the application. This will help to improve the readability and maintainability of the codebase.
