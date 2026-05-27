export default function HomePage() {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div>
          <p className="eyebrow">Attendance Manager</p>
          <h1>勤怠管理</h1>
          <p className="muted">利用する入口を選んでください。</p>
        </div>
        <div className="login-choice">
          <a className="primary" href="/staff-login">スタッフログイン</a>
          <a className="secondary" href="/admin-login">管理者ログイン</a>
        </div>
      </section>
    </main>
  );
}
