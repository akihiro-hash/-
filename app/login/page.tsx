export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Attendance Manager</p>
          <h1>勤怠管理</h1>
          <p className="muted">スタッフの打刻・有給申請と、管理者の月次確認をまとめて扱えます。</p>
        </div>
        <form action="/api/auth/login" method="post" className="stack">
          {params.error && <p className="error-box">メールアドレスまたはパスワードが違います。</p>}
          <label>
            メールアドレス
            <input name="email" type="email" defaultValue="admin@example.com" required />
          </label>
          <label>
            パスワード
            <input name="password" type="password" defaultValue="password123" required />
          </label>
          <button className="primary" type="submit">ログイン</button>
        </form>
        <p className="hint">デモ: admin@example.com / password123、hanako@example.com / password123</p>
      </section>
    </main>
  );
}
