"use client";

import { useState } from "react";

export function AdminHelpModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        表の見方
      </button>
      {open && (
        <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <section className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="admin-help-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <h2 id="admin-help-title">全スタッフ勤怠の見方</h2>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>閉じる</button>
            </div>
            <div className="help-list">
              <p><strong>緑のセル</strong>: 通常出勤です。セル内の時刻は出勤時刻です。</p>
              <p><strong>黄色のセル</strong>: 申請中、またはオンコール当番です。</p>
              <p><strong>青のセル</strong>: 有給・振休・代休など承認済みの休みです。</p>
              <p><strong>赤のセル</strong>: 欠勤、打刻漏れ、土日祝出勤など確認が必要な状態です。</p>
              <p><strong>丸い数字</strong>: その日の緊急訪問回数です。</p>
              <p><strong>年次有給</strong>: 入社日と勤務設定にもとづいて自動付与されます。管理者が手動で付与する通常操作はありません。</p>
              <p><strong>代休付与</strong>: 土日祝出勤などで代休が発生した場合に、管理者が「代休付与」から記録します。</p>
              <p><strong>有給付与履歴</strong>: 自動付与された有給や、管理者が付与した代休の履歴を確認する場所です。</p>
              <p><strong>パート設定</strong>: 「スタッフ勤務設定」で適用開始日つきの週所定労働日数・時間を登録します。有給の自動付与計算にも使います。</p>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
