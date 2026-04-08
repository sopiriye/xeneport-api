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
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { ListPortfoliosQueryDto } from './dto/list-portfolios-query.dto';
import { UpdateDriftMultiplierDto } from './dto/update-drift-multiplier.dto';
import { PortfoliosService } from './portfolios.service';

@ApiTags('Portfolios')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly portfoliosService: PortfoliosService) {}

  @Post()
  @ApiOperation({
    summary: 'Create portfolio',
    description:
      'Creates a new investor portfolio with its own drift multiplier configuration.',
  })
  @ApiBody({ type: CreatePortfolioDto })
  @ApiCreatedResponse({
    description: 'Portfolio created successfully.',
    schema: {
      example: {
        message: 'Portfolio created successfully',
        portfolio: {
          id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          userId: '29d5c25d-42e8-49e7-b590-a954d7cf86f5',
          name: 'Long-Term Core Portfolio',
          description:
            'Primary equity allocation portfolio for long-term monitoring.',
          status: 'active',
          driftMultiplier: 1.5,
          currentAssetCount: 0,
          currentTotalMarketValue: 0,
          currentEqualWeight: 0,
          currentDriftThreshold: 0,
          alertCount: 0,
          lastRecalculatedAt: null,
          createdAt: '2026-04-07T09:00:00.000Z',
          updatedAt: '2026-04-07T09:00:00.000Z',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Portfolio name already exists for the authenticated user.',
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() payload: CreatePortfolioDto,
  ) {
    return this.portfoliosService.create(currentUser, payload);
  }
  // ...endPoint END  ...

  @Get()
  @ApiOperation({
    summary: 'List portfolios',
    description:
      'Returns the authenticated user portfolios with pagination and optional status/name filtering.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({
    name: 'status',
    required: false,
    example: 'active',
    description: 'Filter by active or archived status.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    example: 'core',
    description: 'Case-insensitive name search.',
  })
  @ApiOkResponse({
    description: 'Paginated portfolios returned successfully.',
    schema: {
      example: {
        data: [
          {
            id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
            userId: '29d5c25d-42e8-49e7-b590-a954d7cf86f5',
            name: 'Long-Term Core Portfolio',
            description:
              'Primary equity allocation portfolio for long-term monitoring.',
            status: 'active',
            driftMultiplier: 1.5,
            currentAssetCount: 0,
            currentTotalMarketValue: 0,
            currentEqualWeight: 0,
            currentDriftThreshold: 0,
            alertCount: 0,
            lastRecalculatedAt: null,
            createdAt: '2026-04-07T09:00:00.000Z',
            updatedAt: '2026-04-07T09:00:00.000Z',
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
            status: 'active',
            search: null,
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  findAll(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListPortfoliosQueryDto,
  ) {
    return this.portfoliosService.findAll(currentUser, query);
  }
  // ...endPoint END  ...

  @Get(':id')
  @ApiOperation({
    summary: 'Get portfolio by id',
    description:
      'Returns a single portfolio that belongs to the authenticated investor.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID.',
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
  })
  @ApiOkResponse({
    description: 'Portfolio returned successfully.',
    schema: {
      example: {
        id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
        userId: '29d5c25d-42e8-49e7-b590-a954d7cf86f5',
        name: 'Long-Term Core Portfolio',
        description:
          'Primary equity allocation portfolio for long-term monitoring.',
        status: 'active',
        driftMultiplier: 1.5,
        currentAssetCount: 0,
        currentTotalMarketValue: 0,
        currentEqualWeight: 0,
        currentDriftThreshold: 0,
        alertCount: 0,
        lastRecalculatedAt: null,
        createdAt: '2026-04-07T09:00:00.000Z',
        updatedAt: '2026-04-07T09:00:00.000Z',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Portfolio was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  findOne(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) portfolioId: string,
  ) {
    return this.portfoliosService.findOne(currentUser, portfolioId);
  }
  // ...endPoint END  ...

  @Patch(':id/drift-multiplier')
  @ApiOperation({
    summary: 'Update portfolio drift multiplier',
    description:
      'Updates the portfolio-specific drift multiplier within the allowed range of 1.0 to 3.0.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID.',
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
  })
  @ApiBody({ type: UpdateDriftMultiplierDto })
  @ApiOkResponse({
    description: 'Portfolio drift multiplier updated successfully.',
    schema: {
      example: {
        message: 'Portfolio drift multiplier updated successfully',
        portfolio: {
          id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          userId: '29d5c25d-42e8-49e7-b590-a954d7cf86f5',
          name: 'Long-Term Core Portfolio',
          description:
            'Primary equity allocation portfolio for long-term monitoring.',
          status: 'active',
          driftMultiplier: 2.0,
          currentAssetCount: 0,
          currentTotalMarketValue: 0,
          currentEqualWeight: 0,
          currentDriftThreshold: 0,
          alertCount: 0,
          lastRecalculatedAt: null,
          createdAt: '2026-04-07T09:00:00.000Z',
          updatedAt: '2026-04-07T09:15:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Portfolio was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  updateDriftMultiplier(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) portfolioId: string,
    @Body() payload: UpdateDriftMultiplierDto,
  ) {
    return this.portfoliosService.updateDriftMultiplier(
      currentUser,
      portfolioId,
      payload,
    );
  }
  // ...endPoint END  ...

  @Delete(':id')
  @ApiOperation({
    summary: 'Archive portfolio',
    description:
      'Archives the authenticated investor portfolio through the delete endpoint to preserve history.',
  })
  @ApiParam({
    name: 'id',
    description: 'Portfolio UUID.',
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
  })
  @ApiOkResponse({
    description: 'Portfolio archived successfully.',
    schema: {
      example: {
        message: 'Portfolio archived successfully',
        portfolio: {
          id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          userId: '29d5c25d-42e8-49e7-b590-a954d7cf86f5',
          name: 'Long-Term Core Portfolio',
          description:
            'Primary equity allocation portfolio for long-term monitoring.',
          status: 'archived',
          driftMultiplier: 1.5,
          currentAssetCount: 0,
          currentTotalMarketValue: 0,
          currentEqualWeight: 0,
          currentDriftThreshold: 0,
          alertCount: 0,
          lastRecalculatedAt: null,
          createdAt: '2026-04-07T09:00:00.000Z',
          updatedAt: '2026-04-07T09:20:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Portfolio was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) portfolioId: string,
  ) {
    return this.portfoliosService.remove(currentUser, portfolioId);
  }
}

// Currently the delete endpoint performs a soft delete by updating the portfolio status to 'archived' to preserve historical data and recalculation history. If a hard delete is desired in the future, the service method can be updated to permanently remove the record from the database instead of changing its status.
