import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; schemaReady?: Promise<void> };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

prisma.$use(async (params, next) => {
  if (params.model) {
    await ensureDatabaseSchema();
  }
  return next(params);
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

async function ensureDatabaseSchema() {
  globalForPrisma.schemaReady ??= createDatabaseSchema();
  return globalForPrisma.schemaReady;
}

async function createDatabaseSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'STAFF',
      "department" TEXT NOT NULL,
      "hireDate" TIMESTAMP NOT NULL,
      "weeklyWorkDays" INTEGER NOT NULL,
      "weeklyWorkHours" DOUBLE PRECISION NOT NULL,
      "employmentStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
      "jobTitle" TEXT NOT NULL DEFAULT 'その他',
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "WorkSetting" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "effectiveFrom" TIMESTAMP NOT NULL,
      "weeklyWorkDays" INTEGER NOT NULL,
      "weeklyWorkHours" DOUBLE PRECISION NOT NULL,
      "department" TEXT NOT NULL,
      "jobTitle" TEXT NOT NULL DEFAULT 'その他',
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "workDate" TIMESTAMP NOT NULL,
      "clockInAt" TIMESTAMP,
      "clockOutAt" TIMESTAMP,
      "totalBreakMins" INTEGER NOT NULL DEFAULT 0,
      "workMins" INTEGER NOT NULL DEFAULT 0,
      "overtimeMins" INTEGER NOT NULL DEFAULT 0,
      "nightMins" INTEGER NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "onCall" BOOLEAN NOT NULL DEFAULT false,
      "emergencyVisits" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_userId_workDate_key" ON "AttendanceRecord" ("userId", "workDate")`,
    `CREATE TABLE IF NOT EXISTS "BreakRecord" (
      "id" TEXT PRIMARY KEY,
      "attendanceRecordId" TEXT NOT NULL,
      "breakStartAt" TIMESTAMP NOT NULL,
      "breakEndAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "CorrectionRequest" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "targetDate" TIMESTAMP NOT NULL,
      "requestedClockInAt" TIMESTAMP,
      "requestedClockOutAt" TIMESTAMP,
      "reason" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "approverId" TEXT,
      "reviewedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "CorrectionLog" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "targetDate" TIMESTAMP NOT NULL,
      "actorId" TEXT NOT NULL,
      "actorRole" TEXT NOT NULL,
      "beforeClockInAt" TIMESTAMP,
      "beforeClockOutAt" TIMESTAMP,
      "afterClockInAt" TIMESTAMP,
      "afterClockOutAt" TIMESTAMP,
      "reason" TEXT NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "PaidLeaveGrant" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "grantDate" TIMESTAMP NOT NULL,
      "expiresAt" TIMESTAMP NOT NULL,
      "grantedMinutes" INTEGER NOT NULL,
      "remainingMinutes" INTEGER NOT NULL,
      "source" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
      "note" TEXT,
      "leaveType" TEXT NOT NULL DEFAULT 'PAID_LEAVE',
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "PaidLeaveRequest" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "leaveType" TEXT NOT NULL,
      "unit" TEXT NOT NULL,
      "halfDayPeriod" TEXT,
      "startAt" TIMESTAMP NOT NULL,
      "endAt" TIMESTAMP NOT NULL,
      "requestedMinutes" INTEGER NOT NULL,
      "reason" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "approverId" TEXT,
      "reviewedAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "PaidLeaveUsage" (
      "id" TEXT PRIMARY KEY,
      "requestId" TEXT NOT NULL,
      "grantId" TEXT NOT NULL,
      "usedMinutes" INTEGER NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}
