-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('online', 'offline');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdgeNode" (
    "id" TEXT NOT NULL,
    "deviceKey" TEXT,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "NodeStatus" NOT NULL DEFAULT 'offline',
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdgeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorReading" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "voltage" DOUBLE PRECISION NOT NULL,
    "current" DOUBLE PRECISION NOT NULL,
    "power" DOUBLE PRECISION NOT NULL,
    "energyToday" DOUBLE PRECISION,
    "inverterPower" DOUBLE PRECISION,
    "curtailment" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyForecastPrediction" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "forecastDate" TIMESTAMP(3) NOT NULL,
    "estimatedEnergyKwh" DOUBLE PRECISION NOT NULL,
    "peakPowerKw" DOUBLE PRECISION NOT NULL,
    "sourceConfidence" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyForecastPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EdgeNode_deviceKey_key" ON "EdgeNode"("deviceKey");

-- CreateIndex
CREATE INDEX "EdgeNode_status_idx" ON "EdgeNode"("status");

-- CreateIndex
CREATE INDEX "EdgeNode_lastSeen_idx" ON "EdgeNode"("lastSeen");

-- CreateIndex
CREATE INDEX "SensorReading_nodeId_timestamp_idx" ON "SensorReading"("nodeId", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "SensorReading_timestamp_idx" ON "SensorReading"("timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "DailyForecastPrediction_forecastDate_idx" ON "DailyForecastPrediction"("forecastDate");

-- CreateIndex
CREATE UNIQUE INDEX "DailyForecastPrediction_nodeId_forecastDate_key" ON "DailyForecastPrediction"("nodeId", "forecastDate");

-- AddForeignKey
ALTER TABLE "SensorReading" ADD CONSTRAINT "SensorReading_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyForecastPrediction" ADD CONSTRAINT "DailyForecastPrediction_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
