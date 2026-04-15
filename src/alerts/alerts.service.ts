import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Alert, AlertChannel, AlertStatus, Prisma } from '@prisma/client';
import { AlertsEmailService } from './alerts-email.service';
import { AuthenticatedUser } from '../auth/types/authenticated-user.interface';
import { DatabaseService } from '../database/database.service';
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto';

type DriftAlertInput = {
  userId: string;
  portfolioId: string;
  driftEventId: string;
  ticker: string;
  companyName: string;
  currentWeight: number;
  driftThreshold: number;
};

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly alertsEmailService: AlertsEmailService,
  ) {}

  async createAlertsForDriftEvents(inputs: DriftAlertInput[]) {
    if (inputs.length === 0) {
      return [];
    }

    // createAlertsForDriftEvents flow:
    // Prepare reusable lookup sets and in-memory buffers that will support both database writes and outbound email delivery.
    const createdAlertIds: string[] = [];
    const emailAlertsToSend: Array<{
      userId: string;
      portfolioId: string;
      driftEventId: string;
      to: string;
      recipientName: string;
      portfolioName: string;
      ticker: string;
      companyName: string;
      currentWeight: number;
      driftThreshold: number;
      title: string;
      message: string;
    }> = [];
    const touchedPortfolioIds = new Set<string>();
    const userIds = [...new Set(inputs.map((input) => input.userId))];
    const portfolioIds = [...new Set(inputs.map((input) => input.portfolioId))];

    // createAlertsForDriftEvents flow:
    // Load the user and portfolio context needed to build alert records and email content.
    const [users, portfolios] = await Promise.all([
      this.databaseService.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          email: true,
          firstName: true,
        },
      }),
      this.databaseService.portfolio.findMany({
        where: { id: { in: portfolioIds } },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    const userMap = new Map(users.map((user) => [user.id, user]));
    const portfolioMap = new Map(
      portfolios.map((portfolio) => [portfolio.id, portfolio]),
    );

    // createAlertsForDriftEvents flow:
    // Create in-app alerts inside a transaction and queue the follow-up email work for processing after the transaction commits.
    await this.databaseService.$transaction(async (tx) => {
      for (const input of inputs) {
        const user = userMap.get(input.userId);
        const portfolio = portfolioMap.get(input.portfolioId);

        if (!user || !portfolio) {
          throw new Error('Alert context missing during alert creation');
        }

        const title = `Drift detected for ${input.ticker}`;
        const message = `${input.ticker} (${input.companyName}) weight is ${input.currentWeight.toFixed(1)}%, above the drift threshold of ${input.driftThreshold.toFixed(1)}%.`;

        const inAppAlert = await tx.alert.create({
          data: {
            userId: input.userId,
            portfolioId: input.portfolioId,
            driftEventId: input.driftEventId,
            channel: 'in_app',
            status: 'unread',
            title,
            message,
          },
        });

        createdAlertIds.push(inAppAlert.id);
        touchedPortfolioIds.add(input.portfolioId);

        emailAlertsToSend.push({
          userId: input.userId,
          portfolioId: input.portfolioId,
          driftEventId: input.driftEventId,
          to: user.email,
          recipientName: user.firstName,
          portfolioName: portfolio.name,
          ticker: input.ticker,
          companyName: input.companyName,
          currentWeight: input.currentWeight,
          driftThreshold: input.driftThreshold,
          title,
          message,
        });
      }

      await this.syncPortfolioAlertCountsTx(tx, [...touchedPortfolioIds]);
    });

    // createAlertsForDriftEvents flow:
    // Send the real email notifications one by one and persist the email-channel alert history plus drift email status outcome.
    for (const emailAlert of emailAlertsToSend) {
      try {
        await this.alertsEmailService.sendDriftAlertEmail({
          to: emailAlert.to,
          recipientName: emailAlert.recipientName,
          portfolioName: emailAlert.portfolioName,
          ticker: emailAlert.ticker,
          companyName: emailAlert.companyName,
          currentWeight: emailAlert.currentWeight,
          driftThreshold: emailAlert.driftThreshold,
        });

        await this.databaseService.$transaction([
          this.databaseService.alert.create({
            data: {
              userId: emailAlert.userId,
              portfolioId: emailAlert.portfolioId,
              driftEventId: emailAlert.driftEventId,
              channel: 'email',
              status: 'sent',
              title: emailAlert.title,
              message: emailAlert.message,
              sentAt: new Date(),
            },
          }),
          this.databaseService.driftEvent.update({
            where: { id: emailAlert.driftEventId },
            data: {
              emailStatus: 'success',
            },
          }),
        ]);
      } catch (error) {
        this.logger.error(
          `Failed to send drift alert email to ${emailAlert.to}: ${error instanceof Error ? error.message : error}`,
        );

        await this.databaseService.$transaction([
          this.databaseService.alert.create({
            data: {
              userId: emailAlert.userId,
              portfolioId: emailAlert.portfolioId,
              driftEventId: emailAlert.driftEventId,
              channel: 'email',
              status: 'failed',
              title: emailAlert.title,
              message: emailAlert.message,
            },
          }),
          this.databaseService.driftEvent.update({
            where: { id: emailAlert.driftEventId },
            data: {
              emailStatus: 'failed',
            },
          }),
        ]);
      }
    }

    this.logger.log(
      `Created ${createdAlertIds.length} in-app alert(s) for ${inputs.length} drift event(s)`,
    );

    return createdAlertIds;
  }

  async listAlerts(currentUser: AuthenticatedUser, query: ListAlertsQueryDto) {
    // listAlerts route:
    // Build the pagination values and Prisma filters for the authenticated user's alert feed.
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;
    const where: Prisma.AlertWhereInput = {
      userId: currentUser.userId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.portfolioId ? { portfolioId: query.portfolioId } : {}),
    };

    // listAlerts route:
    // Load the paginated alerts together with portfolio/drift context and compute unread in-app alert count for the user.
    const [alerts, total, unreadCount] =
      await this.databaseService.$transaction([
        this.databaseService.alert.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          skip,
          take: limit,
          include: {
            portfolio: {
              select: {
                id: true,
                name: true,
              },
            },
            driftEvent: {
              select: {
                id: true,
                detectedAt: true,
                eventStatus: true,
              },
            },
          },
        }),
        this.databaseService.alert.count({ where }),
        this.databaseService.alert.count({
          where: {
            userId: currentUser.userId,
            channel: 'in_app',
            status: 'unread',
          },
        }),
      ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    // listAlerts route:
    // Shape the final paginated response payload with the applied filters and unread summary.
    return {
      data: alerts.map((alert) => this.toAlertResponse(alert)),
      meta: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
        unreadCount,
        appliedFilters: {
          status: query.status ?? null,
          channel: query.channel ?? null,
          portfolioId: query.portfolioId ?? null,
        },
      },
    };
  }

  async getAlertById(currentUser: AuthenticatedUser, alertId: string) {
    // getAlertById route:
    // Load the requested alert and its related portfolio and drift-event context for the authenticated user.
    const alert = await this.databaseService.alert.findFirst({
      where: {
        id: alertId,
        userId: currentUser.userId,
      },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true,
          },
        },
        driftEvent: {
          select: {
            id: true,
            detectedAt: true,
            eventStatus: true,
            assetWeight: true,
            equalWeight: true,
            driftThreshold: true,
          },
        },
      },
    });

    if (!alert) {
      throw new NotFoundException('Alert was not found');
    }

    // getAlertById route:
    // Return the normalized alert response once ownership and existence have been confirmed.
    return this.toAlertResponse(alert);
  }

  async markAsRead(currentUser: AuthenticatedUser, alertId: string) {
    // markAsRead route:
    // Load the alert ownership and channel metadata needed to decide whether the alert can transition to read.
    const alert = await this.databaseService.alert.findFirst({
      where: {
        id: alertId,
        userId: currentUser.userId,
      },
      select: {
        id: true,
        status: true,
        channel: true,
        portfolioId: true,
      },
    });

    if (!alert) {
      throw new NotFoundException('Alert was not found');
    }

    // markAsRead route:
    // Update the alert read state, reload its related context, and then refresh the cached unread count on the portfolio.
    const updatedAlert = await this.databaseService.alert.update({
      where: { id: alert.id },
      data: {
        status: alert.channel === 'in_app' ? 'read' : alert.status,
        readAt: alert.channel === 'in_app' ? new Date() : undefined,
      },
      include: {
        portfolio: {
          select: {
            id: true,
            name: true,
          },
        },
        driftEvent: {
          select: {
            id: true,
            detectedAt: true,
            eventStatus: true,
            assetWeight: true,
            equalWeight: true,
            driftThreshold: true,
          },
        },
      },
    });

    await this.syncPortfolioAlertCounts([alert.portfolioId]);

    // markAsRead route:
    // Return the updated alert payload after the unread-count cache has been synchronized.
    return {
      message: 'Alert marked as read successfully',
      alert: this.toAlertResponse(updatedAlert),
    };
  }

  async syncPortfolioAlertCounts(portfolioIds: string[]) {
    if (portfolioIds.length === 0) {
      return;
    }

    // syncPortfolioAlertCounts helper:
    // Open a transaction boundary so unread-count recalculation stays consistent for every touched portfolio.
    await this.databaseService.$transaction(async (tx) => {
      await this.syncPortfolioAlertCountsTx(tx, portfolioIds);
    });
  }

  private async syncPortfolioAlertCountsTx(
    tx: Prisma.TransactionClient,
    portfolioIds: string[],
  ) {
    // syncPortfolioAlertCountsTx helper:
    // Recalculate unread in-app alert counts per portfolio and persist the cached totals back onto the portfolio rows.
    const uniquePortfolioIds = [...new Set(portfolioIds)];

    for (const portfolioId of uniquePortfolioIds) {
      const unreadCount = await tx.alert.count({
        where: {
          portfolioId,
          channel: 'in_app',
          status: 'unread',
        },
      });

      await tx.portfolio.update({
        where: { id: portfolioId },
        data: {
          alertCount: new Prisma.Decimal(unreadCount.toString()),
        },
      });
    }
  }

  private toAlertResponse(
    alert: Alert & {
      portfolio?: { id: string; name: string } | null;
      driftEvent?: {
        id: string;
        detectedAt: Date;
        eventStatus: string;
        assetWeight?: Prisma.Decimal;
        equalWeight?: Prisma.Decimal;
        driftThreshold?: Prisma.Decimal;
      } | null;
    },
  ) {
    // toAlertResponse helper:
    // Normalize Prisma decimals and optional relations into the alert response shape exposed by the API.
    return {
      id: alert.id,
      userId: alert.userId,
      portfolioId: alert.portfolioId,
      driftEventId: alert.driftEventId,
      type: alert.type,
      channel: alert.channel,
      status: alert.status,
      title: alert.title,
      message: alert.message,
      sentAt: alert.sentAt,
      readAt: alert.readAt,
      archivedAt: alert.archivedAt,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
      portfolio: alert.portfolio ?? null,
      driftEvent: alert.driftEvent
        ? {
            id: alert.driftEvent.id,
            detectedAt: alert.driftEvent.detectedAt,
            eventStatus: alert.driftEvent.eventStatus,
            assetWeight:
              alert.driftEvent.assetWeight?.toNumber?.() ?? undefined,
            equalWeight:
              alert.driftEvent.equalWeight?.toNumber?.() ?? undefined,
            driftThreshold:
              alert.driftEvent.driftThreshold?.toNumber?.() ?? undefined,
          }
        : null,
    };
  }
}
