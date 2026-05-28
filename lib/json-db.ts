import { randomBytes, pbkdf2Sync } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { addDays, addYears, parseJstDate, toJstDateKey } from "@/lib/time";

export type User = {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  role: "STAFF" | "ADMIN";
  department: string;
  hireDate: string;
  weeklyWorkDays: number;
  weeklyWorkHours: number;
  employmentStatus: "ACTIVE" | "INACTIVE";
  retirementDate?: string | null;
  jobTitle?: string;
  workSettings?: WorkSetting[];
};

export type WorkSetting = {
  id: string;
  effectiveFrom: string;
  weeklyWorkDays: number;
  weeklyWorkHours: number;
  standardStartTime: string;
  standardEndTime: string;
  department: string;
  jobTitle?: string;
};

export type AttendanceRecord = {
  id: string;
  userId: string;
  workDate: string;
  clockInAt: string | null;
  clockOutAt: string | null;
  totalBreakMins: number;
  workMins: number;
  overtimeMins: number;
  nightMins: number;
  status: string;
  onCall: boolean;
  emergencyVisits: number;
};

export type CorrectionLog = {
  id: string;
  userId: string;
  targetDate: string;
  actorId: string;
  actorRole: "STAFF" | "ADMIN";
  beforeClockInAt: string | null;
  beforeClockOutAt: string | null;
  afterClockInAt: string | null;
  afterClockOutAt: string | null;
  reason: string;
  createdAt: string;
};

export type PaidLeaveGrant = {
  id: string;
  userId: string;
  grantDate: string;
  expiresAt: string;
  grantedMinutes: number;
  remainingMinutes: number;
  source: string;
  status: string;
  note?: string | null;
  leaveType?: string;
};

export type PaidLeaveRequest = {
  id: string;
  userId: string;
  leaveType: string;
  unit: string;
  halfDayPeriod?: "AM" | "PM" | null;
  startAt: string;
  endAt: string;
  requestedMinutes: number;
  reason: string;
  status: string;
  approverId?: string | null;
  reviewedAt?: string | null;
};

export type CorrectionRequest = {
  id: string;
  userId: string;
  targetDate: string;
  requestedClockInAt: string | null;
  requestedClockOutAt: string | null;
  reason: string;
  status: string;
  approverId?: string | null;
  reviewedAt?: string | null;
};

export type AuditLog = {
  id: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  detailsJson: string;
  createdAt: string;
};

export type WorkingWeekdaySetting = {
  effectiveFrom: string;
  weekdays: number[];
};

export type StaffProfileSetting = {
  employmentType: string;
  workingWeekdays: number[];
};

type DbSnapshot = {
  users: User[];
  attendanceRecords: AttendanceRecord[];
  breakRecords: [];
  paidLeaveGrants: PaidLeaveGrant[];
  paidLeaveRequests: PaidLeaveRequest[];
  correctionRequests: CorrectionRequest[];
  correctionLogs: CorrectionLog[];
};

let schemaReady: Promise<void> | null = null;
let dailyLeaveMaintenanceKey: string | null = null;
let initialDataReady: Promise<void> | null = null;

async function ensureDatabaseSchema() {
  schemaReady ??= createDatabaseSchema();
  return schemaReady;
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
      "retirementDate" TIMESTAMP,
      "jobTitle" TEXT NOT NULL DEFAULT 'その他',
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "retirementDate" TIMESTAMP`,
    `CREATE TABLE IF NOT EXISTS "WorkSetting" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "effectiveFrom" TIMESTAMP NOT NULL,
      "weeklyWorkDays" INTEGER NOT NULL,
      "weeklyWorkHours" DOUBLE PRECISION NOT NULL,
      "standardStartTime" TEXT NOT NULL DEFAULT '09:00',
      "standardEndTime" TEXT NOT NULL DEFAULT '18:00',
      "department" TEXT NOT NULL,
      "jobTitle" TEXT NOT NULL DEFAULT 'その他',
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "WorkSetting" ADD COLUMN IF NOT EXISTS "standardStartTime" TEXT NOT NULL DEFAULT '09:00'`,
    `ALTER TABLE "WorkSetting" ADD COLUMN IF NOT EXISTS "standardEndTime" TEXT NOT NULL DEFAULT '18:00'`,
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
      "note" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "note" TEXT`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_userId_workDate_key" ON "AttendanceRecord" ("userId", "workDate")`,
    `CREATE TABLE IF NOT EXISTS "BreakRecord" (
      "id" TEXT PRIMARY KEY,
      "attendanceRecordId" TEXT NOT NULL,
      "startAt" TIMESTAMP,
      "endAt" TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "BreakRecord" ADD COLUMN IF NOT EXISTS "startAt" TIMESTAMP`,
    `ALTER TABLE "BreakRecord" ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP`,
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'BreakRecord' AND column_name = 'breakStartAt') THEN ALTER TABLE "BreakRecord" ALTER COLUMN "breakStartAt" DROP NOT NULL; END IF; END $$`,
    `CREATE TABLE IF NOT EXISTS "CorrectionRequest" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "attendanceRecordId" TEXT,
      "targetDate" TIMESTAMP NOT NULL,
      "requestedClockInAt" TIMESTAMP,
      "requestedClockOutAt" TIMESTAMP,
      "reason" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "approverId" TEXT,
      "reviewedAt" TIMESTAMP,
      "reviewerNote" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "CorrectionRequest" ADD COLUMN IF NOT EXISTS "attendanceRecordId" TEXT`,
    `ALTER TABLE "CorrectionRequest" ADD COLUMN IF NOT EXISTS "reviewerNote" TEXT`,
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
      "reviewerNote" TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "PaidLeaveRequest" ADD COLUMN IF NOT EXISTS "reviewerNote" TEXT`,
    `CREATE TABLE IF NOT EXISTS "PaidLeaveUsage" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT,
      "paidLeaveGrantId" TEXT,
      "paidLeaveRequestId" TEXT,
      "requestId" TEXT,
      "grantId" TEXT,
      "usedMinutes" INTEGER NOT NULL,
      "usedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "PaidLeaveUsage" ADD COLUMN IF NOT EXISTS "userId" TEXT`,
    `ALTER TABLE "PaidLeaveUsage" ADD COLUMN IF NOT EXISTS "paidLeaveGrantId" TEXT`,
    `ALTER TABLE "PaidLeaveUsage" ADD COLUMN IF NOT EXISTS "paidLeaveRequestId" TEXT`,
    `ALTER TABLE "PaidLeaveUsage" ADD COLUMN IF NOT EXISTS "usedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP`,
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PaidLeaveUsage' AND column_name = 'requestId') THEN ALTER TABLE "PaidLeaveUsage" ALTER COLUMN "requestId" DROP NOT NULL; END IF; END $$`,
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'PaidLeaveUsage' AND column_name = 'grantId') THEN ALTER TABLE "PaidLeaveUsage" ALTER COLUMN "grantId" DROP NOT NULL; END IF; END $$`,
    `CREATE TABLE IF NOT EXISTS "AuditLog" (
      "id" TEXT PRIMARY KEY,
      "actorId" TEXT,
      "action" TEXT NOT NULL,
      "entityType" TEXT NOT NULL DEFAULT '',
      "entityId" TEXT,
      "detailsJson" TEXT NOT NULL DEFAULT '{}',
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "actorId" TEXT`,
    `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "entityId" TEXT`,
    `ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "detailsJson" TEXT NOT NULL DEFAULT '{}'`,
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLog' AND column_name = 'userId') THEN ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL; END IF; END $$`,
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLog' AND column_name = 'targetType') THEN ALTER TABLE "AuditLog" ALTER COLUMN "targetType" DROP NOT NULL; END IF; END $$`,
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLog' AND column_name = 'targetId') THEN ALTER TABLE "AuditLog" ALTER COLUMN "targetId" DROP NOT NULL; END IF; END $$`,
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'AuditLog' AND column_name = 'payload') THEN ALTER TABLE "AuditLog" ALTER COLUMN "payload" DROP NOT NULL; END IF; END $$`
  ];

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");
  return `pbkdf2$${salt}$${hash}`;
}

function iso(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function dateKey(value: Date) {
  return toJstDateKey(value);
}

function serializeUser(user: any): User {
  return {
    ...user,
    role: user.role as "STAFF" | "ADMIN",
    employmentStatus: user.employmentStatus as "ACTIVE" | "INACTIVE",
    hireDate: dateKey(user.hireDate),
    retirementDate: user.retirementDate ? dateKey(user.retirementDate) : null,
    workSettings: user.workSettings?.map(serializeWorkSetting)
  };
}

function serializeWorkSetting(setting: any): WorkSetting {
  return {
    id: setting.id,
    effectiveFrom: dateKey(setting.effectiveFrom),
    weeklyWorkDays: setting.weeklyWorkDays,
    weeklyWorkHours: setting.weeklyWorkHours,
    standardStartTime: setting.standardStartTime ?? "09:00",
    standardEndTime: setting.standardEndTime ?? "18:00",
    department: setting.department,
    jobTitle: setting.jobTitle
  };
}

function serializeRecord(record: any): AttendanceRecord {
  return {
    id: record.id,
    userId: record.userId,
    workDate: dateKey(record.workDate),
    clockInAt: iso(record.clockInAt),
    clockOutAt: iso(record.clockOutAt),
    totalBreakMins: record.totalBreakMins,
    workMins: record.workMins,
    overtimeMins: record.overtimeMins,
    nightMins: record.nightMins,
    status: record.status,
    onCall: record.onCall ?? false,
    emergencyVisits: record.emergencyVisits ?? 0
  };
}

function emptyAttendanceRecord(userId: string, workDate: string): AttendanceRecord {
  return {
    id: "",
    userId,
    workDate,
    clockInAt: null,
    clockOutAt: null,
    totalBreakMins: 0,
    workMins: 0,
    overtimeMins: 0,
    nightMins: 0,
    status: "PENDING",
    onCall: false,
    emergencyVisits: 0
  };
}

function serializeGrant(grant: any): PaidLeaveGrant {
  return {
    id: grant.id,
    userId: grant.userId,
    grantDate: dateKey(grant.grantDate),
    expiresAt: dateKey(grant.expiresAt),
    grantedMinutes: grant.grantedMinutes,
    remainingMinutes: grant.remainingMinutes,
    source: grant.source,
    status: grant.status,
    note: grant.note,
    leaveType: grant.leaveType ?? "PAID_LEAVE"
  };
}

function serializeLeaveRequest(request: any): PaidLeaveRequest {
  return {
    id: request.id,
    userId: request.userId,
    leaveType: request.leaveType,
    unit: request.unit,
    halfDayPeriod: request.halfDayPeriod,
    startAt: iso(request.startAt) ?? "",
    endAt: iso(request.endAt) ?? "",
    requestedMinutes: request.requestedMinutes,
    reason: request.reason,
    status: request.status,
    approverId: request.approverId,
    reviewedAt: iso(request.reviewedAt)
  };
}

function serializeCorrectionRequest(request: any): CorrectionRequest {
  return {
    id: request.id,
    userId: request.userId,
    targetDate: dateKey(request.targetDate),
    requestedClockInAt: iso(request.requestedClockInAt),
    requestedClockOutAt: iso(request.requestedClockOutAt),
    reason: request.reason,
    status: request.status,
    approverId: request.approverId,
    reviewedAt: iso(request.reviewedAt)
  };
}

function serializeCorrectionLog(log: any): CorrectionLog {
  return {
    id: log.id,
    userId: log.userId,
    targetDate: dateKey(log.targetDate),
    actorId: log.actorId,
    actorRole: log.actorRole,
    beforeClockInAt: iso(log.beforeClockInAt),
    beforeClockOutAt: iso(log.beforeClockOutAt),
    afterClockInAt: iso(log.afterClockInAt),
    afterClockOutAt: iso(log.afterClockOutAt),
    reason: log.reason,
    createdAt: iso(log.createdAt) ?? ""
  };
}

function serializeAuditLog(log: any): AuditLog {
  return {
    id: log.id,
    actorId: log.actorId,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    detailsJson: log.detailsJson ?? "{}",
    createdAt: iso(log.createdAt) ?? ""
  };
}

function parseAuditDetails(detailsJson?: string | null) {
  try {
    return JSON.parse(detailsJson || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function normalizeWorkingWeekdays(values: unknown[]) {
  const weekdays = values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
  return [...new Set(weekdays)].sort((a, b) => a - b);
}

function defaultWorkingWeekdays(weeklyWorkDays: number) {
  if (weeklyWorkDays >= 5) return [1, 2, 3, 4, 5];
  if (weeklyWorkDays <= 0) return [];
  return [1, 2, 3, 4, 5].slice(0, Math.max(1, Math.min(5, weeklyWorkDays)));
}

export function isScheduledWorkday(user: Pick<User, "id" | "weeklyWorkDays" | "retirementDate">, dateKey: string, settings: Map<string, WorkingWeekdaySetting[]>) {
  if (user.retirementDate && dateKey > user.retirementDate) return false;
  const weekday = new Date(`${dateKey}T00:00:00+09:00`).getDay();
  const candidates = (settings.get(user.id) ?? [])
    .filter((setting) => setting.effectiveFrom <= dateKey)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const weekdays = candidates[0]?.weekdays?.length ? candidates[0].weekdays : defaultWorkingWeekdays(user.weeklyWorkDays);
  return weekdays.includes(weekday);
}

export async function ensureInitialData() {
  initialDataReady ??= ensureInitialDataOnce();
  return initialDataReady;
}

async function ensureInitialDataOnce() {
  await ensureDatabaseSchema();
  const count = await prisma.user.count();
  if (count > 0) return;
  await prisma.user.createMany({
    data: [
      {
        name: "管理者 太郎",
        email: "admin@example.com",
        passwordHash: hashPassword("password123"),
        role: "ADMIN",
        department: "管理部",
        hireDate: parseJstDate("2020-04-01"),
        weeklyWorkDays: 5,
        weeklyWorkHours: 40,
        jobTitle: "その他"
      },
      {
        name: "佐藤 花子",
        email: "hanako@example.com",
        passwordHash: hashPassword("password123"),
        role: "STAFF",
        department: "訪問看護",
        hireDate: parseJstDate("2022-04-01"),
        weeklyWorkDays: 5,
        weeklyWorkHours: 40,
        jobTitle: "看護師"
      }
    ]
  });
}

export async function readDb(): Promise<DbSnapshot> {
  await ensureInitialData();
  await runDailyLeaveMaintenance();
  const [users, attendanceRecords, paidLeaveGrants, paidLeaveRequests, correctionRequests, correctionLogs] = await Promise.all([
    prisma.user.findMany({ include: { workSettings: true } }),
    prisma.attendanceRecord.findMany(),
    prisma.paidLeaveGrant.findMany(),
    prisma.paidLeaveRequest.findMany(),
    prisma.correctionRequest.findMany(),
    prisma.correctionLog.findMany()
  ]);
  return {
    users: users.map(serializeUser),
    attendanceRecords: attendanceRecords.map(serializeRecord),
    breakRecords: [],
    paidLeaveGrants: paidLeaveGrants.map(serializeGrant),
    paidLeaveRequests: paidLeaveRequests.map(serializeLeaveRequest),
    correctionRequests: correctionRequests.map(serializeCorrectionRequest),
    correctionLogs: correctionLogs.map(serializeCorrectionLog)
  };
}

export async function getUserMonthAttendanceRecords(userId: string, month: string) {
  const { start, next } = monthBounds(month);
  const records = await prisma.attendanceRecord.findMany({
    where: { userId, workDate: { gte: start, lt: next } },
    orderBy: { workDate: "asc" }
  });
  return records.map(serializeRecord);
}

export async function getRecentLeaveRequests(userId: string, take = 8) {
  const requests = await prisma.paidLeaveRequest.findMany({
    where: { userId },
    orderBy: { startAt: "desc" },
    take
  });
  return requests.map(serializeLeaveRequest);
}

export async function findUserByEmail(email: string) {
  await ensureInitialData();
  const user = await prisma.user.findUnique({ where: { email }, include: { workSettings: true } });
  return user ? serializeUser(user) : null;
}

export async function findLoginUserByEmail(email: string) {
  const users = await prisma.$queryRaw<Array<{
    id: string;
    role: string;
    passwordHash: string;
    name: string;
    department: string;
  jobTitle: string | null;
  weeklyWorkDays: number;
  weeklyWorkHours: number;
  employmentStatus: string;
  retirementDate: Date | null;
  }>>`
    SELECT "id", "role", "passwordHash", "name", "department", "jobTitle", "weeklyWorkDays", "weeklyWorkHours", "employmentStatus", "retirementDate"
    FROM "User"
    WHERE "email" = ${email}
    LIMIT 1
  `;
  return users[0] ?? null;
}

export async function findUserById(id: string) {
  const user = await prisma.user.findUnique({ where: { id }, include: { workSettings: true } });
  return user ? serializeUser(user) : null;
}

export async function getStaffUsers() {
  await ensureInitialData();
  const users = await prisma.user.findMany({ where: { role: "STAFF", employmentStatus: "ACTIVE" }, include: { workSettings: true } });
  return users.map(serializeUser);
}

export async function updateStaffSettings(input: {
  userId: string;
  effectiveFrom: string;
  weeklyWorkDays: number;
  weeklyWorkHours: number;
  standardStartTime: string;
  standardEndTime: string;
  department: string;
  jobTitle: string;
  employmentStatus?: "ACTIVE" | "INACTIVE";
  retirementDate?: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return null;
  const employmentStatus = input.employmentStatus === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const retirementDate = employmentStatus === "INACTIVE" && input.retirementDate ? parseJstDate(input.retirementDate) : null;
  const setting = await prisma.workSetting.create({
    data: {
      userId: input.userId,
      effectiveFrom: parseJstDate(input.effectiveFrom || toJstDateKey()),
      weeklyWorkDays: Math.max(1, Math.min(7, Math.floor(input.weeklyWorkDays))),
      weeklyWorkHours: Math.max(1, input.weeklyWorkHours),
      standardStartTime: normalizeTimeInput(input.standardStartTime, "09:00"),
      standardEndTime: normalizeTimeInput(input.standardEndTime, "18:00"),
      department: input.department || user.department,
      jobTitle: input.jobTitle || user.jobTitle || "その他"
    }
  });
  if (dateKey(setting.effectiveFrom) <= toJstDateKey()) {
    await prisma.user.update({
      where: { id: input.userId },
      data: {
        weeklyWorkDays: setting.weeklyWorkDays,
        weeklyWorkHours: setting.weeklyWorkHours,
        department: setting.department,
        jobTitle: setting.jobTitle,
        employmentStatus,
        retirementDate
      }
    });
  } else {
    await prisma.user.update({
      where: { id: input.userId },
      data: { employmentStatus, retirementDate }
    });
  }
  return findUserById(input.userId);
}

export async function createAuditLog(input: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
}) {
  return prisma.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      detailsJson: JSON.stringify(input.details ?? {})
    }
  });
}

export async function getRecentAuditLogs(take = 30) {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take
  });
  return logs.map(serializeAuditLog);
}

export async function getWorkingWeekdaySettings(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, WorkingWeekdaySetting[]>();
  const logs = await prisma.auditLog.findMany({
    where: {
      action: "STAFF_SETTINGS_UPDATE",
      entityType: "USER",
      entityId: { in: userIds }
    },
    orderBy: { createdAt: "desc" }
  });
  const settings = new Map<string, WorkingWeekdaySetting[]>();
  for (const log of logs) {
    if (!log.entityId) continue;
    const details = parseAuditDetails(log.detailsJson);
    const weekdays = Array.isArray(details.workingWeekdays) ? normalizeWorkingWeekdays(details.workingWeekdays) : [];
    if (weekdays.length === 0) continue;
    const effectiveFrom = typeof details.effectiveFrom === "string" ? details.effectiveFrom : toJstDateKey(log.createdAt);
    settings.set(log.entityId, [...(settings.get(log.entityId) ?? []), { effectiveFrom, weekdays }]);
  }
  return settings;
}

export async function getStaffProfileSettings(userIds: string[]) {
  if (userIds.length === 0) return new Map<string, StaffProfileSetting>();
  const logs = await prisma.auditLog.findMany({
    where: {
      action: { in: ["STAFF_CREATE", "STAFF_SETTINGS_UPDATE"] },
      entityType: "USER",
      entityId: { in: userIds }
    },
    orderBy: { createdAt: "desc" }
  });
  const settings = new Map<string, StaffProfileSetting>();
  for (const log of logs) {
    if (!log.entityId || settings.has(log.entityId)) continue;
    const details = parseAuditDetails(log.detailsJson);
    const employmentType = typeof details.employmentType === "string" ? details.employmentType : "正社員";
    const workingWeekdays = Array.isArray(details.workingWeekdays) ? normalizeWorkingWeekdays(details.workingWeekdays) : [];
    settings.set(log.entityId, { employmentType, workingWeekdays });
  }
  return settings;
}

export async function findUserPasswordHash(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
  return user?.passwordHash ?? null;
}

export async function updateUserPassword(userId: string, password: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(password) }
  });
}

export async function isMonthClosed(month: string) {
  const closeLog = await prisma.auditLog.findFirst({
    where: { action: "MONTH_CLOSE", entityType: "ATTENDANCE_MONTH", entityId: month },
    orderBy: { createdAt: "desc" }
  });
  return !!closeLog;
}

export async function closeAttendanceMonth(month: string, actorId: string) {
  if (await isMonthClosed(month)) return null;
  return createAuditLog({
    actorId,
    action: "MONTH_CLOSE",
    entityType: "ATTENDANCE_MONTH",
    entityId: month,
    details: { month }
  });
}

export async function createStaff(input: {
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  hireDate: string;
  weeklyWorkDays: number;
  weeklyWorkHours: number;
}) {
  if (await prisma.user.findUnique({ where: { email: input.email } })) {
    throw new Error("同じメールアドレスのスタッフが既にいます。");
  }
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: hashPassword("password123"),
      role: "STAFF",
      department: input.department,
      hireDate: parseJstDate(input.hireDate),
      weeklyWorkDays: Math.max(1, Math.min(7, Math.floor(input.weeklyWorkDays))),
      weeklyWorkHours: Math.max(1, input.weeklyWorkHours),
      employmentStatus: "ACTIVE",
      jobTitle: input.jobTitle || "その他"
    },
    include: { workSettings: true }
  });
  return serializeUser(user);
}

export async function getTodayAttendance(userId: string) {
  return getAttendanceRecord(userId, toJstDateKey());
}

export async function getAttendanceRecord(userId: string, workDate: string) {
  const record = await prisma.attendanceRecord.upsert({
    where: { userId_workDate: { userId, workDate: parseJstDate(workDate) } },
    update: {},
    create: { userId, workDate: parseJstDate(workDate) }
  });
  return serializeRecord(record);
}

export async function findAttendanceRecord(userId: string, workDate: string) {
  const record = await prisma.attendanceRecord.findUnique({
    where: { userId_workDate: { userId, workDate: parseJstDate(workDate) } }
  });
  return record ? serializeRecord(record) : emptyAttendanceRecord(userId, workDate);
}

export async function updateAttendance(userId: string, action: "CLOCK_IN" | "CLOCK_OUT") {
  const today = toJstDateKey();
  const current = await prisma.attendanceRecord.upsert({
    where: { userId_workDate: { userId, workDate: parseJstDate(today) } },
    update: {},
    create: { userId, workDate: parseJstDate(today) }
  });
  const now = await normalizePunchTime(userId, new Date(), action);
  const data: Record<string, Date> = {};
  if (action === "CLOCK_IN" && !current.clockInAt) data.clockInAt = now;
  if (action === "CLOCK_OUT" && current.clockInAt && !current.clockOutAt) data.clockOutAt = now;
  const updated = Object.keys(data).length
    ? await prisma.attendanceRecord.update({ where: { id: current.id }, data })
    : current;
  return serializeRecord(await recalcRecord(updated.id));
}

export async function setTodayStandardWork(userId: string) {
  const standard = await getStandardWorkForDate(userId, toJstDateKey());
  return saveAttendanceCorrection({
    userId,
    actorId: userId,
    actorRole: "STAFF",
    targetDate: toJstDateKey(),
    clockIn: standard.start,
    clockOut: standard.end,
    reason: "通常勤務"
  });
}

async function normalizePunchTime(userId: string, value: Date, action: "CLOCK_IN" | "CLOCK_OUT") {
  const result = new Date(value);
  const jst = new Date(value.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const minutes = jst.getHours() * 60 + jst.getMinutes();
  const standard = await getStandardWorkForDate(userId, toJstDateKey(value));
  const startMinutes = timeToMinutes(standard.start);
  const endMinutes = timeToMinutes(standard.end);
  if (action === "CLOCK_IN" && minutes >= startMinutes - 60 && minutes <= startMinutes) {
    result.setTime(new Date(`${toJstDateKey(value)}T${standard.start}:00+09:00`).getTime());
  }
  if (action === "CLOCK_OUT" && minutes >= endMinutes - 30 && minutes <= endMinutes) {
    result.setTime(new Date(`${toJstDateKey(value)}T${standard.end}:00+09:00`).getTime());
  }
  return result;
}

async function recalcRecord(id: string) {
  const record = await prisma.attendanceRecord.findUnique({ where: { id } });
  if (!record) throw new Error("勤怠が見つかりません。");
  const start = record.clockInAt?.getTime() ?? 0;
  const end = record.clockOutAt?.getTime() ?? 0;
  const spanMins = start && end ? Math.max(0, Math.round((end - start) / 60000)) : 0;
  const totalBreakMins = spanMins >= 6 * 60 ? 60 : 0;
  const workMins = start && end ? Math.max(0, spanMins - totalBreakMins) : 0;
  const overtimeMins = await calculateOvertime(record.userId, record.workDate, record.clockOutAt);
  const status = record.clockInAt && record.clockOutAt ? "NORMAL" : record.clockInAt ? "MISSING_CLOCK" : "PENDING";
  return prisma.attendanceRecord.update({
    where: { id },
    data: { totalBreakMins, workMins, overtimeMins, status }
  });
}

async function calculateOvertime(userId: string, workDate: Date, clockOutAt: Date | null) {
  if (!clockOutAt) return 0;
  const date = dateKey(workDate);
  const standard = await getStandardWorkForDate(userId, date);
  const standardEnd = new Date(`${date}T${standard.end}:00+09:00`).getTime();
  return Math.max(0, Math.round((clockOutAt.getTime() - standardEnd) / 60000));
}

function canStaffEditDate(targetDate: string) {
  return targetDate.slice(0, 7) === toJstDateKey().slice(0, 7);
}

export async function saveAttendanceCorrection(input: {
  userId: string;
  actorId: string;
  actorRole: "STAFF" | "ADMIN";
  targetDate: string;
  clockIn: string;
  clockOut: string;
  reason?: string;
}) {
  if (input.actorRole === "STAFF" && !canStaffEditDate(input.targetDate)) {
    throw new Error("翌月以降はスタッフ側で修正できません。管理者に依頼してください。");
  }
  if (input.actorRole === "STAFF" && await isMonthClosed(input.targetDate.slice(0, 7))) {
    throw new Error("この月は月末締め済みです。管理者に依頼してください。");
  }
  const workDate = parseJstDate(input.targetDate);
  const record = await prisma.attendanceRecord.upsert({
    where: { userId_workDate: { userId: input.userId, workDate } },
    update: {},
    create: { userId: input.userId, workDate }
  });
  const beforeClockInAt = record.clockInAt;
  const beforeClockOutAt = record.clockOutAt;
  const afterClockInAt = input.clockIn ? new Date(`${input.targetDate}T${input.clockIn}:00+09:00`) : null;
  const afterClockOutAt = input.clockOut ? new Date(`${input.targetDate}T${input.clockOut}:00+09:00`) : null;
  await prisma.attendanceRecord.update({
    where: { id: record.id },
    data: { clockInAt: afterClockInAt, clockOutAt: afterClockOutAt }
  });
  const updated = await recalcRecord(record.id);
  await prisma.correctionLog.create({
    data: {
      userId: input.userId,
      targetDate: workDate,
      actorId: input.actorId,
      actorRole: input.actorRole,
      beforeClockInAt,
      beforeClockOutAt,
      afterClockInAt,
      afterClockOutAt,
      reason: input.reason || "理由なし"
    }
  });
  await createAuditLog({
    actorId: input.actorId,
    action: "ATTENDANCE_CORRECTION",
    entityType: "ATTENDANCE_RECORD",
    entityId: record.id,
    details: {
      userId: input.userId,
      targetDate: input.targetDate,
      actorRole: input.actorRole,
      beforeClockInAt: iso(beforeClockInAt),
      beforeClockOutAt: iso(beforeClockOutAt),
      afterClockInAt: iso(afterClockInAt),
      afterClockOutAt: iso(afterClockOutAt)
    }
  });
  return serializeRecord(updated);
}

export async function updateDailyOperations(input: {
  userId: string;
  targetDate: string;
  onCall?: boolean;
  emergencyVisits?: number;
}) {
  const record = await prisma.attendanceRecord.upsert({
    where: { userId_workDate: { userId: input.userId, workDate: parseJstDate(input.targetDate) } },
    update: {
      ...(typeof input.onCall === "boolean" ? { onCall: input.onCall } : {}),
      ...(typeof input.emergencyVisits === "number" ? { emergencyVisits: Math.max(0, Math.floor(input.emergencyVisits)) } : {})
    },
    create: {
      userId: input.userId,
      workDate: parseJstDate(input.targetDate),
      onCall: input.onCall ?? false,
      emergencyVisits: Math.max(0, Math.floor(input.emergencyVisits ?? 0))
    }
  });
  return serializeRecord(record);
}

export async function leaveSummary(userId: string, options: { refresh?: boolean } = {}) {
  if (options.refresh) {
    await ensureAutoAnnualPaidLeaveGrants(userId);
    await recalculateLeaveGrantBalances(userId);
  }
  const today = parseJstDate(toJstDateKey());
  const grants = await prisma.paidLeaveGrant.findMany({ where: { userId }, orderBy: [{ expiresAt: "asc" }] });
  const activeGrants = grants.filter((grant) => grant.remainingMinutes > 0 && grant.expiresAt >= today);
  const threshold = addDays(new Date(), 180);
  const byType = activeGrants.reduce<Record<string, number>>((acc, grant) => {
    const type = grant.leaveType ?? "PAID_LEAVE";
    acc[type] = (acc[type] ?? 0) + grant.remainingMinutes;
    return acc;
  }, {});
  return {
    grants: grants.map(serializeGrant),
    totalRemaining: activeGrants.reduce((sum, grant) => sum + grant.remainingMinutes, 0),
    byType,
    expiring: activeGrants.filter((grant) => grant.expiresAt <= threshold).map(serializeGrant)
  };
}

export async function createPaidLeaveGrant(input: {
  userId: string;
  grantDate: string;
  grantedDays: number;
  note: string;
  leaveType?: string;
}) {
  const minutes = Math.max(0, input.grantedDays) * 8 * 60;
  const grant = await prisma.paidLeaveGrant.create({
    data: {
      userId: input.userId,
      grantDate: parseJstDate(input.grantDate),
      expiresAt: parseJstDate(paidLeaveExpiry(input.grantDate)),
      grantedMinutes: minutes,
      remainingMinutes: minutes,
      source: "MANUAL",
      status: "CONFIRMED",
      note: input.note || "管理者付与",
      leaveType: input.leaveType ?? "PAID_LEAVE"
    }
  });
  return serializeGrant(grant);
}

function paidLeaveExpiry(grantDate: string) {
  return toJstDateKey(addDays(addYears(new Date(`${grantDate}T00:00:00+09:00`), 2), -1));
}

const regularGrantDays = [10, 11, 12, 14, 16, 18, 20];
const partGrantDays: Record<number, number[]> = {
  4: [7, 8, 9, 10, 12, 13, 15],
  3: [5, 6, 6, 8, 9, 10, 11],
  2: [3, 4, 4, 5, 6, 6, 7],
  1: [1, 2, 2, 2, 3, 3, 3]
};

async function ensureAutoAnnualPaidLeaveGrants(userId?: string) {
  const today = toJstDateKey();
  const users = await prisma.user.findMany({
    where: { role: "STAFF", employmentStatus: "ACTIVE", ...(userId ? { id: userId } : {}) },
    include: { workSettings: true }
  });
  for (const user of users) {
    const serializedUser = serializeUser(user);
    for (const [index, grantDateKey] of annualGrantDateKeys(serializedUser).entries()) {
      if (grantDateKey > today) continue;
      if (serializedUser.retirementDate && grantDateKey > serializedUser.retirementDate) continue;
      const exists = await prisma.paidLeaveGrant.findFirst({
        where: { userId: user.id, grantDate: parseJstDate(grantDateKey), source: "AUTO", leaveType: "PAID_LEAVE" }
      });
      if (exists) continue;
      const setting = effectiveWorkSetting(serializedUser, grantDateKey);
      const days = annualGrantDays(setting.weeklyWorkDays, setting.weeklyWorkHours, index);
      if (days <= 0) continue;
      await prisma.paidLeaveGrant.create({
        data: {
          userId: user.id,
          grantDate: parseJstDate(grantDateKey),
          expiresAt: parseJstDate(paidLeaveExpiry(grantDateKey)),
          grantedMinutes: days * 8 * 60,
          remainingMinutes: days * 8 * 60,
          source: "AUTO",
          status: "CONFIRMED",
          note: "法定自動付与",
          leaveType: "PAID_LEAVE"
        }
      });
    }
  }
}

async function recalculateLeaveGrantBalances(userId?: string) {
  const today = parseJstDate(toJstDateKey());
  const grants = await prisma.paidLeaveGrant.findMany({ where: userId ? { userId } : undefined });
  for (const grant of grants) {
    await prisma.paidLeaveGrant.update({
      where: { id: grant.id },
      data: {
        remainingMinutes: grant.expiresAt < today ? 0 : grant.grantedMinutes,
        status: grant.expiresAt < today ? "EXPIRED" : "CONFIRMED"
      }
    });
  }
  const requests = await prisma.paidLeaveRequest.findMany({
    where: { status: "APPROVED", leaveType: "PAID_LEAVE", ...(userId ? { userId } : {}) },
    orderBy: { startAt: "asc" }
  });
  for (const request of requests) {
    let remaining = request.requestedMinutes;
    const requestDate = request.startAt;
    const consumable = await prisma.paidLeaveGrant.findMany({
      where: {
        userId: request.userId,
        leaveType: "PAID_LEAVE",
        remainingMinutes: { gt: 0 },
        grantDate: { lte: requestDate },
        expiresAt: { gte: requestDate }
      },
      orderBy: [{ expiresAt: "asc" }]
    });
    for (const grant of consumable) {
      const used = Math.min(remaining, grant.remainingMinutes);
      if (used > 0) {
        await prisma.paidLeaveGrant.update({ where: { id: grant.id }, data: { remainingMinutes: { decrement: used } } });
      }
      remaining -= used;
      if (remaining <= 0) break;
    }
  }
}

async function runDailyLeaveMaintenance() {
  const today = toJstDateKey();
  if (dailyLeaveMaintenanceKey === today) return;
  dailyLeaveMaintenanceKey = today;
  await ensureAutoAnnualPaidLeaveGrants();
  await recalculateLeaveGrantBalances();
}

function annualGrantDateKeys(user: User) {
  const hire = new Date(`${user.hireDate}T00:00:00+09:00`);
  return regularGrantDays.map((_, index) => {
    const grantDate = new Date(hire);
    grantDate.setMonth(grantDate.getMonth() + 6 + index * 12);
    return toJstDateKey(grantDate);
  });
}

function effectiveWorkSetting(user: User, dateKey: string) {
  const settings = (user.workSettings ?? [])
    .filter((setting) => setting.effectiveFrom <= dateKey)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  return settings[0] ?? user;
}

export async function getStandardWorkForDate(userId: string, targetDate: string) {
  const user = await findUserById(userId);
  if (!user) return { start: "09:00", end: "18:00", label: "9:00-18:00" };
  const setting = effectiveWorkSetting(user, targetDate) as User | WorkSetting;
  const start = "standardStartTime" in setting ? setting.standardStartTime : "09:00";
  const end = "standardEndTime" in setting ? setting.standardEndTime : inferStandardEnd(start, setting.weeklyWorkDays, setting.weeklyWorkHours);
  return { start, end, label: `${trimTime(start)}-${trimTime(end)}` };
}

export async function getStandardWorkMap(userId: string, month: string, days: number) {
  const user = await findUserById(userId);
  if (!user) {
    return Object.fromEntries(
      Array.from({ length: days }, (_, index) => {
        const date = `${month}-${String(index + 1).padStart(2, "0")}`;
        return [date, { start: "09:00", end: "18:00", label: "9:00-18:00" }];
      })
    );
  }
  const entries = Array.from({ length: days }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, "0")}`;
      const setting = effectiveWorkSetting(user, date) as User | WorkSetting;
      const start = "standardStartTime" in setting ? setting.standardStartTime : "09:00";
      const end = "standardEndTime" in setting ? setting.standardEndTime : inferStandardEnd(start, setting.weeklyWorkDays, setting.weeklyWorkHours);
      return [date, { start, end, label: `${trimTime(start)}-${trimTime(end)}` }] as const;
    });
  return Object.fromEntries(entries);
}

function normalizeTimeInput(value: string, fallback: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function inferStandardEnd(start: string, weeklyWorkDays: number, weeklyWorkHours: number) {
  const dailyWorkMinutes = Math.round((weeklyWorkHours / Math.max(1, weeklyWorkDays)) * 60);
  const breakMinutes = dailyWorkMinutes >= 6 * 60 ? 60 : 0;
  const endMinutes = timeToMinutes(start) + dailyWorkMinutes + breakMinutes;
  const hours = Math.floor(endMinutes / 60);
  const minutes = endMinutes % 60;
  return `${String(Math.min(23, hours)).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function trimTime(value: string) {
  return value.startsWith("0") ? value.slice(1) : value;
}

function annualGrantDays(weeklyWorkDays: number, weeklyWorkHours: number, grantIndex: number) {
  if (weeklyWorkDays >= 5 || weeklyWorkHours >= 30) return regularGrantDays[Math.min(grantIndex, regularGrantDays.length - 1)];
  const row = partGrantDays[Math.max(1, Math.min(4, weeklyWorkDays))];
  return row[Math.min(grantIndex, row.length - 1)] ?? 0;
}

function monthBounds(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = parseJstDate(`${year}-${String(monthIndex).padStart(2, "0")}-01`);
  const next = monthIndex === 12 ? parseJstDate(`${year + 1}-01-01`) : parseJstDate(`${year}-${String(monthIndex + 1).padStart(2, "0")}-01`);
  return { start, next };
}

export async function getMonthData(month: string) {
  await ensureInitialData();
  const { start, next } = monthBounds(month);
  const [staffUsers, records, leaves, correctionRequests, leaveRequests, correctionLogs, leaveRequestHistory, paidLeaveGrants, auditLogs, monthClosed] = await Promise.all([
    prisma.user.findMany({ where: { role: "STAFF" }, include: { workSettings: true } }),
    prisma.attendanceRecord.findMany({ where: { workDate: { gte: start, lt: next } } }),
    prisma.paidLeaveRequest.findMany({ where: { startAt: { gte: start, lt: next } } }),
    prisma.correctionRequest.findMany({ where: { status: "PENDING" } }),
    prisma.paidLeaveRequest.findMany({ where: { status: "PENDING" } }),
    prisma.correctionLog.findMany({ where: { targetDate: { gte: start, lt: next } } }),
    prisma.paidLeaveRequest.findMany({ where: { startAt: { gte: start, lt: next } } }),
    prisma.paidLeaveGrant.findMany(),
    getRecentAuditLogs(40),
    isMonthClosed(month)
  ]);
  const users = staffUsers.filter((user) => user.employmentStatus === "ACTIVE" || (user.retirementDate && user.retirementDate >= start));
  return {
    users: users.map(serializeUser),
    allStaffUsers: staffUsers.map(serializeUser),
    records: records.map(serializeRecord),
    leaves: leaves.map(serializeLeaveRequest),
    correctionRequests: correctionRequests.map(serializeCorrectionRequest),
    leaveRequests: leaveRequests.map(serializeLeaveRequest),
    correctionLogs: correctionLogs.map(serializeCorrectionLog),
    leaveRequestHistory: leaveRequestHistory.map(serializeLeaveRequest),
    paidLeaveGrants: paidLeaveGrants.map(serializeGrant),
    auditLogs,
    monthClosed
  };
}

export async function createLeaveRequest(input: Omit<PaidLeaveRequest, "id" | "status">) {
  if (await isMonthClosed(input.startAt.slice(0, 7))) {
    throw new Error("この月は月末締め済みです。管理者に依頼してください。");
  }
  const request = await prisma.paidLeaveRequest.create({
    data: {
      userId: input.userId,
      leaveType: input.leaveType,
      unit: input.unit,
      halfDayPeriod: input.halfDayPeriod,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      requestedMinutes: input.requestedMinutes,
      reason: input.reason,
      status: "PENDING"
    }
  });
  await createAuditLog({
    actorId: input.userId,
    action: "LEAVE_REQUEST_CREATE",
    entityType: "PAID_LEAVE_REQUEST",
    entityId: request.id,
    details: { leaveType: input.leaveType, unit: input.unit, startAt: input.startAt, endAt: input.endAt }
  });
  return serializeLeaveRequest(request);
}

export async function createCorrectionRequest(input: Omit<CorrectionRequest, "id" | "status">) {
  const request = await prisma.correctionRequest.create({
    data: {
      userId: input.userId,
      targetDate: parseJstDate(input.targetDate),
      requestedClockInAt: input.requestedClockInAt ? new Date(input.requestedClockInAt) : null,
      requestedClockOutAt: input.requestedClockOutAt ? new Date(input.requestedClockOutAt) : null,
      reason: input.reason,
      status: "PENDING"
    }
  });
  return serializeCorrectionRequest(request);
}

export async function decideLeaveRequest(id: string, adminId: string, status: "APPROVED" | "REJECTED") {
  const request = await prisma.paidLeaveRequest.update({
    where: { id },
    data: { status, approverId: adminId, reviewedAt: new Date() }
  });
  await recalculateLeaveGrantBalances(request.userId);
  await createAuditLog({
    actorId: adminId,
    action: status === "APPROVED" ? "LEAVE_REQUEST_APPROVE" : "LEAVE_REQUEST_REJECT",
    entityType: "PAID_LEAVE_REQUEST",
    entityId: id,
    details: { userId: request.userId, status }
  });
  return serializeLeaveRequest(request);
}

export async function decideCorrectionRequest(id: string, adminId: string, status: "APPROVED" | "REJECTED") {
  const request = await prisma.correctionRequest.update({
    where: { id },
    data: { status, approverId: adminId, reviewedAt: new Date() }
  });
  if (status === "APPROVED") {
    await saveAttendanceCorrection({
      userId: request.userId,
      actorId: adminId,
      actorRole: "ADMIN",
      targetDate: dateKey(request.targetDate),
      clockIn: request.requestedClockInAt ? request.requestedClockInAt.toTimeString().slice(0, 5) : "",
      clockOut: request.requestedClockOutAt ? request.requestedClockOutAt.toTimeString().slice(0, 5) : "",
      reason: request.reason
    });
  }
  await createAuditLog({
    actorId: adminId,
    action: status === "APPROVED" ? "CORRECTION_REQUEST_APPROVE" : "CORRECTION_REQUEST_REJECT",
    entityType: "CORRECTION_REQUEST",
    entityId: id,
    details: { userId: request.userId, targetDate: dateKey(request.targetDate), status }
  });
  return serializeCorrectionRequest(request);
}
