import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { AlertChannel, AlertStatus } from '@prisma/client';

export class ListAlertsQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    enum: AlertStatus,
    example: 'unread',
    description: 'Optional alert status filter.',
  })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({
    enum: AlertChannel,
    example: 'in_app',
    description: 'Optional alert channel filter.',
  })
  @IsOptional()
  @IsEnum(AlertChannel)
  channel?: AlertChannel;

  @ApiPropertyOptional({
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
    description: 'Optional portfolio UUID filter.',
  })
  @IsOptional()
  @IsUUID()
  portfolioId?: string;
}
