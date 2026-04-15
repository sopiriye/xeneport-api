import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DatabaseService.name);
  constructor() {
    // DatabaseService lifecycle:
    // Validate the runtime database configuration before constructing the Prisma client adapter.
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set');
    }

    super({
      adapter: new PrismaPg(databaseUrl),
    });
  }

  async onModuleInit(): Promise<void> {
    // DatabaseService lifecycle:
    // Establish the Prisma database connection when the Nest module boots.
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    // DatabaseService lifecycle:
    // Close the Prisma database connection gracefully during Nest application shutdown.
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }
}
