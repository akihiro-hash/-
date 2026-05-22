"use client";

import { useState } from "react";
import { minutesToHours } from "@/lib/time";

type LeaveRequest = {
  id: string;
  leaveType: string;
  unit: string;
  halfDayPeriod?: "AM" | "PM" | null;
  startAt: string;
  endAt: string;
  requestedMinutes: number;
  reason: string;
  status: string;
};

const unitLabels: Record<string, string> = {
  FULL_DAY: "全日",
  HALF_DAY: "半日",
  HOURLY: "時間"
};

const halfDayLabels: Record<string, string> = {
  AM: "午前",
  PM: "午後"
};

const leaveLabels: Record<string, string> = {
  PAID_LEAVE: "有給",
  COMPENSATORY_HOLIDAY: "振休",
  SUBSTITUTE_HOLIDAY: "代休",
  ABSENCE: "欠勤",
  SPECIAL_LEAVE: "特別休暇"
};

const statusLabels: Record<string, string> = {
  PENDING: "承認待ち",
  APPROVED: "承認済み",
  REJECTED: "却下"
};

export function LeaveHistoryModal({ requests }: { requests: LeaveRequest[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="metric metric-button" onClick={() => setOpen(true)}>
        <span>申請履歴</span>
        <strong>{requests.length}件</strong>
        <small>一覧を確認</small>
      </button>

      {open && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="leave-history-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <h2 id="leave-history-title">休暇申請の履歴</h2>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>閉じる</button>
            </div>
            <div className="day-list">
              {requests.map((request) => (
                <div className="day-item" key={request.id}>
                  <strong>
                    {request.startAt.slice(0, 10)} / {formatLeaveRequestLabel(request)}
                  </strong>
                  <span>{statusLabels[request.status] ?? request.status} / {minutesToHours(request.requestedMinutes)}h</span>
                  <span className="muted">
                    使用日: {request.startAt.slice(0, 10)}
                    {request.endAt.slice(0, 10) !== request.startAt.slice(0, 10) ? ` - ${request.endAt.slice(0, 10)}` : ""}
                  </span>
                  <span className="muted">理由: {request.reason || "理由なし"}</span>
                </div>
              ))}
              {requests.length === 0 && <p className="muted">申請履歴はまだありません。</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function formatLeaveRequestLabel(request: LeaveRequest) {
  const leave = leaveLabels[request.leaveType] ?? request.leaveType;
  if (request.unit === "HALF_DAY") {
    return `${halfDayLabels[request.halfDayPeriod ?? ""] ?? "半日"}${leave}`;
  }
  return `${unitLabels[request.unit] ?? request.unit}${leave}`;
}
