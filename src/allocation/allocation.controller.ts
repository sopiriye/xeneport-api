import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { AllocationService } from './allocation.service';

@ApiTags('Allocation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolios')
export class AllocationController {
  constructor(private readonly allocationService: AllocationService) {}

  @Get(':id/allocation')
  @ApiOperation({
    summary: 'Get portfolio allocation',
    description:
      'Returns the authenticated investor portfolio allocation using the latest stored prices for each holding.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID.',
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
  })
  @ApiOkResponse({
    description: 'Portfolio allocation returned successfully.',
    schema: {
      example: {
        portfolio: {
          id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          name: 'Long-Term Core Portfolio',
          status: 'active',
          driftMultiplier: 1.5,
          createdAt: '2026-04-07T09:00:00.000Z',
          updatedAt: '2026-04-13T10:00:00.000Z',
        },
        summary: {
          assetCount: 2,
          totalMarketValue: 7000,
          equalWeight: 50,
          driftThreshold: 75,
        },
        allocations: [
          {
            holdingId: 'd4dcfd6b-88ef-4d86-b153-3182a2eb5ea3',
            securityId: 'c07c5d0f-25b0-4b09-b0cc-e5b331b49f9e',
            ticker: 'ACCESSCORP',
            companyName: 'Access Holdings Plc',
            exchange: {
              id: '775ed46f-f383-45e2-8ec8-858a36ef4f68',
              tickerPrefix: 'NGX',
              name: 'Nigerian Exchange',
            },
            shares: 100,
            marketPrice: 26,
            marketValue: 2600,
            allocationWeight: 37.1,
            priceTimestamp: '2026-04-10T00:00:00.000Z',
          },
          {
            holdingId: 'eb4b3c3e-18f7-4ae2-b939-1b8dd4a5522f',
            securityId: '18f0c2b4-b74d-43df-9db0-1e95cdf35315',
            ticker: 'ZENITHBANK',
            companyName: 'Zenith Bank Plc',
            exchange: {
              id: '775ed46f-f383-45e2-8ec8-858a36ef4f68',
              tickerPrefix: 'NGX',
              name: 'Nigerian Exchange',
            },
            shares: 40,
            marketPrice: 110,
            marketValue: 4400,
            allocationWeight: 62.9,
            priceTimestamp: '2026-04-10T00:00:00.000Z',
          },
        ],
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Portfolio was not found.',
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  getPortfolioAllocation(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) portfolioId: string,
  ) {
    return this.allocationService.getPortfolioAllocation(
      currentUser,
      portfolioId,
    );
  }
}
