import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { HoldingsModule } from './holdings/holdings.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    PortfoliosModule,
    HoldingsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
