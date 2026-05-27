"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  endpoint: string;
  children: React.ReactNode;
  className?: string;
  confirmMessage?: string;
  successMessage?: string;
};

export function ActionButton({ endpoint, children, className = "secondary", confirmMessage, successMessage }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPending(true);
    if (successMessage) {
      setMessage(successMessage);
    }
    const response = await fetch(endpoint, { method: "POST" });
    if (!response.ok) {
      setMessage(null);
      const payload = await response.json().catch(() => null);
      alert(payload?.error ?? "処理に失敗しました。");
    } else if (successMessage) {
      window.setTimeout(() => {
        setMessage(null);
        router.refresh();
      }, 900);
      setPending(false);
      return;
    }
    setPending(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={className} onClick={submit} disabled={pending}>
        {pending ? "処理中..." : children}
      </button>
      {message && <div className="cheer-message">{message}</div>}
    </>
  );
}
