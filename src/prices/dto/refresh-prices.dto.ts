import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class RefreshPricesDto {
  @ApiPropertyOptional({
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
    description:
      'Optional portfolio UUID. When omitted, all active portfolios owned by the authenticated user are refreshed.',
  })
  @IsOptional()
  @IsUUID()
  portfolioId?: string;
}
