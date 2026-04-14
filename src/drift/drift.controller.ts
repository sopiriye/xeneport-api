import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
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
import { CheckDriftDto } from './dto/check-drift.dto';
import { DriftService } from './drift.service';

@ApiTags('Drift')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class DriftController {
  constructor(private readonly driftService: DriftService) {}

  @Get('portfolios/:id/drift-status')
  @ApiOperation({
    summary: 'Get portfolio drift status',
    description:
      'Returns current drift status for each holding in a user-owned portfolio using cached allocation fields.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID.',
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
  })
  @ApiOkResponse({
    description: 'Portfolio drift status returned successfully.',
    schema: {
      example: {
        portfolio: {
          id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          name: 'Long-Term Core Portfolio',
          status: 'active',
          driftMultiplier: 1.5,
          currentAssetCount: 2,
          currentTotalMarketValue: 7000,
          currentEqualWeight: 50,
          currentDriftThreshold: 75,
          lastRecalculatedAt: '2026-04-13T10:00:00.000Z',
        },
        summary: {
          checkedHoldings: 2,
          driftedHoldings: 1,
          hasDrift: true,
        },
        items: [
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
            currentMarketPrice: 26,
            currentMarketValue: 2600,
            currentWeight: 37.1,
            equalWeight: 50,
            driftThreshold: 75,
            hasDrift: false,
            openDriftEvent: null,
          },
        ],
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Portfolio was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  getPortfolioDriftStatus(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) portfolioId: string,
  ) {
    return this.driftService.getPortfolioDriftStatus(currentUser, portfolioId);
  }

  @Post('drift/check')
  @ApiOperation({
    summary: 'Check drift and create drift events',
    description:
      'Checks active portfolios for holdings whose current weight exceeds the cached drift threshold and creates open drift events where needed.',
  })
  @ApiBody({ type: CheckDriftDto, required: false })
  @ApiOkResponse({
    description: 'Drift check completed successfully.',
    schema: {
      example: {
        message: 'Drift check completed successfully',
        checkedPortfolios: 2,
        checkedHoldings: 6,
        driftedHoldings: 1,
        createdEvents: 1,
        existingOpenEvents: 0,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Portfolio was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  checkDrift(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: CheckDriftDto,
  ) {
    return this.driftService.checkDrift(currentUser, payload ?? {});
  }
}
