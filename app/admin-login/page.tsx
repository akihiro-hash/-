import { LoginPanel } from "@/components/LoginPanel";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <LoginPanel
      title="管理者ログイン"
      description="承認、月次確認、スタッフ管理はこちらから入ります。"
      role="ADMIN"
      defaultEmail="admin@example.com"
      error={params.error}
    />
  );
}
