"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export function AdminAccountForm({ email }: { email: string }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPending(true);
    const form = event.currentTarget;
    const response = await fetch("/api/admin/account", { method: "POST", body: new FormData(form) });
    const payload = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(payload.error ?? "管理者アカウントを変更できませんでした。");
      return;
    }
    form.reset();
    setMessage("管理者アカウントを更新しました。次回から新しいメールアドレス・パスワードでログインしてください。");
  }

  return (
    <details className="accordion-card">
      <summary className="accordion-summary">管理者アカウント設定</summary>
      <div className="accordion-body">
        <form className="admin-actions" onSubmit={submit}>
          <label>
            新しいメールアドレス
            <input name="email" type="email" defaultValue={email} required />
          </label>
          <label>
            現在のパスワード
            <input name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <label>
            新しいパスワード
            <input name="newPassword" type="password" autoComplete="new-password" minLength={8} placeholder="変更しない場合は空欄" />
          </label>
          <label>
            新しいパスワード確認
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} placeholder="変更しない場合は空欄" />
          </label>
          <button className="primary" disabled={pending}>{pending ? "更新中..." : "管理者アカウントを更新"}</button>
          {message && <p className="hint">{message}</p>}
        </form>
      </div>
    </details>
  );
}
