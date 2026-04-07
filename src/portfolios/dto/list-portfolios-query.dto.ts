/* eslint-disable @typescript-eslint/no-unsafe-return */
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

enum PortfolioFilterStatus {
  active = 'active',
  archived = 'archived',
}

export class ListPortfoliosQueryDto {
  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'active',
    enum: PortfolioFilterStatus,
    description: 'Filter portfolios by status. Defaults to active only.',
  })
  @IsOptional()
  @IsEnum(PortfolioFilterStatus)
  status?: PortfolioFilterStatus;

  @ApiPropertyOptional({
    example: 'core',
    description: 'Case-insensitive portfolio name search.',
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(150)
  search?: string;
}
