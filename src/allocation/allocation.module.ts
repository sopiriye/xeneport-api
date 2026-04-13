import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { AllocationController } from './allocation.controller';
import { AllocationService } from './allocation.service';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [AllocationController],
  providers: [AllocationService],
})
export class AllocationModule {}
