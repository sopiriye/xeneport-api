import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AlertsService } from '../alerts/alerts.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { DatabaseService } from '../database/database.service';
import { CheckDriftDto } from './dto/check-drift.dto';

@Injectable()
export class DriftService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly alertsService: AlertsService,
  ) {}

  async getPortfolioDriftStatus(
    currentUser: AuthenticatedUser,
    portfolioId: string,
  ) {
    // getPortfolioDriftStatus route:
    // Load the authenticated user's portfolio-level drift configuration and cached allocation state.
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

    // getPortfolioDriftStatus route:
    // Load the portfolio holdings together with the latest open drift-event context for each holding.
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

    // getPortfolioDriftStatus route:
    // Shape the drift-status response for each holding using cached weights and open-event state.
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

    // getPortfolioDriftStatus route:
    // Summarize the portfolio drift state and return the final endpoint response payload.
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
    // checkDrift route:
    // Load the active portfolios owned by the authenticated user that should participate in drift checking.
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

    // checkDrift route:
    // Load the holdings for the selected portfolios and isolate the holdings that currently exceed the drift threshold.
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

    // checks those drift events that are no longer in drift and resolves them{
    // checkDrift route:
    // Compare the current candidate holdings against open drift events already in the database and resolve stale ones.
    const candidateHoldingKeys = new Set(
      candidateHoldings.map(
        (holding) =>
          `${holding.portfolioId}:${holding.id}:${holding.securityId}`,
      ),
    );

    const openDriftEventsInScope =
      await this.databaseService.driftEvent.findMany({
        where: {
          eventStatus: 'open',
          portfolioId: {
            in: portfolios.map((portfolio) => portfolio.id),
          },
        },
        select: {
          id: true,
          portfolioId: true,
          holdingId: true,
          securityId: true,
        },
      });

    const resolvedDriftEventIds = openDriftEventsInScope
      .filter(
        (event) =>
          !candidateHoldingKeys.has(
            `${event.portfolioId}:${event.holdingId}:${event.securityId}`,
          ),
      )
      .map((event) => event.id);

    if (resolvedDriftEventIds.length > 0) {
      await this.databaseService.driftEvent.updateMany({
        where: {
          id: {
            in: resolvedDriftEventIds,
          },
        },
        data: {
          eventStatus: 'resolved',
        },
      });
    }
    // end of drift event resolution block

    // checkDrift route:
    // Exit early when no holdings are currently in drift after stale open events have been resolved.
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

    // checkDrift route:
    // Detect which current drift candidates already have open events so only new drift cases create new records.
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

    const createdEvents: Array<{
      id: string;
      portfolioId: string;
      securityId: string;
      holdingId: string;
      assetWeight: number;
      equalWeight: number;
      driftThreshold: number;
      ticker: string;
      companyName: string;
    }> = [];

    // checkDrift route:
    // Create new drift-event records for fresh drift cases and collect the payload needed for downstream alert creation.
    if (eventsToCreate.length > 0) {
      const holdingsById = new Map(
        (
          await this.databaseService.holding.findMany({
            where: {
              id: {
                in: eventsToCreate.map((holding) => holding.id),
              },
            },
            include: {
              security: {
                select: {
                  ticker: true,
                  companyName: true,
                },
              },
            },
          })
        ).map((holding) => [holding.id, holding]),
      );

      for (const holding of eventsToCreate) {
        const portfolio = portfolioMap.get(holding.portfolioId);
        const holdingDetail = holdingsById.get(holding.id);

        if (!portfolio || !holdingDetail) {
          throw new Error('Drift context missing during event creation');
        }

        const createdEvent = await this.databaseService.driftEvent.create({
          data: {
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
          },
        });

        createdEvents.push({
          id: createdEvent.id,
          portfolioId: createdEvent.portfolioId,
          securityId: createdEvent.securityId,
          holdingId: createdEvent.holdingId,
          assetWeight: createdEvent.assetWeight.toNumber(),
          equalWeight: createdEvent.equalWeight.toNumber(),
          driftThreshold: createdEvent.driftThreshold.toNumber(),
          ticker: holdingDetail.security.ticker,
          companyName: holdingDetail.security.companyName,
        });
      }

      // checkDrift route:
      // Hand off the newly created drift events to the alert module so alert history and notifications are generated immediately.
      await this.alertsService.createAlertsForDriftEvents(
        createdEvents.map((event) => ({
          userId: currentUser.userId,
          portfolioId: event.portfolioId,
          driftEventId: event.id,
          ticker: event.ticker,
          companyName: event.companyName,
          currentWeight: event.assetWeight,
          driftThreshold: event.driftThreshold,
        })),
      );
    }

    // checkDrift route:
    // Return the final drift-check summary, including fresh events and already-open events that remained in drift.
    return {
      message: 'Drift check completed successfully',
      checkedPortfolios: portfolios.length,
      checkedHoldings: holdings.length,
      driftedHoldings: candidateHoldings.length,
      createdEvents: createdEvents.length,
      existingOpenEvents: candidateHoldings.length - eventsToCreate.length,
    };
  }
}
