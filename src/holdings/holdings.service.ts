import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { DatabaseService } from '../database/database.service';
import { DriftService } from '../drift/drift.service';
import { PricesService } from '../prices/prices.service';
import { CreateHoldingDto } from './dto/create-holding.dto';
import { ListHoldingsQueryDto } from './dto/list-holdings-query.dto';
import { UpdateHoldingDto } from './dto/update-holding.dto';

@Injectable()
export class HoldingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly pricesService: PricesService,
    private readonly driftService: DriftService,
  ) {}

  async create(currentUser: AuthenticatedUser, payload: CreateHoldingDto) {
    // create route:
    // Validate portfolio ownership and mutability first before resolving the referenced security ticker.
    const portfolio = await this.findOwnedPortfolio(
      currentUser.userId,
      payload.portfolioId, // i think the frontend should send the portfolioId in the payload instead of the query, as it's a required field for creating a holding and it keeps the endpoint cleaner without mixing query and body parameters
    );
    this.ensurePortfolioIsActive(portfolio.status);

    const security = await this.findSecurityByTicker(payload.ticker);

    // create route:
    // Prevent duplicate holdings for the same security inside the selected portfolio.
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

    // create route:
    // Create the holding and refresh the cached portfolio allocation fields in the same transaction.
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

    // create route:
    // Run the downstream price refresh and drift detection flows for the affected portfolio immediately after the holding write succeeds.
    await this.refreshPortfolioStateAfterHoldingMutation(
      currentUser,
      portfolio.id,
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
    // update route:
    // Confirm ownership and portfolio mutability before updating the holding share quantity.
    const existingHolding = await this.findOwnedHolding(
      currentUser.userId,
      holdingId,
    );
    this.ensurePortfolioIsActive(existingHolding.portfolio.status);

    // update route:
    // Persist the new share quantity and refresh the holding transaction timestamp for auditability.
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

    // update route:
    // Run the downstream price refresh and drift detection flows for the affected portfolio immediately after the holding write succeeds.
    await this.refreshPortfolioStateAfterHoldingMutation(
      currentUser,
      existingHolding.portfolio.id,
    );

    return {
      message: 'Holding updated successfully',
      holding: this.toHoldingResponse(updatedHolding),
    };
  }
  // ...endPoint END  ...

  async remove(currentUser: AuthenticatedUser, holdingId: string) {
    // remove route:
    // Confirm the holding belongs to the authenticated user and that its portfolio can still be modified.
    const holding = await this.findOwnedHolding(currentUser.userId, holdingId);
    this.ensurePortfolioIsActive(holding.portfolio.status);

    // remove route:
    // Delete the holding and refresh the cached portfolio allocation fields in the same transaction.
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

    // remove route:
    // Run the downstream price refresh and drift detection flows for the affected portfolio immediately after the holding write succeeds.
    await this.refreshPortfolioStateAfterHoldingMutation(
      currentUser,
      holding.portfolioId,
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
    // findByPortfolio route:
    // Confirm portfolio ownership, then derive the pagination window and optional security search filters.
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

    // findByPortfolio route:
    // Load the paginated holdings and total count together so the response can include pagination metadata.
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

    // findByPortfolio route:
    // Return the portfolio header, normalized holding rows, and pagination metadata for the holdings listing endpoint.
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
    // findOwnedPortfolio helper:
    // Resolve a portfolio only when it belongs to the supplied user, otherwise raise a not-found response.
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
    // findSecurityByTicker helper:
    // Normalize the ticker and load the predefined security record that holdings are allowed to reference.
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
    // findOwnedHolding helper:
    // Resolve a holding only when it belongs to a portfolio owned by the supplied user.
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
    // ensurePortfolioIsActive helper:
    // Block write operations against archived portfolios so historical data remains immutable.
    if (status === 'archived') {
      throw new BadRequestException('Archived portfolios cannot be modified');
    }
  }

  private async syncPortfolioCachedFields(
    tx: Prisma.TransactionClient,
    portfolioId: string,
  ) {
    // syncPortfolioCachedFields helper:
    // Recalculate asset count, equal weight, and drift threshold whenever holdings are added or removed.
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
    const driftThreshold = Number(
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

  private async refreshPortfolioStateAfterHoldingMutation(
    currentUser: AuthenticatedUser,
    portfolioId: string,
  ) {
    // refreshPortfolioStateAfterHoldingMutation helper:
    // Re-run the price refresh flow first so holding and portfolio cache fields are current before drift detection reads them.
    await this.pricesService.refreshPrices(currentUser, {
      portfolioId,
    });

    // refreshPortfolioStateAfterHoldingMutation helper:
    // Run drift detection for the same portfolio so open and resolved drift events stay aligned with the latest holding state.
    await this.driftService.checkDrift(currentUser, {
      portfolioId,
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
    // toHoldingResponse helper:
    // Convert decimals and related security metadata into the holding response shape returned by the API.
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
