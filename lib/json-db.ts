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
  jobTitle?: string;
  workSettings?: WorkSetting[];
};

export type WorkSetting = {
  id: string;
  effectiveFrom: string;
  weeklyWorkDays: number;
  weeklyWorkHours: number;
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

type DbSnapshot = {
  users: User[];
  attendanceRecords: AttendanceRecord[];
  breakRecords: [];
  paidLeaveGrants: PaidLeaveGrant[];
  paidLeaveRequests: PaidLeaveRequest[];
  correctionRequests: CorrectionRequest[];
  correctionLogs: CorrectionLog[];
};

function hashPassword(password: string) {
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
    workSettings: user.workSettings?.map(serializeWorkSetting)
  };
}

function serializeWorkSetting(setting: any): WorkSetting {
  return {
    id: setting.id,
    effectiveFrom: dateKey(setting.effectiveFrom),
    weeklyWorkDays: setting.weeklyWorkDays,
    weeklyWorkHours: setting.weeklyWorkHours,
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

async function ensureInitialData() {
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
  await ensureAutoAnnualPaidLeaveGrants();
  await recalculateLeaveGrantBalances();
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

export async function findUserByEmail(email: string) {
  await ensureInitialData();
  const user = await prisma.user.findUnique({ where: { email }, include: { workSettings: true } });
  return user ? serializeUser(user) : null;
}

export async function findUserById(id: string) {
  await ensureInitialData();
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
  department: string;
  jobTitle: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return null;
  const setting = await prisma.workSetting.create({
    data: {
      userId: input.userId,
      effectiveFrom: parseJstDate(input.effectiveFrom || toJstDateKey()),
      weeklyWorkDays: Math.max(1, Math.min(7, Math.floor(input.weeklyWorkDays))),
      weeklyWorkHours: Math.max(1, input.weeklyWorkHours),
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
        jobTitle: setting.jobTitle
      }
    });
  }
  return findUserById(input.userId);
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

export async function updateAttendance(userId: string, action: "CLOCK_IN" | "CLOCK_OUT") {
  const today = toJstDateKey();
  const current = await prisma.attendanceRecord.upsert({
    where: { userId_workDate: { userId, workDate: parseJstDate(today) } },
    update: {},
    create: { userId, workDate: parseJstDate(today) }
  });
  const now = normalizePunchTime(new Date(), action);
  const data: Record<string, Date> = {};
  if (action === "CLOCK_IN" && !current.clockInAt) data.clockInAt = now;
  if (action === "CLOCK_OUT" && current.clockInAt && !current.clockOutAt) data.clockOutAt = now;
  const updated = Object.keys(data).length
    ? await prisma.attendanceRecord.update({ where: { id: current.id }, data })
    : current;
  return serializeRecord(await recalcRecord(updated.id));
}

export async function setTodayStandardWork(userId: string) {
  return saveAttendanceCorrection({
    userId,
    actorId: userId,
    actorRole: "STAFF",
    targetDate: toJstDateKey(),
    clockIn: "09:00",
    clockOut: "18:00",
    reason: "通常勤務"
  });
}

function normalizePunchTime(value: Date, action: "CLOCK_IN" | "CLOCK_OUT") {
  const result = new Date(value);
  const jst = new Date(value.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
  const minutes = jst.getHours() * 60 + jst.getMinutes();
  if (action === "CLOCK_IN" && minutes >= 8 * 60 && minutes <= 9 * 60) {
    result.setTime(new Date(`${toJstDateKey(value)}T09:00:00+09:00`).getTime());
  }
  if (action === "CLOCK_OUT" && minutes >= 17 * 60 + 30 && minutes <= 18 * 60) {
    result.setTime(new Date(`${toJstDateKey(value)}T18:00:00+09:00`).getTime());
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
  const overtimeMins = calculateOvertime(record.clockOutAt);
  const status = record.clockInAt && record.clockOutAt ? "NORMAL" : record.clockInAt ? "MISSING_CLOCK" : "PENDING";
  return prisma.attendanceRecord.update({
    where: { id },
    data: { totalBreakMins, workMins, overtimeMins, status }
  });
}

function calculateOvertime(clockOutAt: Date | null) {
  if (!clockOutAt) return 0;
  const date = toJstDateKey(clockOutAt);
  const standardEnd = new Date(`${date}T18:00:00+09:00`).getTime();
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

export async function leaveSummary(userId: string) {
  await ensureAutoAnnualPaidLeaveGrants();
  await recalculateLeaveGrantBalances();
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

async function ensureAutoAnnualPaidLeaveGrants() {
  const today = toJstDateKey();
  const users = await prisma.user.findMany({ where: { role: "STAFF", employmentStatus: "ACTIVE" }, include: { workSettings: true } });
  for (const user of users) {
    for (const [index, grantDateKey] of annualGrantDateKeys(serializeUser(user)).entries()) {
      if (grantDateKey > today) continue;
      const exists = await prisma.paidLeaveGrant.findFirst({
        where: { userId: user.id, grantDate: parseJstDate(grantDateKey), source: "AUTO", leaveType: "PAID_LEAVE" }
      });
      if (exists) continue;
      const setting = effectiveWorkSetting(serializeUser(user), grantDateKey);
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

async function recalculateLeaveGrantBalances() {
  const today = parseJstDate(toJstDateKey());
  const grants = await prisma.paidLeaveGrant.findMany();
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
    where: { status: "APPROVED", leaveType: "PAID_LEAVE" },
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
  await ensureAutoAnnualPaidLeaveGrants();
  await recalculateLeaveGrantBalances();
  const { start, next } = monthBounds(month);
  const [users, records, leaves, correctionRequests, leaveRequests, correctionLogs, leaveRequestHistory, paidLeaveGrants] = await Promise.all([
    prisma.user.findMany({ where: { role: "STAFF", employmentStatus: "ACTIVE" }, include: { workSettings: true } }),
    prisma.attendanceRecord.findMany({ where: { workDate: { gte: start, lt: next } } }),
    prisma.paidLeaveRequest.findMany({ where: { startAt: { gte: start, lt: next } } }),
    prisma.correctionRequest.findMany({ where: { status: "PENDING" } }),
    prisma.paidLeaveRequest.findMany({ where: { status: "PENDING" } }),
    prisma.correctionLog.findMany({ where: { targetDate: { gte: start, lt: next } } }),
    prisma.paidLeaveRequest.findMany({ where: { startAt: { gte: start, lt: next } } }),
    prisma.paidLeaveGrant.findMany()
  ]);
  return {
    users: users.map(serializeUser),
    records: records.map(serializeRecord),
    leaves: leaves.map(serializeLeaveRequest),
    correctionRequests: correctionRequests.map(serializeCorrectionRequest),
    leaveRequests: leaveRequests.map(serializeLeaveRequest),
    correctionLogs: correctionLogs.map(serializeCorrectionLog),
    leaveRequestHistory: leaveRequestHistory.map(serializeLeaveRequest),
    paidLeaveGrants: paidLeaveGrants.map(serializeGrant)
  };
}

export async function createLeaveRequest(input: Omit<PaidLeaveRequest, "id" | "status">) {
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
  await recalculateLeaveGrantBalances();
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
  return serializeCorrectionRequest(request);
}
