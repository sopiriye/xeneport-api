/*
  Warnings:

  - Made the column `description` on table `portfolios` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('email_verification');

-- AlterTable
ALTER TABLE "portfolios" ADD COLUMN     "alert_count" DECIMAL(10,0) NOT NULL DEFAULT 0,
ALTER COLUMN "description" SET NOT NULL,
ALTER COLUMN "description" SET DEFAULT 'NIL';

-- CreateTable
CREATE TABLE "verification_otps" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "purpose" "OtpPurpose" NOT NULL DEFAULT 'email_verification',
    "code_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "consumed_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "verification_otps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_otps_user_id_purpose_expires_at_idx" ON "verification_otps"("user_id", "purpose", "expires_at");

-- CreateIndex
CREATE INDEX "verification_otps_email_purpose_expires_at_idx" ON "verification_otps"("email", "purpose", "expires_at");

-- AddForeignKey
ALTER TABLE "verification_otps" ADD CONSTRAINT "verification_otps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
