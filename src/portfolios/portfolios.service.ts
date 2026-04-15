import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { ListPortfoliosQueryDto } from './dto/list-portfolios-query.dto';
import { UpdateDriftMultiplierDto } from './dto/update-drift-multiplier.dto';

@Injectable()
export class PortfoliosService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(currentUser: AuthenticatedUser, payload: CreatePortfolioDto) {
    try {
      // create route:
      // Create the portfolio for the authenticated user after normalizing optional description and drift-multiplier input.
      const portfolio = await this.databaseService.portfolio.create({
        data: {
          userId: currentUser.userId,
          name: payload.name.trim(),
          description: this.normalizeDescription(payload.description),
          driftMultiplier: this.toDecimal(payload.driftMultiplier ?? 1.5),
        },
      });

      return {
        message: 'Portfolio created successfully',
        portfolio: this.toPortfolioResponse(portfolio),
      };
    } catch (error) {
      // create route:
      // Translate unique-name violations into the API-friendly conflict response expected by the portfolio endpoint.
      this.handleUniqueNameError(error);
    }
  }

  async findAll(currentUser: AuthenticatedUser, query: ListPortfoliosQueryDto) {
    // findAll route:
    // Derive pagination values and Prisma filters for the authenticated user's portfolio listing endpoint.
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where: Prisma.PortfolioWhereInput = {
      userId: currentUser.userId,
      ...(query.status ? { status: query.status } : { status: 'active' }),
      ...(query.search
        ? {
            name: {
              contains: query.search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    // findAll route:
    // Load the paginated portfolios and total count together so the response can include pagination metadata.
    const [portfolios, total] = await this.databaseService.$transaction([
      this.databaseService.portfolio.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.databaseService.portfolio.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    // findAll route:
    // Return normalized portfolio rows together with the final pagination and applied-filter metadata.
    return {
      data: portfolios.map((portfolio) => this.toPortfolioResponse(portfolio)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        appliedFilters: {
          status: query.status ?? 'active',
          search: query.search ?? null,
        },
      },
    };
  }

  async findOne(currentUser: AuthenticatedUser, portfolioId: string) {
    // findOne route:
    // Resolve the owned portfolio and return its normalized API response payload.
    const portfolio = await this.findOwnedPortfolio(
      currentUser.userId,
      portfolioId,
    );

    return this.toPortfolioResponse(portfolio);
  }

  async updateDriftMultiplier(
    currentUser: AuthenticatedUser,
    portfolioId: string,
    payload: UpdateDriftMultiplierDto,
  ) {
    // updateDriftMultiplier route:
    // Resolve the owned portfolio and reject updates against archived portfolios.
    const portfolio = await this.findOwnedPortfolio(
      currentUser.userId,
      portfolioId,
    );

    if (portfolio.status === 'archived') {
      throw new BadRequestException(
        'Archived portfolios cannot be updated. Restore or recreate the portfolio instead.',
      );
    }

    // updateDriftMultiplier route:
    // Persist the new drift multiplier and return the updated normalized portfolio payload.
    const updatedPortfolio = await this.databaseService.portfolio.update({
      where: { id: portfolioId },
      data: {
        driftMultiplier: this.toDecimal(payload.driftMultiplier),
      },
    });

    return {
      message: 'Portfolio drift multiplier updated successfully',
      portfolio: this.toPortfolioResponse(updatedPortfolio),
    };
  }

  async remove(currentUser: AuthenticatedUser, portfolioId: string) {
    // remove route:
    // Resolve the owned portfolio and reject duplicate archive operations.
    const portfolio = await this.findOwnedPortfolio(
      currentUser.userId,
      portfolioId,
    );

    if (portfolio.status === 'archived') {
      throw new BadRequestException('Portfolio has already been archived');
    }

    // remove route:
    // Soft-delete the portfolio by switching its status to archived so historical state is preserved.
    const archivedPortfolio = await this.databaseService.portfolio.update({
      where: { id: portfolioId },
      data: {
        status: 'archived',
      },
    });

    return {
      message: 'Portfolio archived successfully',
      portfolio: this.toPortfolioResponse(archivedPortfolio),
    };
  }

  private async findOwnedPortfolio(userId: string, portfolioId: string) {
    // findOwnedPortfolio helper:
    // Resolve a portfolio only when it belongs to the supplied user, otherwise raise a not-found response.
    const portfolio = await this.databaseService.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId,
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio was not found');
    }

    return portfolio;
  }

  private normalizeDescription(description?: string) {
    // normalizeDescription helper:
    // Collapse empty descriptions to the persisted sentinel value used by this codebase.
    if (!description || description.trim().length === 0) {
      return 'NIL';
    }

    return description.trim();
  }

  private toDecimal(value: number) {
    // toDecimal helper:
    // Persist numeric drift-multiplier input using the one-decimal precision expected by the schema.
    return new Prisma.Decimal(value.toFixed(1));
  }

  private toPortfolioResponse(portfolio: {
    id: string;
    userId: string;
    name: string;
    description: string;
    status: string;
    driftMultiplier: Prisma.Decimal;
    currentAssetCount: number;
    currentTotalMarketValue: Prisma.Decimal;
    currentEqualWeight: Prisma.Decimal;
    currentDriftThreshold: Prisma.Decimal;
    alertCount: Prisma.Decimal;
    lastRecalculatedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    // toPortfolioResponse helper:
    // Convert decimals and sentinel description values into the portfolio response shape returned by the API.
    return {
      id: portfolio.id,
      userId: portfolio.userId,
      name: portfolio.name,
      description:
        portfolio.description === 'NIL' ? null : portfolio.description,
      status: portfolio.status,
      driftMultiplier: portfolio.driftMultiplier.toNumber(),
      currentAssetCount: portfolio.currentAssetCount,
      currentTotalMarketValue: portfolio.currentTotalMarketValue.toNumber(),
      currentEqualWeight: portfolio.currentEqualWeight.toNumber(),
      currentDriftThreshold: portfolio.currentDriftThreshold.toNumber(),
      alertCount: portfolio.alertCount.toNumber(),
      lastRecalculatedAt: portfolio.lastRecalculatedAt,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    };
  }

  private handleUniqueNameError(error: unknown): never {
    // handleUniqueNameError helper:
    // Map Prisma unique-constraint failures to the portfolio-specific conflict response used by the API.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'You already have a portfolio with this name',
      );
    }

    throw error;
  }
}
