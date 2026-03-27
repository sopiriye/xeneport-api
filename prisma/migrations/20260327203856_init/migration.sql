-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "PortfolioStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "SecurityType" AS ENUM ('stock');

-- CreateEnum
CREATE TYPE "DriftEventStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- CreateEnum
CREATE TYPE "EmailSentStatus" AS ENUM ('success', 'pending', 'failed');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('in_app', 'email');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('drift_detected');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('unread', 'read', 'archived', 'sent', 'failed');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'revoked', 'expired');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'active',
    "email_verified_at" TIMESTAMP(6),
    "last_login_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(6) NOT NULL,
    "last_used_at" TIMESTAMP(6),
    "revoked_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchanges" (
    "id" UUID NOT NULL,
    "ticker_prefix" VARCHAR(20) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "country" VARCHAR(100) NOT NULL DEFAULT 'NIL',
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'NIL',
    "currency_code" VARCHAR(10) NOT NULL DEFAULT 'NIL',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "securities" (
    "id" UUID NOT NULL,
    "exchange_id" UUID NOT NULL,
    "security_type" "SecurityType" NOT NULL DEFAULT 'stock',
    "ticker" VARCHAR(30) NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "securities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "status" "PortfolioStatus" NOT NULL DEFAULT 'active',
    "drift_multiplier" DECIMAL(3,1) NOT NULL DEFAULT 1.5,
    "current_asset_count" INTEGER NOT NULL DEFAULT 0,
    "current_total_market_value" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "current_equal_weight" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "current_drift_threshold" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "last_recalculated_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "security_id" UUID NOT NULL,
    "total_shares" DECIMAL(10,0) NOT NULL DEFAULT 0,
    "current_market_price" DECIMAL(7,2) NOT NULL DEFAULT 0,
    "current_market_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "current_weight" DECIMAL(4,1) NOT NULL DEFAULT 0,
    "last_transaction_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "holdings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holding_transactions" (
    "id" UUID NOT NULL,
    "holding_id" UUID NOT NULL,
    "security_id" UUID NOT NULL,
    "transaction_date" TIMESTAMP(6) NOT NULL,
    "shares" DECIMAL(20,8) NOT NULL,
    "price_per_share" DECIMAL(20,8) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "holding_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prices" (
    "id" UUID NOT NULL,
    "security_id" UUID NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "timestamp" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_allocation_snapshots" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "snapshot_time" TIMESTAMP(6) NOT NULL,
    "total_market_value" DECIMAL(20,4) NOT NULL,
    "asset_count" INTEGER NOT NULL,
    "equal_weight" DECIMAL(4,1) NOT NULL,
    "drift_multiplier" DECIMAL(3,1) NOT NULL,
    "drift_threshold" DECIMAL(4,1) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_allocation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holdings_allocation_snapshot" (
    "id" UUID NOT NULL,
    "allocation_snapshot_id" UUID NOT NULL,
    "holding_id" UUID NOT NULL,
    "security_id" UUID NOT NULL,
    "shares" DECIMAL(20,8) NOT NULL,
    "market_price" DECIMAL(20,8) NOT NULL,
    "market_value" DECIMAL(20,8) NOT NULL,
    "weight" DECIMAL(4,1) NOT NULL,
    "exceeded_threshold" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holdings_allocation_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drift_events" (
    "id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "holding_id" UUID NOT NULL,
    "security_id" UUID NOT NULL,
    "detected_at" TIMESTAMP(6) NOT NULL,
    "asset_weight" DECIMAL(4,1) NOT NULL,
    "equal_weight" DECIMAL(4,1) NOT NULL,
    "drift_threshold" DECIMAL(4,1) NOT NULL,
    "event_status" "DriftEventStatus" NOT NULL DEFAULT 'open',
    "email_status" "EmailSentStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "drift_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "portfolio_id" UUID NOT NULL,
    "drift_event_id" UUID,
    "type" "AlertType" NOT NULL DEFAULT 'drift_detected',
    "channel" "AlertChannel" NOT NULL,
    "status" "AlertStatus" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(6),
    "read_at" TIMESTAMP(6),
    "archived_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "exchanges_ticker_prefix_key" ON "exchanges"("ticker_prefix");

-- CreateIndex
CREATE UNIQUE INDEX "securities_exchange_id_ticker_key" ON "securities"("exchange_id", "ticker");

-- CreateIndex
CREATE INDEX "portfolios_user_id_idx" ON "portfolios"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolios_user_id_name_key" ON "portfolios"("user_id", "name");

-- CreateIndex
CREATE INDEX "holdings_portfolio_id_idx" ON "holdings"("portfolio_id");

-- CreateIndex
CREATE INDEX "holdings_security_id_idx" ON "holdings"("security_id");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_portfolio_id_security_id_key" ON "holdings"("portfolio_id", "security_id");

-- CreateIndex
CREATE INDEX "holding_transactions_holding_id_idx" ON "holding_transactions"("holding_id");

-- CreateIndex
CREATE INDEX "holding_transactions_security_id_transaction_date_idx" ON "holding_transactions"("security_id", "transaction_date");

-- CreateIndex
CREATE INDEX "prices_timestamp_idx" ON "prices"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "prices_security_id_timestamp_key" ON "prices"("security_id", "timestamp");

-- CreateIndex
CREATE INDEX "portfolio_allocation_snapshots_portfolio_id_idx" ON "portfolio_allocation_snapshots"("portfolio_id");

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_allocation_snapshots_portfolio_id_snapshot_time_key" ON "portfolio_allocation_snapshots"("portfolio_id", "snapshot_time");

-- CreateIndex
CREATE INDEX "holdings_allocation_snapshot_allocation_snapshot_id_idx" ON "holdings_allocation_snapshot"("allocation_snapshot_id");

-- CreateIndex
CREATE INDEX "holdings_allocation_snapshot_security_id_idx" ON "holdings_allocation_snapshot"("security_id");

-- CreateIndex
CREATE UNIQUE INDEX "holdings_allocation_snapshot_allocation_snapshot_id_holding_key" ON "holdings_allocation_snapshot"("allocation_snapshot_id", "holding_id");

-- CreateIndex
CREATE INDEX "drift_events_portfolio_id_detected_at_idx" ON "drift_events"("portfolio_id", "detected_at");

-- CreateIndex
CREATE INDEX "drift_events_holding_id_detected_at_idx" ON "drift_events"("holding_id", "detected_at");

-- CreateIndex
CREATE INDEX "drift_events_security_id_detected_at_idx" ON "drift_events"("security_id", "detected_at");

-- CreateIndex
CREATE INDEX "drift_events_event_status_idx" ON "drift_events"("event_status");

-- CreateIndex
CREATE INDEX "alerts_user_id_status_idx" ON "alerts"("user_id", "status");

-- CreateIndex
CREATE INDEX "alerts_portfolio_id_idx" ON "alerts"("portfolio_id");

-- CreateIndex
CREATE INDEX "alerts_drift_event_id_idx" ON "alerts"("drift_event_id");

-- CreateIndex
CREATE INDEX "alerts_type_channel_idx" ON "alerts"("type", "channel");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "securities" ADD CONSTRAINT "securities_exchange_id_fkey" FOREIGN KEY ("exchange_id") REFERENCES "exchanges"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_transactions" ADD CONSTRAINT "holding_transactions_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holding_transactions" ADD CONSTRAINT "holding_transactions_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_allocation_snapshots" ADD CONSTRAINT "portfolio_allocation_snapshots_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings_allocation_snapshot" ADD CONSTRAINT "holdings_allocation_snapshot_allocation_snapshot_id_fkey" FOREIGN KEY ("allocation_snapshot_id") REFERENCES "portfolio_allocation_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings_allocation_snapshot" ADD CONSTRAINT "holdings_allocation_snapshot_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holdings_allocation_snapshot" ADD CONSTRAINT "holdings_allocation_snapshot_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drift_events" ADD CONSTRAINT "drift_events_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drift_events" ADD CONSTRAINT "drift_events_holding_id_fkey" FOREIGN KEY ("holding_id") REFERENCES "holdings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drift_events" ADD CONSTRAINT "drift_events_security_id_fkey" FOREIGN KEY ("security_id") REFERENCES "securities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_portfolio_id_fkey" FOREIGN KEY ("portfolio_id") REFERENCES "portfolios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_drift_event_id_fkey" FOREIGN KEY ("drift_event_id") REFERENCES "drift_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
