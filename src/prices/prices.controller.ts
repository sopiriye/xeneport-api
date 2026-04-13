import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
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
import { RefreshPricesDto } from './dto/refresh-prices.dto';
import { PricesService } from './prices.service';

@ApiTags('Prices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get(':ticker')
  @ApiOperation({
    summary: 'Get latest price by ticker',
    description:
      'Returns the latest stored market price for a ticker from the prices table.',
  })
  @ApiParam({
    name: 'ticker',
    description: 'Security ticker.',
    example: 'ACCESSCORP',
  })
  @ApiOkResponse({
    description: 'Latest price returned successfully.',
    schema: {
      example: {
        ticker: 'ACCESSCORP',
        companyName: 'Access Holdings Plc',
        exchange: {
          id: '775ed46f-f383-45e2-8ec8-858a36ef4f68',
          tickerPrefix: 'NGX',
          name: 'Nigerian Exchange',
        },
        latestPrice: {
          id: 'f3b95596-795d-46d8-b063-1a7f25dfe7e5',
          securityId: '6fd4c194-7667-4f2f-a4ef-5ad60b034ee8',
          price: 22.45,
          timestamp: '2026-04-09T00:00:00.000Z',
          createdAt: '2026-04-10T08:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Security was not found or no price data exists for it.',
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  getLatestPrice(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('ticker') ticker: string,
  ) {
    return this.pricesService.getLatestPriceByTicker(currentUser, ticker);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Refresh holdings and portfolio price caches',
    description:
      'Applies the latest prices in the prices table to user holdings and recalculates portfolio cached market values and weights.',
  })
  @ApiBody({ type: RefreshPricesDto, required: false })
  @ApiOkResponse({
    description: 'Prices refreshed successfully.',
    schema: {
      example: {
        message: 'Portfolios refreshed successfully',
        refreshedPortfolios: 2,
        refreshedHoldings: 6,
        latestPriceCount: 6,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Portfolio was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  refresh(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: RefreshPricesDto,
  ) {
    return this.pricesService.refreshPrices(currentUser, payload ?? {});
  }
}
