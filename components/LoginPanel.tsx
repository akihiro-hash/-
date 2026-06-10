type Props = {
  title: string;
  description: string;
  role: "STAFF" | "ADMIN";
  defaultEmail: string;
  error?: string;
};

const errorMessages: Record<string, string> = {
  "1": "メールアドレスまたはパスワードが違います。",
  role: "この入口ではログインできないアカウントです。",
  inactive: "このスタッフアカウントは現在ログインできない状態です。",
  server: "サーバー側でログインに失敗しました。少し待ってからもう一度試してください。"
};

export function LoginPanel({ title, description, role, defaultEmail, error }: Props) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Attendance Manager</p>
          <h1>{title}</h1>
          <p className="muted">{description}</p>
        </div>
        {error && errorMessages[error] && <p className="error-box">{errorMessages[error]}</p>}
        <form action="/api/auth/login" method="post" className="stack">
          <input name="expectedRole" type="hidden" value={role} />
          <label>
            メールアドレス
            <input name="email" type="email" defaultValue={defaultEmail} required />
          </label>
          <label>
            パスワード
            <input name="password" type="password" defaultValue="password123" required />
          </label>
          <button className="primary" type="submit">ログイン</button>
        </form>
        <div className="login-switch">
          {role === "STAFF" ? (
            <a href="/admin-login">管理者はこちら</a>
          ) : (
            <a href="/staff-login">スタッフはこちら</a>
          )}
        </div>
      </section>
    </main>
  );
}
