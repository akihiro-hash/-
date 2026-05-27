import { LoginPanel } from "@/components/LoginPanel";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function StaffLoginPage({ searchParams }: Props) {
  const params = await searchParams;
  return (
    <LoginPanel
      title="スタッフログイン"
      description="打刻、休暇申請、今月の勤怠確認はこちらから入ります。"
      role="STAFF"
      defaultEmail="hanako@example.com"
      error={params.error}
    />
  );
}
