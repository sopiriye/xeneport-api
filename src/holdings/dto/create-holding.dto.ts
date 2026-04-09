import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateHoldingDto {
  @ApiProperty({
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
    description: 'Portfolio UUID that will own the holding.',
  })
  @IsUUID()
  @IsNotEmpty()
  portfolioId: string = '';

  @ApiProperty({
    example: 'AAPL',
    description: 'Ticker must exist in the predefined securities list.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  ticker: string = '';

  @ApiProperty({
    example: 10,
    minimum: 1,
    description: 'Whole share quantity for the holding.',
  })
  @IsInt()
  @IsNotEmpty()
  @Min(1)
  shares: number = 0;
}
