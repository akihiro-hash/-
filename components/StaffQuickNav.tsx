const navItems = [
  { href: "/staff", label: "今日" },
  { href: "/staff/leave", label: "休暇" },
  { href: "/staff/correction", label: "修正" },
  { href: "/staff/month", label: "勤怠" }
];

export function StaffQuickNav() {
  return (
    <nav className="staff-quick-nav no-print" aria-label="スタッフ画面ショートカット">
      {navItems.map((item) => (
        <a href={item.href} key={item.href}>
          <span aria-hidden="true">{shortcutMark(item.label)}</span>
          <strong>{item.label}</strong>
        </a>
      ))}
    </nav>
  );
}

function shortcutMark(label: string) {
  if (label === "今日") return "●";
  if (label === "休暇") return "◇";
  if (label === "修正") return "□";
  return "◎";
}
