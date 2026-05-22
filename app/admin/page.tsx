import { requireAdmin } from "@/lib/auth";

export default async function AdminPage() {
  const admin = await requireAdmin();
  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="eyebrow">管理者</p>
          <h1>クラウド公開確認</h1>
          <p className="muted">{admin.name}</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="secondary">ログアウト</button>
        </form>
      </header>
      <section className="card stack">
        <h2>公開準備中</h2>
        <p>Vercel上でアプリが開けるか確認するための一時ページです。</p>
        <p className="muted">このあと、ローカルJSON保存からSupabase保存へ切り替えて本体機能を反映します。</p>
      </section>
    </main>
  );
}
