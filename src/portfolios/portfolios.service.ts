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
      this.handleUniqueNameError(error);
    }
  }

  async findAll(currentUser: AuthenticatedUser, query: ListPortfoliosQueryDto) {
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
    const portfolio = await this.findOwnedPortfolio(
      currentUser.userId,
      portfolioId,
    );

    if (portfolio.status === 'archived') {
      throw new BadRequestException(
        'Archived portfolios cannot be updated. Restore or recreate the portfolio instead.',
      );
    }

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
    const portfolio = await this.findOwnedPortfolio(
      currentUser.userId,
      portfolioId,
    );

    if (portfolio.status === 'archived') {
      throw new BadRequestException('Portfolio has already been archived');
    }

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
    if (!description || description.trim().length === 0) {
      return 'NIL';
    }

    return description.trim();
  }

  private toDecimal(value: number) {
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
