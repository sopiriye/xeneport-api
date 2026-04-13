import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { DatabaseService } from '../database/database.service';
import { RefreshPricesDto } from './dto/refresh-prices.dto';

type HoldingWithSecurity = {
  id: string;
  portfolioId: string;
  securityId: string;
  totalShares: Prisma.Decimal;
};

type LatestPriceRow = {
  securityId: string;
  price: Prisma.Decimal;
  timestamp: Date;
};

@Injectable()
export class PricesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getLatestPriceByTicker(
    _currentUser: AuthenticatedUser,
    ticker: string,
  ) {
    const normalizedTicker = ticker.trim().toUpperCase();

    const security = await this.databaseService.security.findFirst({
      where: {
        ticker: normalizedTicker,
      },
      include: {
        exchange: true,
        prices: {
          orderBy: {
            timestamp: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!security) {
      throw new NotFoundException('Security was not found');
    }

    const latestPrice = security.prices[0];

    if (!latestPrice) {
      throw new NotFoundException('No price data exists for this ticker');
    }

    return {
      ticker: security.ticker,
      companyName: security.companyName,
      exchange: {
        id: security.exchange.id,
        tickerPrefix: security.exchange.tickerPrefix,
        name: security.exchange.name,
      },
      latestPrice: {
        id: latestPrice.id,
        securityId: latestPrice.securityId,
        price: latestPrice.price.toNumber(),
        timestamp: latestPrice.timestamp,
        createdAt: latestPrice.createdAt,
      },
    };
  }

  async refreshPrices(
    currentUser: AuthenticatedUser,
    payload: RefreshPricesDto,
  ) {
    const portfolioWhere: Prisma.PortfolioWhereInput = {
      userId: currentUser.userId,
      status: 'active',
      ...(payload.portfolioId ? { id: payload.portfolioId } : {}),
    };

    const portfolios = await this.databaseService.portfolio.findMany({
      where: portfolioWhere,
      select: {
        id: true,
        driftMultiplier: true,
      },
    });

    if (payload.portfolioId && portfolios.length === 0) {
      throw new NotFoundException('Portfolio was not found');
    }

    // if (portfolios.length === 0) {
    //   return {
    //     message: 'No active portfolios were available for refresh',
    //     refreshedPortfolios: 0,
    //     refreshedHoldings: 0,
    //     latestPriceCount: 0,
    //   };
    // }

    // const portfolioMap = new Map(
    //   portfolios.map((portfolio) => [portfolio.id, portfolio]),
    // );

    const holdings = await this.databaseService.holding.findMany({
      where: {
        portfolioId: {
          in: portfolios.map((portfolio) => portfolio.id),
        },
      },
      select: {
        id: true,
        portfolioId: true,
        securityId: true,
        totalShares: true,
      },
    });

    if (holdings.length === 0) {
      await this.databaseService.$transaction(
        portfolios.map((portfolio) =>
          this.databaseService.portfolio.update({
            where: { id: portfolio.id },
            data: {
              currentAssetCount: 0,
              currentTotalMarketValue: new Prisma.Decimal('0.00'),
              currentEqualWeight: new Prisma.Decimal('0.0'),
              currentDriftThreshold: new Prisma.Decimal('0.0'),
              lastRecalculatedAt: new Date(),
            },
          }),
        ),
      );

      return {
        message: 'Portfolios refreshed successfully',
        refreshedPortfolios: portfolios.length,
        refreshedHoldings: 0,
        latestPriceCount: 0,
      };
    }

    const latestPrices = await this.getLatestPricesForSecurities(
      holdings.map((holding) => holding.securityId),
    );
    const latestPriceMap = new Map<string, LatestPriceRow>(
      latestPrices.map((price) => [price.securityId, price]),
    );

    const totalsByPortfolio = new Map<string, number>();
    const preliminaryHoldings = holdings.map((holding) =>
      this.buildHoldingRefreshData(holding, latestPriceMap, totalsByPortfolio),
    );
    const updatedHoldings = preliminaryHoldings.map((holding) => {
      const portfolioTotal = totalsByPortfolio.get(holding.portfolioId) ?? 0;

      const currentWeight =
        portfolioTotal === 0
          ? 0
          : this.roundTo(
              (holding.currentMarketValue / portfolioTotal) * 100,
              1,
            );

      return {
        ...holding,
        currentWeight,
      };
    });
    // const updatedHoldings = preliminaryHoldings.map((holding) => {
    //   const portfolioTotal = totalsByPortfolio.get(holding.portfolioId) ?? 0;

    //   return {
    //     ...holding,
    //     currentWeight:
    //       portfolioTotal === 0
    //         ? 0
    //         : this.roundTo(
    //             (holding.currentMarketValue / portfolioTotal) * 100,
    //             1,
    //           ),
    //   };
    // });

    const portfolioUpdates = portfolios.map((portfolio) =>
      this.buildPortfolioRefreshData(
        portfolio.id,
        portfolio.driftMultiplier,
        holdings,
        totalsByPortfolio,
      ),
    );

    await this.databaseService.$transaction(async (tx) => {
      for (const holding of updatedHoldings) {
        await tx.holding.update({
          where: { id: holding.id },
          data: {
            currentMarketPrice: new Prisma.Decimal(
              holding.currentMarketPrice.toFixed(2),
            ),
            currentMarketValue: new Prisma.Decimal(
              holding.currentMarketValue.toFixed(2),
            ),
            currentWeight: new Prisma.Decimal(holding.currentWeight.toFixed(1)),
          },
        });
      }

      for (const portfolio of portfolioUpdates) {
        await tx.portfolio.update({
          where: { id: portfolio.id },
          data: {
            currentAssetCount: portfolio.currentAssetCount,
            currentTotalMarketValue: new Prisma.Decimal(
              portfolio.currentTotalMarketValue.toFixed(2),
            ),
            currentEqualWeight: new Prisma.Decimal(
              portfolio.currentEqualWeight.toFixed(1),
            ),
            currentDriftThreshold: new Prisma.Decimal(
              portfolio.currentDriftThreshold.toFixed(1),
            ),
            lastRecalculatedAt: new Date(),
          },
        });
      }
    });

    return {
      message: 'Portfolios refreshed successfully',
      refreshedPortfolios: portfolios.length,
      refreshedHoldings: updatedHoldings.length,
      latestPriceCount: latestPrices.length,
    };
  }

  private async getLatestPricesForSecurities(securityIds: string[]) {
    const uniqueSecurityIds = [...new Set(securityIds)];

    if (uniqueSecurityIds.length === 0) {
      return [];
    }

    return this.databaseService.$queryRaw<LatestPriceRow[]>`
      select distinct on ("security_id")
        "security_id" as "securityId",
        "price",
        "timestamp"
      from "prices"
      where "security_id" in (${Prisma.join(uniqueSecurityIds)})
      order by "security_id", "timestamp" desc
    `;
  }

  private buildHoldingRefreshData(
    holding: HoldingWithSecurity,
    latestPriceMap: Map<string, LatestPriceRow>,
    totalsByPortfolio: Map<string, number>,
  ) {
    const latestPrice = latestPriceMap.get(holding.securityId);
    const price = latestPrice ? latestPrice.price.toNumber() : 0;
    const marketValue = holding.totalShares.toNumber() * price;
    const currentPortfolioTotal =
      totalsByPortfolio.get(holding.portfolioId) ?? 0;

    totalsByPortfolio.set(
      holding.portfolioId,
      currentPortfolioTotal + marketValue,
    );

    return {
      id: holding.id,
      portfolioId: holding.portfolioId,
      currentMarketPrice: this.roundTo(price, 2),
      currentMarketValue: this.roundTo(marketValue, 2),
      currentWeight: 0,
    };
  }

  private buildPortfolioRefreshData(
    portfolioId: string,
    driftMultiplier: Prisma.Decimal,
    holdings: HoldingWithSecurity[],
    totalsByPortfolio: Map<string, number>,
  ) {
    const holdingsInPortfolio = holdings.filter(
      (holding) => holding.portfolioId === portfolioId,
    );
    const currentAssetCount = holdingsInPortfolio.length;
    const currentTotalMarketValue = totalsByPortfolio.get(portfolioId) ?? 0;
    const currentEqualWeight =
      currentAssetCount === 0
        ? 0
        : this.roundTo((1 / currentAssetCount) * 100, 1);
    const currentDriftThreshold = this.roundTo(
      currentEqualWeight * driftMultiplier.toNumber(),
      1,
    );

    return {
      id: portfolioId,
      currentAssetCount,
      currentTotalMarketValue,
      currentEqualWeight,
      currentDriftThreshold,
    };
  }

  private roundTo(value: number, decimals: number) {
    return Number(value.toFixed(decimals));
  }
}
