import { AdminAccountForm } from "@/components/AdminAccountForm";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
  const admin = await requireAdmin();

  return (
    <main className="admin-shell">
      <a className="secondary" href="/admin">管理者画面へ戻る</a>
      <section className="card no-print">
        <h1>管理者アカウント設定</h1>
        <p className="muted">メールアドレスとパスワードを変更できます。変更には現在のパスワードが必要です。</p>
        <AdminAccountForm email={admin.email} />
      </section>
    </main>
  );
}
