import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Max, Min } from 'class-validator';

export class UpdateDriftMultiplierDto {
  @ApiProperty({
    example: 2.0,
    minimum: 1.0,
    maximum: 3.0,
    description: 'Updated portfolio-specific drift tolerance multiplier.',
  })
  @IsNumber({ maxDecimalPlaces: 1 })
  @IsNotEmpty()
  @Min(1)
  @Max(3)
  driftMultiplier: number = 0;
}
