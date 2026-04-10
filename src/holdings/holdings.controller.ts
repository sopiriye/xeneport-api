import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { ListHoldingsQueryDto } from './dto/list-holdings-query.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';
import { HoldingsService } from './holdings.service';

@ApiTags('Holdings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class HoldingsController {
  constructor(private readonly holdingsService: HoldingsService) {}

  @Post('holdings')
  @ApiOperation({
    summary: 'Add holding',
    description:
      'Adds a stock holding to a user-owned portfolio. Ticker must exist in the predefined securities list and shares must be greater than zero.',
  })
  @ApiBody({ type: CreateHoldingDto })
  @ApiCreatedResponse({
    description: 'Holding created successfully.',
    schema: {
      example: {
        message: 'Holding created successfully',
        holding: {
          id: 'd4dcfd6b-88ef-4d86-b153-3182a2eb5ea3',
          portfolioId: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          securityId: 'c07c5d0f-25b0-4b09-b0cc-e5b331b49f9e',
          ticker: 'AAPL',
          companyName: 'Apple Inc.',
          exchange: {
            tickerPrefix: 'NASDAQ',
            name: 'Nasdaq Stock Market',
          },
          shares: 10,
          currentMarketPrice: 0,
          currentMarketValue: 0,
          currentWeight: 0,
          lastTransactionAt: '2026-04-08T09:00:00.000Z',
          createdAt: '2026-04-08T09:00:00.000Z',
          updatedAt: '2026-04-08T09:00:00.000Z',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'The selected security already exists in the portfolio.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid ticker, invalid shares, or archived portfolio.',
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: CreateHoldingDto,
  ) {
    return this.holdingsService.create(currentUser, payload);
  }
  // ...endPoint END  ...

  @Patch('holdings/:id')
  @ApiOperation({
    summary: 'Update holding',
    description:
      'Updates the share quantity for a holding that belongs to the authenticated investor.',
  })
  @ApiParam({
    name: 'id',
    description: 'Holding UUID.',
    example: 'd4dcfd6b-88ef-4d86-b153-3182a2eb5ea3',
  })
  @ApiBody({ type: UpdateHoldingDto })
  @ApiOkResponse({
    description: 'Holding updated successfully.',
    schema: {
      example: {
        message: 'Holding updated successfully',
        holding: {
          id: 'd4dcfd6b-88ef-4d86-b153-3182a2eb5ea3',
          portfolioId: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          securityId: 'c07c5d0f-25b0-4b09-b0cc-e5b331b49f9e',
          ticker: 'AAPL',
          companyName: 'Apple Inc.',
          exchange: {
            tickerPrefix: 'NASDAQ',
            name: 'Nasdaq Stock Market',
          },
          shares: 25,
          currentMarketPrice: 0,
          currentMarketValue: 0,
          currentWeight: 0,
          lastTransactionAt: '2026-04-08T09:10:00.000Z',
          createdAt: '2026-04-08T09:00:00.000Z',
          updatedAt: '2026-04-08T09:10:00.000Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid shares or archived portfolio.',
  })
  @ApiNotFoundResponse({ description: 'Holding was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  update(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) holdingId: string,
    @Body() payload: UpdateHoldingDto,
  ) {
    return this.holdingsService.update(currentUser, holdingId, payload);
  }
  // ...endPoint END  ...

  @Delete('holdings/:id')
  @ApiOperation({
    summary: 'Remove holding',
    description:
      'Deletes a holding from the authenticated investor portfolio and refreshes portfolio cached asset counts.',
  })
  @ApiParam({
    name: 'id',
    description: 'Holding UUID.',
    example: 'd4dcfd6b-88ef-4d86-b153-3182a2eb5ea3',
  })
  @ApiOkResponse({
    description: 'Holding removed successfully.',
    schema: {
      example: {
        message: 'Holding removed successfully',
        holding: {
          id: 'd4dcfd6b-88ef-4d86-b153-3182a2eb5ea3',
          portfolioId: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          securityId: 'c07c5d0f-25b0-4b09-b0cc-e5b331b49f9e',
          ticker: 'AAPL',
          companyName: 'Apple Inc.',
          exchange: {
            tickerPrefix: 'NASDAQ',
            name: 'Nasdaq Stock Market',
          },
          shares: 25,
          currentMarketPrice: 0,
          currentMarketValue: 0,
          currentWeight: 0,
          lastTransactionAt: '2026-04-08T09:10:00.000Z',
          createdAt: '2026-04-08T09:00:00.000Z',
          updatedAt: '2026-04-08T09:10:00.000Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Archived portfolio cannot be modified.',
  })
  @ApiNotFoundResponse({ description: 'Holding was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) holdingId: string,
  ) {
    return this.holdingsService.remove(currentUser, holdingId);
  }
  // ...endPoint END  ...

  @Get('portfolios/:id/holdings')
  @ApiOperation({
    summary: 'List portfolio holdings',
    description:
      'Returns holdings for a user-owned portfolio with pagination and optional ticker/company search.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID.',
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({
    name: 'search',
    required: false,
    example: 'AAPL',
    description: 'Case-insensitive search by ticker or company name.',
  })
  @ApiOkResponse({
    description: 'Portfolio holdings returned successfully.',
    schema: {
      example: {
        portfolio: {
          id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          name: 'Long-Term Core Portfolio',
          status: 'active',
        },
        data: [
          {
            id: 'd4dcfd6b-88ef-4d86-b153-3182a2eb5ea3',
            portfolioId: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
            securityId: 'c07c5d0f-25b0-4b09-b0cc-e5b331b49f9e',
            ticker: 'AAPL',
            companyName: 'Apple Inc.',
            exchange: {
              tickerPrefix: 'NASDAQ',
              name: 'Nasdaq Stock Market',
            },
            shares: 10,
            currentMarketPrice: 0,
            currentMarketValue: 0,
            currentWeight: 0,
            lastTransactionAt: '2026-04-08T09:00:00.000Z',
            createdAt: '2026-04-08T09:00:00.000Z',
            updatedAt: '2026-04-08T09:00:00.000Z',
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          appliedFilters: {
            search: null,
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Portfolio was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  findByPortfolio(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) portfolioId: string,
    @Query() query: ListHoldingsQueryDto,
  ) {
    return this.holdingsService.findByPortfolio(
      currentUser,
      portfolioId,
      query,
    );
  }
}
