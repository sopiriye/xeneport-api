import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateHoldingDto {
  @ApiProperty({
    example: 25,
    minimum: 1,
    description: 'Updated whole share quantity for the holding.',
  })
  @IsInt()
  @Min(1)
  shares: number = 0;
}
