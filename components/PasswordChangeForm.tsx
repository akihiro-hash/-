"use client";

import type { FormEvent } from "react";
import { useState } from "react";

export function PasswordChangeForm() {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setPending(true);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/auth/change-password", { method: "POST", body: formData });
    const payload = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok) {
      setMessage(payload.error ?? "パスワードを変更できませんでした。");
      return;
    }
    form.reset();
    setMessage("パスワードを変更しました。");
  }

  return (
    <details className="accordion-card">
      <summary className="accordion-summary">パスワード変更</summary>
      <div className="accordion-body">
        <form className="stack" onSubmit={submit}>
          <label>
            現在のパスワード
            <input name="currentPassword" type="password" autoComplete="current-password" required />
          </label>
          <label>
            新しいパスワード
            <input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label>
            新しいパスワード確認
            <input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button className="secondary" disabled={pending}>{pending ? "変更中..." : "パスワードを変更"}</button>
          {message && <p className="hint">{message}</p>}
        </form>
      </div>
    </details>
  );
}
