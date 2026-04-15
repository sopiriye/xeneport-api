import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import { AlertsService } from './alerts.service';
import { ListAlertsQueryDto } from './dto/list-alerts-query.dto';

@ApiTags('Alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOperation({
    summary: 'List alerts',
    description:
      'Returns paginated alerts for the authenticated investor with optional status, channel, and portfolio filtering.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'status', required: false, example: 'unread' })
  @ApiQuery({ name: 'channel', required: false, example: 'in_app' })
  @ApiQuery({
    name: 'portfolioId',
    required: false,
    example: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
  })
  @ApiOkResponse({
    description: 'Alerts returned successfully.',
    schema: {
      example: {
        data: [
          {
            id: 'ad5eb479-1986-4608-9507-a702f91ab0c8',
            userId: '29d5c25d-42e8-49e7-b590-a954d7cf86f5',
            portfolioId: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
            driftEventId: '15f4f54a-af4d-4e4a-b716-25571de11df1',
            type: 'drift_detected',
            channel: 'in_app',
            status: 'unread',
            title: 'Drift detected for ZENITHBANK',
            message:
              'ZENITHBANK (Zenith Bank Plc) weight is 76.2%, above the drift threshold of 75.0%.',
            sentAt: null,
            readAt: null,
            archivedAt: null,
            createdAt: '2026-04-14T09:00:00.000Z',
            updatedAt: '2026-04-14T09:00:00.000Z',
            portfolio: {
              id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
              name: 'Long-Term Core Portfolio',
            },
            driftEvent: {
              id: '15f4f54a-af4d-4e4a-b716-25571de11df1',
              detectedAt: '2026-04-14T09:00:00.000Z',
              eventStatus: 'open',
              assetWeight: 76.2,
              equalWeight: 50,
              driftThreshold: 75,
            },
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
          unreadCount: 1,
          appliedFilters: {
            status: 'unread',
            channel: 'in_app',
            portfolioId: null,
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  listAlerts(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Query() query: ListAlertsQueryDto,
  ) {
    return this.alertsService.listAlerts(currentUser, query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get alert by id',
    description:
      'Returns a single alert for the authenticated investor, including linked portfolio and drift-event context.',
  })
  @ApiParam({
    name: 'id',
    description: 'Alert UUID.',
    example: 'ad5eb479-1986-4608-9507-a702f91ab0c8',
  })
  @ApiOkResponse({
    description: 'Alert returned successfully.',
    schema: {
      example: {
        id: 'ad5eb479-1986-4608-9507-a702f91ab0c8',
        userId: '29d5c25d-42e8-49e7-b590-a954d7cf86f5',
        portfolioId: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
        driftEventId: '15f4f54a-af4d-4e4a-b716-25571de11df1',
        type: 'drift_detected',
        channel: 'in_app',
        status: 'unread',
        title: 'Drift detected for ZENITHBANK',
        message:
          'ZENITHBANK (Zenith Bank Plc) weight is 76.2%, above the drift threshold of 75.0%.',
        sentAt: null,
        readAt: null,
        archivedAt: null,
        createdAt: '2026-04-14T09:00:00.000Z',
        updatedAt: '2026-04-14T09:00:00.000Z',
        portfolio: {
          id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          name: 'Long-Term Core Portfolio',
        },
        driftEvent: {
          id: '15f4f54a-af4d-4e4a-b716-25571de11df1',
          detectedAt: '2026-04-14T09:00:00.000Z',
          eventStatus: 'open',
          assetWeight: 76.2,
          equalWeight: 50,
          driftThreshold: 75,
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Alert was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  getAlertById(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) alertId: string,
  ) {
    return this.alertsService.getAlertById(currentUser, alertId);
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark alert as read',
    description:
      'Marks an in-app alert as read and refreshes the unread alert count stored on the portfolio.',
  })
  @ApiParam({
    name: 'id',
    description: 'Alert UUID.',
    example: 'ad5eb479-1986-4608-9507-a702f91ab0c8',
  })
  @ApiOkResponse({
    description: 'Alert marked as read successfully.',
    schema: {
      example: {
        message: 'Alert marked as read successfully',
        alert: {
          id: 'ad5eb479-1986-4608-9507-a702f91ab0c8',
          userId: '29d5c25d-42e8-49e7-b590-a954d7cf86f5',
          portfolioId: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
          driftEventId: '15f4f54a-af4d-4e4a-b716-25571de11df1',
          type: 'drift_detected',
          channel: 'in_app',
          status: 'read',
          title: 'Drift detected for ZENITHBANK',
          message:
            'ZENITHBANK (Zenith Bank Plc) weight is 76.2%, above the drift threshold of 75.0%.',
          sentAt: null,
          readAt: '2026-04-14T10:00:00.000Z',
          archivedAt: null,
          createdAt: '2026-04-14T09:00:00.000Z',
          updatedAt: '2026-04-14T10:00:00.000Z',
          portfolio: {
            id: '6f836d71-00f4-4ad5-a60b-c9591f4f41de',
            name: 'Long-Term Core Portfolio',
          },
          driftEvent: {
            id: '15f4f54a-af4d-4e4a-b716-25571de11df1',
            detectedAt: '2026-04-14T09:00:00.000Z',
            eventStatus: 'open',
            assetWeight: 76.2,
            equalWeight: 50,
            driftThreshold: 75,
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Alert was not found.' })
  @ApiUnauthorizedResponse({
    description: 'Bearer token is missing or invalid.',
  })
  markAsRead(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) alertId: string,
  ) {
    return this.alertsService.markAsRead(currentUser, alertId);
  }
}
