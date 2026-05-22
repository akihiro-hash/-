import { requireUser } from "@/lib/auth";

export default async function StaffPage() {
  const user = await requireUser();
  return (
    <main className="staff-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">スタッフ</p>
          <h1>{user.name}</h1>
          <p className="muted">クラウド版の接続確認ページです。</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="secondary">ログアウト</button>
        </form>
      </header>
      <section className="card stack">
        <h2>公開準備中</h2>
        <p>Vercel上でアプリが開けるか確認するための一時ページです。</p>
        <p className="muted">勤怠・有給の本番データ保存はSupabase接続版へ移行してから有効化します。</p>
      </section>
    </main>
  );
}
