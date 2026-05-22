"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminDecisionButtons({ approveEndpoint, rejectEndpoint }: { approveEndpoint: string; rejectEndpoint: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function decide(endpoint: string, label: string) {
    setPending(label);
    const response = await fetch(endpoint, { method: "POST" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      alert(payload?.error ?? "処理に失敗しました。");
    }
    setPending(null);
    router.refresh();
  }

  return (
    <div className="admin-actions">
      <button className="primary" type="button" onClick={() => decide(approveEndpoint, "approve")} disabled={!!pending}>
        承認
      </button>
      <button className="danger" type="button" onClick={() => decide(rejectEndpoint, "reject")} disabled={!!pending}>
        却下
      </button>
    </div>
  );
}

export function PrintButton() {
  return (
    <button className="secondary" type="button" onClick={() => window.print()}>
      印刷
    </button>
  );
}
