import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DatabaseService } from '../database/database.service';
import { SearchSecuritiesQueryDto } from './dto/search-securities-query.dto';

@Injectable()
export class SecuritiesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async search(query: SearchSecuritiesQueryDto) {
    const limit = query.limit ?? 10;
    const searchTerm = query.q?.trim();
    const where: Prisma.SecurityWhereInput = searchTerm
      ? {
          OR: [
            {
              ticker: {
                contains: searchTerm.toUpperCase(),
              },
            },
            {
              companyName: {
                contains: searchTerm,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {};

    const securities = await this.databaseService.security.findMany({
      where,
      orderBy: [{ ticker: 'asc' }],
      take: limit,
      include: {
        exchange: true,
      },
    });

    return {
      data: securities.map((security) => this.toSecurityResponse(security)),
      meta: {
        query: searchTerm ?? null,
        limit,
        count: securities.length,
      },
    };
  }

  async findByTicker(ticker: string) {
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
      throw new NotFoundException('Security was not found');
    }

    return this.toSecurityResponse(security);
  }

  private toSecurityResponse(security: {
    id: string;
    ticker: string;
    companyName: string;
    securityType: string;
    createdAt: Date;
    updatedAt: Date;
    exchange: {
      id: string;
      tickerPrefix: string;
      name: string;
      currencyCode: string;
      country: string;
      timezone: string;
    };
  }) {
    return {
      id: security.id,
      ticker: security.ticker,
      companyName: security.companyName,
      securityType: security.securityType,
      createdAt: security.createdAt,
      updatedAt: security.updatedAt,
      exchange: {
        id: security.exchange.id,
        tickerPrefix: security.exchange.tickerPrefix,
        name: security.exchange.name,
        currencyCode:
          security.exchange.currencyCode === 'NIL'
            ? null
            : security.exchange.currencyCode,
        country:
          security.exchange.country === 'NIL' ? null : security.exchange.country,
        timezone:
          security.exchange.timezone === 'NIL'
            ? null
            : security.exchange.timezone,
      },
    };
  }
}
