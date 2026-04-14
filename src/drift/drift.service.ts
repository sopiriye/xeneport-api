import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { DatabaseService } from '../database/database.service';
import { CheckDriftDto } from './dto/check-drift.dto';

@Injectable()
export class DriftService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getPortfolioDriftStatus(
    currentUser: AuthenticatedUser,
    portfolioId: string,
  ) {
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
      },
    });

    if (!portfolio) {
      throw new NotFoundException('Portfolio was not found');
    }

    const holdings = await this.databaseService.holding.findMany({
      where: {
        portfolioId: portfolio.id,
      },
      orderBy: [{ currentWeight: 'desc' }, { createdAt: 'desc' }],
      include: {
        security: {
          include: {
            exchange: true,
          },
        },
        driftEvents: {
          where: {
            eventStatus: 'open',
          },
          orderBy: {
            detectedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    const threshold = portfolio.currentDriftThreshold.toNumber();
    const items = holdings.map((holding) => {
      const currentWeight = holding.currentWeight.toNumber();
      const hasDrift = currentWeight >= threshold && threshold > 0;
      const openDriftEvent = holding.driftEvents[0] ?? null;

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
        currentMarketPrice: holding.currentMarketPrice.toNumber(),
        currentMarketValue: holding.currentMarketValue.toNumber(),
        currentWeight,
        equalWeight: portfolio.currentEqualWeight.toNumber(),
        driftThreshold: threshold,
        hasDrift,
        openDriftEvent: openDriftEvent
          ? {
              id: openDriftEvent.id,
              detectedAt: openDriftEvent.detectedAt,
              eventStatus: openDriftEvent.eventStatus,
              emailStatus: openDriftEvent.emailStatus,
            }
          : null,
      };
    });

    const driftedHoldings = items.filter((item) => item.hasDrift);

    return {
      portfolio: {
        id: portfolio.id,
        name: portfolio.name,
        status: portfolio.status,
        driftMultiplier: portfolio.driftMultiplier.toNumber(),
        currentAssetCount: portfolio.currentAssetCount,
        currentTotalMarketValue: portfolio.currentTotalMarketValue.toNumber(),
        currentEqualWeight: portfolio.currentEqualWeight.toNumber(),
        currentDriftThreshold: threshold,
        lastRecalculatedAt: portfolio.lastRecalculatedAt,
      },
      summary: {
        checkedHoldings: items.length,
        driftedHoldings: driftedHoldings.length,
        hasDrift: driftedHoldings.length > 0,
      },
      items,
    };
  }

  async checkDrift(currentUser: AuthenticatedUser, payload: CheckDriftDto) {
    const portfolios = await this.databaseService.portfolio.findMany({
      where: {
        userId: currentUser.userId,
        status: 'active',
        ...(payload.portfolioId ? { id: payload.portfolioId } : {}),
      },
      select: {
        id: true,
        currentEqualWeight: true,
        currentDriftThreshold: true,
      },
    });

    if (payload.portfolioId && portfolios.length === 0) {
      throw new NotFoundException('Portfolio was not found');
    }

    if (portfolios.length === 0) {
      return {
        message: 'No active portfolios were available for drift check',
        checkedPortfolios: 0,
        checkedHoldings: 0,
        driftedHoldings: 0,
        createdEvents: 0,
        existingOpenEvents: 0,
      };
    }

    const portfolioMap = new Map(
      portfolios.map((portfolio) => [portfolio.id, portfolio]),
    );

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
        currentWeight: true,
      },
    });

    const candidateHoldings = holdings.filter((holding) => {
      const portfolio = portfolioMap.get(holding.portfolioId);

      if (!portfolio) {
        return false;
      }

      const driftThreshold = portfolio.currentDriftThreshold.toNumber();
      return (
        driftThreshold > 0 && holding.currentWeight.toNumber() >= driftThreshold
      );
    });

    if (candidateHoldings.length === 0) {
      return {
        message: 'Drift check completed successfully',
        checkedPortfolios: portfolios.length,
        checkedHoldings: holdings.length,
        driftedHoldings: 0,
        createdEvents: 0,
        existingOpenEvents: 0,
      };
    }

    const existingOpenEvents = await this.databaseService.driftEvent.findMany({
      where: {
        eventStatus: 'open',
        OR: candidateHoldings.map((holding) => ({
          portfolioId: holding.portfolioId,
          holdingId: holding.id,
          securityId: holding.securityId,
        })),
      },
      select: {
        holdingId: true,
      },
    });

    const openHoldingIds = new Set(
      existingOpenEvents.map((event) => event.holdingId),
    );
    const eventsToCreate = candidateHoldings.filter(
      (holding) => !openHoldingIds.has(holding.id),
    );

    if (eventsToCreate.length > 0) {
      await this.databaseService.driftEvent.createMany({
        data: eventsToCreate.map((holding) => {
          const portfolio = portfolioMap.get(holding.portfolioId);

          if (!portfolio) {
            throw new Error('Portfolio context missing during drift creation');
          }

          return {
            portfolioId: holding.portfolioId,
            holdingId: holding.id,
            securityId: holding.securityId,
            detectedAt: new Date(),
            assetWeight: new Prisma.Decimal(
              holding.currentWeight.toNumber().toFixed(1),
            ),
            equalWeight: new Prisma.Decimal(
              portfolio.currentEqualWeight.toNumber().toFixed(1),
            ),
            driftThreshold: new Prisma.Decimal(
              portfolio.currentDriftThreshold.toNumber().toFixed(1),
            ),
          };
        }),
      });
    }

    return {
      message: 'Drift check completed successfully',
      checkedPortfolios: portfolios.length,
      checkedHoldings: holdings.length,
      driftedHoldings: candidateHoldings.length,
      createdEvents: eventsToCreate.length,
      existingOpenEvents: candidateHoldings.length - eventsToCreate.length,
    };
  }
}

// the equal weight in the database does not seem to be important as a column.
