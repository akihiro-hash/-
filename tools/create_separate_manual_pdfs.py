from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import BaseDocTemplate, Frame, PageBreak, PageTemplate, Paragraph, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"


def setup_fonts():
    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiMin-W3"))


def styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("title", parent=base["Title"], fontName="HeiseiKakuGo-W5", fontSize=21, leading=28, alignment=TA_CENTER, spaceAfter=8, wordWrap="CJK"),
        "subtitle": ParagraphStyle("subtitle", parent=base["Normal"], fontName="HeiseiKakuGo-W5", fontSize=10, leading=15, alignment=TA_CENTER, textColor=colors.HexColor("#555555"), spaceAfter=12, wordWrap="CJK"),
        "h1": ParagraphStyle("h1", parent=base["Heading1"], fontName="HeiseiKakuGo-W5", fontSize=14.5, leading=19, textColor=colors.HexColor("#1F4D78"), spaceBefore=12, spaceAfter=6, wordWrap="CJK"),
        "h2": ParagraphStyle("h2", parent=base["Heading2"], fontName="HeiseiKakuGo-W5", fontSize=12.2, leading=16.5, textColor=colors.HexColor("#2E74B5"), spaceBefore=8, spaceAfter=4, wordWrap="CJK"),
        "body": ParagraphStyle("body", parent=base["BodyText"], fontName="HeiseiMin-W3", fontSize=9.3, leading=13.6, spaceAfter=4.5, alignment=TA_LEFT, wordWrap="CJK"),
        "note": ParagraphStyle("note", parent=base["BodyText"], fontName="HeiseiKakuGo-W5", fontSize=8.8, leading=12.6, textColor=colors.HexColor("#5F4300"), wordWrap="CJK"),
        "cell": ParagraphStyle("cell", parent=base["BodyText"], fontName="HeiseiMin-W3", fontSize=7.8, leading=10.8, wordWrap="CJK"),
        "cell_bold": ParagraphStyle("cell_bold", parent=base["BodyText"], fontName="HeiseiKakuGo-W5", fontSize=7.8, leading=10.8, wordWrap="CJK"),
    }


def p(text, style):
    return Paragraph(str(text).replace("\n", "<br/>"), style)


def bullets(items, st):
    return [p(f"・{item}", st["body"]) for item in items]


def note(title, text, st):
    table = Table([[p(f"{title}<br/>{text}", st["note"])]], colWidths=[170 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF4DB")),
        ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#E4CFA4")),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return [table, Spacer(1, 5)]


def table(headers, rows, widths, st):
    data = [[p(h, st["cell_bold"]) for h in headers]]
    data += [[p(c, st["cell"]) for c in row] for row in rows]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#B8C7D9")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ("TOPPADDING", (0, 0), (-1, -1), 4.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
    ]))
    return [t, Spacer(1, 6)]


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("HeiseiKakuGo-W5", 8)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawString(20 * mm, 12 * mm, doc.title_label)
    canvas.drawRightString(190 * mm, 12 * mm, str(doc.page))
    canvas.restoreState()


def make_doc(path, title_label, story):
    DOCS.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(path), pagesize=A4, rightMargin=20 * mm, leftMargin=20 * mm, topMargin=18 * mm, bottomMargin=18 * mm)
    doc.title_label = title_label
    frame = Frame(doc.leftMargin, doc.bottomMargin + 6 * mm, doc.width, doc.height - 6 * mm, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=on_page)])
    doc.build(story)


def common_staff_sections(st):
    story = []
    story.append(p("スタッフの使い方", st["h1"]))
    story += bullets([
        "スタッフログインURLを開き、メールアドレスとパスワードでログインします。",
        "初期パスワードは原則 password123 です。初回ログイン後、画面下部のパスワード変更から各自で変更します。",
        "出勤時は「出勤」、退勤時は「退勤」を押します。",
        "「通常勤務」ボタンは、管理者が設定した標準出勤・標準退勤に合わせて表示されます。",
        "未打刻や退勤漏れがある場合は「アラートが○件あります」と表示され、押すと対象日を確認できます。",
        "今月の勤怠、過去月の勤怠はスタッフ画面の勤怠メニューから確認できます。",
    ], st)

    story.append(p("スタッフの休暇申請", st["h2"]))
    story += bullets([
        "休暇申請画面から、有給、特別休、振休、代休、欠勤を申請できます。",
        "理由は任意です。書かなくても申請できます。",
        "申請後は管理者の承認待ちになります。承認されるまでは確定ではありません。",
        "申請履歴を押すと、小窓で過去に申請・使用した日付を確認できます。",
        "有給残数、振休残数、代休残数もスタッフ側で確認できます。",
    ], st)
    return story


def leave_detail_sections(st):
    story = []
    story.append(p("休み・有給の設定と考え方", st["h1"]))
    story += table(
        ["項目", "仕様・運用"],
        [
            ["有給", "入社日と週所定日数・週所定時間をもとに自動付与します。正社員相当は法定日数、パートは比例付与の考え方で計算します。"],
            ["有給の失効", "原則2年で失効する前提です。失効が近い有給はスタッフ画面・管理者画面でアラート表示します。"],
            ["有給の消化順", "古い失効日の付与分から消化する想定です。"],
            ["半日有給", "午前・午後を選んで申請できます。管理上は半日分として扱います。"],
            ["時間有給", "時間単位の申請に対応しています。"],
            ["特別休", "産休など、有給残数を減らさず休みの記録を残したい場合に使います。"],
            ["振休", "勤務日と休日を入れ替える運用の場合に使います。"],
            ["代休", "休日出勤などにより後から休みを付与する場合に使います。管理者が代休付与できます。"],
            ["欠勤", "有給・特別休・代休等を使わず休む場合に使います。"],
            ["承認", "休暇申請は管理者が承認・却下します。承認後に月次一覧や出力へ反映されます。"],
        ],
        [35, 135],
        st,
    )
    story += note(
        "社労士確認ポイント",
        "有給付与、休憩時間、半休、時間有給、振休、代休、産休・育休、休職中の有給付与は就業規則や個別事情により扱いが変わる可能性があります。本運用前後で社労士確認を推奨します。",
        st,
    )
    story.append(p("産休・休職・退職の扱い", st["h2"]))
    story += bullets([
        "産休は退職扱いにせず、在籍中のまま特別休で登録する運用が現実的です。",
        "退職者は削除せず、在籍状態を休職・退職にして退職日を入力します。",
        "退職日以降は通常の月次対象や未打刻アラートから外れますが、過去データは残ります。",
        "休職は退職とは本来別管理が望ましいため、休職者が出る場合は運用ルールを確認してください。",
    ], st)
    return story


def admin_sections(st, include_oncall):
    story = []
    story.append(p("管理者の使い方", st["h1"]))
    story += bullets([
        "管理者ログインURLからログインします。",
        "対象月を選ぶと、全スタッフ1か月分の勤怠を一覧で確認できます。",
        "休みのセルにカーソルを合わせると、休暇種別や理由メモを確認できます。",
        "未承認の休暇申請・勤怠修正申請がある場合、画面上部にアラートが出ます。",
        "承認待ち一覧で内容を確認し、承認または却下します。",
        "月末確認が終わったら月末締めを行います。締め後はスタッフ側からその月の修正ができません。",
    ], st)
    story.append(p("スタッフ管理", st["h2"]))
    story += bullets([
        "新規スタッフ追加では、氏名、メール、職種、雇用形態、部署、入社日、週所定日数、勤務曜日、週所定時間を登録します。",
        "職種は、看護師、理学療法士、作業療法士、言語聴覚士、その他から選べます。",
        "既存スタッフの勤務設定は、適用開始日を指定して変更できます。",
        "標準出勤・標準退勤を変更すると、スタッフ画面の通常勤務ボタンにも反映されます。",
        "パスワードを忘れたスタッフは、管理者画面から仮パスワード password123 に戻せます。",
    ], st)
    if include_oncall:
        story.append(p("オンコール・緊急訪問・残業アラート", st["h2"]))
        story += bullets([
            "スタッフはオンコール当番の有無を登録できます。",
            "緊急訪問回数は翌日に入力し、前日分に反映する運用です。",
            "管理者はオンコール・緊急訪問回数を修正できます。",
            "月次一覧ではオンコール当番の日の色が変わり、緊急訪問回数は数字で表示されます。",
            "月15時間以上の残業がある場合、管理者画面にみなし20時間に近い旨の赤文字アラートが出ます。",
        ], st)
    else:
        story.append(p("セカンドで外している機能", st["h2"]))
        story += bullets([
            "オンコール当番の登録はありません。",
            "緊急訪問回数の入力・表示はありません。",
            "みなし残業20時間に近いアラートはありません。",
            "通常の勤怠、休暇、有給、代休、月末締め、バックアップは使えます。",
        ], st)
    return story


def backup_sections(st, app_name):
    story = []
    story.append(p("出力・バックアップ", st["h1"]))
    story += table(
        ["ボタン", "用途"],
        [
            ["Excel出力", "対象月の勤怠を人が見やすい形で出力します。社労士提出用にも使えます。"],
            ["CSV出力", "スプレッドシート取り込みやシステム連携向けです。"],
            ["全データExcel", "スタッフ、勤怠、有給、休暇申請、修正ログなどをシート分けして保存します。"],
            ["全データJSON", "将来復元する可能性を考えたデータ控えです。"],
            ["印刷", "管理者画面の月次一覧を印刷します。"],
        ],
        [38, 132],
        st,
    )
    story += note(
        "無料版Supabaseの重要事項",
        f"{app_name} はSupabase無料版で運用する場合、自動バックアップがありません。月末締め後、大きな修正前、本運用開始前には、全データExcelと全データJSONを保存してください。",
        st,
    )
    story += bullets([
        "Excelは人が確認する控えです。",
        "JSONは将来復元するための控えです。",
        "バックアップファイルはパソコンだけでなく、Google Drive、OneDrive、USBなど複数箇所に保存すると安心です。",
        "バックアップを取るだけでは自動復元はできません。復元が必要な場合はJSONを使って戻す作業を行います。",
    ], st)
    return story


def important_sections(st, url):
    story = []
    story.append(p("重要事項・本運用前チェック", st["h1"]))
    story += table(
        ["項目", "内容"],
        [
            ["本番URL", url],
            ["プレビューURL", "長いURLは確認用です。普段は短い本番URLを使います。"],
            ["ログイン情報", "GitHub、Vercel、Supabaseのログインメール、2段階認証、復旧コードを保管してください。"],
            ["スタッフ共有", "スタッフにはログインURL、初期パスワード、打刻・申請・修正方法を共有します。"],
            ["月末処理", "未承認、未打刻、退勤漏れ、休日出勤候補、バックアップを確認してから締めます。"],
            ["データ保護", "スタッフ情報・勤怠・有給履歴は個人情報を含むため、出力ファイルの保管場所に注意します。"],
        ],
        [35, 135],
        st,
    )
    return story


def build_manual(app_title, url, out_name, include_oncall):
    st = styles()
    story = [
        p(app_title, st["title"]),
        p("仕様・スタッフ用説明・管理者用説明・休み/有給設定・重要事項", st["subtitle"]),
    ]
    story += note("この資料について", "初めて使うスタッフ・管理者向けに、アプリの使い方と運用上の注意点をまとめた説明書です。", st)
    story.append(p("アプリ概要", st["h1"]))
    story += table(
        ["項目", "内容"],
        [
            ["本番URL", url],
            ["スタッフログイン", f"{url}/staff-login"],
            ["管理者ログイン", f"{url}/admin-login"],
            ["主な用途", "勤怠打刻、休暇申請、勤怠修正、管理者承認、月次確認、出力、バックアップ"],
            ["対象画面", "スタッフはスマホ利用、管理者はパソコン利用を想定"],
        ],
        [35, 135],
        st,
    )
    story += common_staff_sections(st)
    story.append(PageBreak())
    story += leave_detail_sections(st)
    story.append(PageBreak())
    story += admin_sections(st, include_oncall)
    story.append(PageBreak())
    story += backup_sections(st, app_title)
    story += important_sections(st, url)
    make_doc(DOCS / out_name, app_title, story)


def main():
    setup_fonts()
    build_manual("最初の勤怠管理アプリ 説明書", "https://kintai-app-smilo.vercel.app", "最初の勤怠管理アプリ_説明書.pdf", True)
    build_manual("セカンド勤怠管理アプリ 説明書", "https://kintai-app-second.vercel.app", "セカンド勤怠管理アプリ_説明書.pdf", False)
    print(DOCS / "最初の勤怠管理アプリ_説明書.pdf")
    print(DOCS / "セカンド勤怠管理アプリ_説明書.pdf")


if __name__ == "__main__":
    main()
