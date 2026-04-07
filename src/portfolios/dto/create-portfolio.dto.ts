import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreatePortfolioDto {
  @ApiProperty({
    example: 'Long-Term Core Portfolio',
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string = '';

  @ApiPropertyOptional({
    example: 'Primary equity allocation portfolio for long-term monitoring.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({
    example: 1.5,
    minimum: 1.0,
    maximum: 3.0,
    description: 'Portfolio-specific drift tolerance multiplier.',
  })
  @IsNumber({ maxDecimalPlaces: 1 })
  @IsNotEmpty()
  @Min(1)
  @Max(3)
  driftMultiplier: number = 0;
}
