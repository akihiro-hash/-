"use client";

import { useState } from "react";
import { minutesToHours } from "@/lib/time";

type Grant = {
  id: string;
  grantDate: string;
  expiresAt: string;
  grantedMinutes: number;
  remainingMinutes: number;
  note?: string | null;
  leaveType?: string;
};

const leaveLabels: Record<string, string> = {
  PAID_LEAVE: "有給",
  COMPENSATORY_HOLIDAY: "振休",
  SUBSTITUTE_HOLIDAY: "代休"
};

export function LeaveGrantHistoryModal({ grants }: { grants: Grant[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>付与履歴</button>
      {open && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="grant-history-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <h2 id="grant-history-title">休暇の付与履歴</h2>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>閉じる</button>
            </div>
            <div className="day-list">
              {grants.map((grant) => (
                <div className="day-item" key={grant.id}>
                  <strong>{grant.grantDate} / {leaveLabels[grant.leaveType ?? "PAID_LEAVE"] ?? "休暇"}</strong>
                  <span>付与 {minutesToHours(grant.grantedMinutes) / 8}日 / 残 {minutesToHours(grant.remainingMinutes) / 8}日</span>
                  <span className="muted">失効: {grant.expiresAt} / {grant.note || "メモなし"}</span>
                </div>
              ))}
              {grants.length === 0 && <p className="muted">付与履歴はありません。</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
