import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SecuritiesController } from './securities.controller';
import { SecuritiesService } from './securities.service';

@Module({
  imports: [DatabaseModule],
  controllers: [SecuritiesController],
  providers: [SecuritiesService],
  exports: [SecuritiesService],
})
export class SecuritiesModule {}

// i am still yet to review the code for the entire module.
