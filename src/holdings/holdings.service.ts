import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { DatabaseService } from '../database/database.service';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { ListHoldingsQueryDto } from './dto/list-holdings-query.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';

@Injectable()
export class HoldingsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(currentUser: AuthenticatedUser, payload: CreateHoldingDto) {
    const portfolio = await this.findOwnedPortfolio(
      currentUser.userId,
      payload.portfolioId, // i think the frontend should send the portfolioId in the payload instead of the query, as it's a required field for creating a holding and it keeps the endpoint cleaner without mixing query and body parameters
    );
    this.ensurePortfolioIsActive(portfolio.status);

    const security = await this.findSecurityByTicker(payload.ticker);

    const existingHolding = await this.databaseService.holding.findFirst({
      where: {
        portfolioId: portfolio.id,
        securityId: security.id,
      },
      select: { id: true },
    });

    if (existingHolding) {
      throw new ConflictException(
        'This security already exists in the selected portfolio',
      );
    }

    const createdHolding = await this.databaseService.$transaction(
      async (tx) => {
        const holding = await tx.holding.create({
          data: {
            portfolioId: portfolio.id,
            securityId: security.id,
            totalShares: new Prisma.Decimal(payload.shares),
            lastTransactionAt: new Date(),
          },
          include: {
            security: {
              include: {
                exchange: true,
              },
            },
          },
        });

        await this.syncPortfolioCachedFields(tx, portfolio.id);

        return holding;
      },
    );

    return {
      message: 'Holding created successfully',
      holding: this.toHoldingResponse(createdHolding),
    };
  }
  // ...endPoint END  ...

  async update(
    currentUser: AuthenticatedUser,
    holdingId: string,
    payload: UpdateHoldingDto,
  ) {
    const existingHolding = await this.findOwnedHolding(
      currentUser.userId,
      holdingId,
    );
    this.ensurePortfolioIsActive(existingHolding.portfolio.status);

    const updatedHolding = await this.databaseService.holding.update({
      where: { id: holdingId },
      data: {
        totalShares: new Prisma.Decimal(payload.shares),
        lastTransactionAt: new Date(),
      },
      include: {
        security: {
          include: {
            exchange: true,
          },
        },
      },
    });

    return {
      message: 'Holding updated successfully',
      holding: this.toHoldingResponse(updatedHolding),
    };
  }
  // ...endPoint END  ...

  async remove(currentUser: AuthenticatedUser, holdingId: string) {
    const holding = await this.findOwnedHolding(currentUser.userId, holdingId);
    this.ensurePortfolioIsActive(holding.portfolio.status);

    const deletedHolding = await this.databaseService.$transaction(
      async (tx) => {
        const removed = await tx.holding.delete({
          where: { id: holdingId },
          include: {
            security: {
              include: {
                exchange: true,
              },
            },
          },
        });

        await this.syncPortfolioCachedFields(tx, holding.portfolioId);

        return removed;
      },
    );

    return {
      message: 'Holding removed successfully',
      holding: this.toHoldingResponse(deletedHolding),
    };
  }
  // ...endPoint END  ...

  async findByPortfolio(
    currentUser: AuthenticatedUser,
    portfolioId: string,
    query: ListHoldingsQueryDto,
  ) {
    const portfolio = await this.findOwnedPortfolio(
      currentUser.userId,
      portfolioId,
    );
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: Prisma.HoldingWhereInput = {
      portfolioId: portfolio.id,
      ...(query.search
        ? {
            OR: [
              {
                security: {
                  ticker: {
                    contains: query.search.toUpperCase(),
                  },
                },
              },
              {
                security: {
                  companyName: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [holdings, total] = await this.databaseService.$transaction([
      this.databaseService.holding.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit,
        include: {
          security: {
            include: {
              exchange: true,
            },
          },
        },
      }),
      this.databaseService.holding.count({ where }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        status: portfolio.status,
      },
      data: holdings.map((holding) => this.toHoldingResponse(holding)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        appliedFilters: {
          search: query.search ?? null,
        },
      },
    };
  }
  // i am yet to fully review the findByPortfolio endpoint, but i think it would be good to add a search filter for ticker and company name, as it would be a common use case for portfolios with many holdings and it can be easily implemented with Prisma's filtering capabilities. i will review the endpoint and add the search functionality if it looks good.
  // ...endPoint END  ...

  private async findOwnedPortfolio(userId: string, portfolioId: string) {
    const portfolio = await this.databaseService.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        driftMultiplier: true,
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio was not found');
    }

    return portfolio;
  }

  private async findSecurityByTicker(ticker: string) {
    const normalizedTicker = ticker.trim().toUpperCase();

    const security = await this.databaseService.security.findFirst({
      where: {
        ticker: normalizedTicker,
      },
      include: {
        exchange: true,
      },
    });

    if (!security) {
      throw new BadRequestException(
        'Ticker is invalid or not available in the predefined stock list',
      );
    }

    return security;
  }

  private async findOwnedHolding(userId: string, holdingId: string) {
    const holding = await this.databaseService.holding.findFirst({
      where: {
        id: holdingId,
        portfolio: {
          userId,
        },
      },
      include: {
        portfolio: {
          select: {
            id: true,
            status: true,
          },
        },
        security: {
          include: {
            exchange: true,
          },
        },
      },
    });

    if (!holding) {
      throw new NotFoundException('Holding was not found');
    }

    return holding;
  }

  private ensurePortfolioIsActive(status: string) {
    if (status === 'archived') {
      throw new BadRequestException('Archived portfolios cannot be modified');
    }
  }

  private async syncPortfolioCachedFields(
    tx: Prisma.TransactionClient,
    portfolioId: string,
  ) {
    const [portfolio, assetCount] = await Promise.all([
      tx.portfolio.findUniqueOrThrow({
        where: { id: portfolioId },
        select: {
          driftMultiplier: true,
        },
      }),
      tx.holding.count({
        where: { portfolioId },
      }),
    ]);

    const equalWeight =
      assetCount === 0 ? 0 : Number(((1 / assetCount) * 100).toFixed(1));
    const driftThreshold =
      assetCount === 0
        ? 0
        : Number(
            (equalWeight * portfolio.driftMultiplier.toNumber()).toFixed(1),
          );

    await tx.portfolio.update({
      where: { id: portfolioId },
      data: {
        currentAssetCount: assetCount,
        currentEqualWeight: new Prisma.Decimal(equalWeight.toFixed(1)),
        currentDriftThreshold: new Prisma.Decimal(driftThreshold.toFixed(1)),
        lastRecalculatedAt: new Date(),
      },
    });
  }

  private toHoldingResponse(holding: {
    id: string;
    portfolioId: string;
    securityId: string;
    totalShares: Prisma.Decimal;
    currentMarketPrice: Prisma.Decimal;
    currentMarketValue: Prisma.Decimal;
    currentWeight: Prisma.Decimal;
    lastTransactionAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    security: {
      ticker: string;
      companyName: string;
      exchange: {
        tickerPrefix: string;
        name: string;
      };
    };
  }) {
    return {
      id: holding.id,
      portfolioId: holding.portfolioId,
      securityId: holding.securityId,
      ticker: holding.security.ticker,
      companyName: holding.security.companyName,
      exchange: {
        tickerPrefix: holding.security.exchange.tickerPrefix,
        name: holding.security.exchange.name,
      },
      shares: holding.totalShares.toNumber(),
      currentMarketPrice: holding.currentMarketPrice.toNumber(),
      currentMarketValue: holding.currentMarketValue.toNumber(),
      currentWeight: holding.currentWeight.toNumber(),
      lastTransactionAt: holding.lastTransactionAt,
      createdAt: holding.createdAt,
      updatedAt: holding.updatedAt,
    };
  }
}

// i think it's better to validate portfolio ownership and status before validating the ticker, as it's a more common error and saves an unnecessary database query in that case
