"use client";

const navItems = [
  { target: "staff-today", label: "今日" },
  { target: "staff-leave", label: "休暇" },
  { target: "staff-correction", label: "修正" },
  { target: "staff-month", label: "勤怠" }
];

export function StaffQuickNav() {
  function jumpTo(target: string) {
    const element = document.getElementById(target);
    if (!element) return;
    if (element instanceof HTMLDetailsElement) element.open = true;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav className="staff-quick-nav no-print" aria-label="スタッフ画面ショートカット">
      {navItems.map((item) => (
        <button type="button" key={item.target} onClick={() => jumpTo(item.target)}>
          <span aria-hidden="true">{shortcutMark(item.label)}</span>
          <strong>{item.label}</strong>
        </button>
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
