import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AllocationService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getPortfolioAllocation(
    currentUser: AuthenticatedUser,
    portfolioId: string,
  ) {
    // getPortfolioAllocation route:
    // Load the authenticated user's portfolio together with the cached allocation summary fields maintained by the price refresh flow.
    const portfolio = await this.databaseService.portfolio.findFirst({
      where: {
        id: portfolioId,
        userId: currentUser.userId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        driftMultiplier: true,
        currentAssetCount: true,
        currentTotalMarketValue: true,
        currentEqualWeight: true,
        currentDriftThreshold: true,
        lastRecalculatedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio was not found');
    }

    // getPortfolioAllocation route:
    // Load all holdings in the portfolio and include the related security and exchange metadata needed for the allocation response.
    const holdings = await this.databaseService.holding.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        security: {
          include: {
            exchange: true,
          },
        },
      },
    });

    // getPortfolioAllocation route:
    // Shape the per-holding allocation rows by reading the cached market values and weights already stored on the holdings table.
    const allocations = holdings.map((holding) => {
      return {
        holdingId: holding.id,
        securityId: holding.securityId,
        ticker: holding.security.ticker,
        companyName: holding.security.companyName,
        exchange: {
          id: holding.security.exchange.id,
          tickerPrefix: holding.security.exchange.tickerPrefix,
          name: holding.security.exchange.name,
        },
        shares: holding.totalShares.toNumber(),
        marketPrice: holding.currentMarketPrice.toNumber(),
        marketValue: holding.currentMarketValue.toNumber(),
        allocationWeight: holding.currentWeight.toNumber(),
        priceTimestamp: null,
        lastTransactionAt: holding.lastTransactionAt,
        createdAt: holding.createdAt,
        updatedAt: holding.updatedAt,
      };
    });

    // getPortfolioAllocation route:
    // Return the portfolio allocation payload with both portfolio-level summary fields and per-holding allocation rows.
    return {
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        status: portfolio.status,
        driftMultiplier: portfolio.driftMultiplier.toNumber(),
        lastRecalculatedAt: portfolio.lastRecalculatedAt,
        createdAt: portfolio.createdAt,
        updatedAt: portfolio.updatedAt,
      },
      summary: {
        assetCount: portfolio.currentAssetCount,
        totalMarketValue: portfolio.currentTotalMarketValue.toNumber(),
        equalWeight: portfolio.currentEqualWeight.toNumber(),
        driftThreshold: portfolio.currentDriftThreshold.toNumber(),
      },
      allocations,
    };
  }
}
