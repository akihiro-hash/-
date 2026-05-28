from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "勤怠管理アプリ_総合説明書.pdf"


APP1_URL = "https://kintai-app-smilo.vercel.app"
APP2_URL = "https://kintai-app-second.vercel.app"


def register_fonts():
    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiKakuGo-W5"))
    pdfmetrics.registerFont(UnicodeCIDFont("HeiseiMin-W3"))


def make_styles():
    base = getSampleStyleSheet()
    styles = {
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontName="HeiseiKakuGo-W5",
            fontSize=22,
            leading=29,
            alignment=TA_CENTER,
            spaceAfter=10,
            wordWrap="CJK",
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base["Normal"],
            fontName="HeiseiKakuGo-W5",
            fontSize=10.5,
            leading=16,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#555555"),
            spaceAfter=12,
            wordWrap="CJK",
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="HeiseiKakuGo-W5",
            fontSize=15,
            leading=20,
            textColor=colors.HexColor("#1F4D78"),
            spaceBefore=13,
            spaceAfter=7,
            wordWrap="CJK",
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="HeiseiKakuGo-W5",
            fontSize=12.5,
            leading=17,
            textColor=colors.HexColor("#2E74B5"),
            spaceBefore=9,
            spaceAfter=5,
            wordWrap="CJK",
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["BodyText"],
            fontName="HeiseiMin-W3",
            fontSize=9.6,
            leading=14.5,
            spaceAfter=5,
            alignment=TA_LEFT,
            wordWrap="CJK",
        ),
        "small": ParagraphStyle(
            "small",
            parent=base["BodyText"],
            fontName="HeiseiMin-W3",
            fontSize=8.5,
            leading=12,
            spaceAfter=3,
            wordWrap="CJK",
        ),
        "note": ParagraphStyle(
            "note",
            parent=base["BodyText"],
            fontName="HeiseiKakuGo-W5",
            fontSize=9,
            leading=13,
            textColor=colors.HexColor("#5F4300"),
            wordWrap="CJK",
        ),
        "cell": ParagraphStyle(
            "cell",
            parent=base["BodyText"],
            fontName="HeiseiMin-W3",
            fontSize=8.2,
            leading=11.5,
            wordWrap="CJK",
        ),
        "cell_bold": ParagraphStyle(
            "cell_bold",
            parent=base["BodyText"],
            fontName="HeiseiKakuGo-W5",
            fontSize=8.2,
            leading=11.5,
            wordWrap="CJK",
        ),
    }
    return styles


def p(text, style):
    return Paragraph(text.replace("\n", "<br/>"), style)


def bullets(items, styles):
    flow = []
    for item in items:
        flow.append(p(f"・{item}", styles["body"]))
    return flow


def note_box(title, text, styles):
    table = Table(
        [[p(f"{title}<br/>{text}", styles["note"])]],
        colWidths=[170 * mm],
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF4DB")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#E4CFA4")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return [table, Spacer(1, 5)]


def simple_table(headers, rows, widths, styles):
    data = [[p(h, styles["cell_bold"]) for h in headers]]
    for row in rows:
        data.append([p(str(c), styles["cell"]) for c in row])
    table = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E8EEF5")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#000000")),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#B8C7D9")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return [table, Spacer(1, 6)]


def on_page(canvas, doc):
    canvas.saveState()
    canvas.setFont("HeiseiKakuGo-W5", 8)
    canvas.setFillColor(colors.HexColor("#666666"))
    canvas.drawString(20 * mm, 12 * mm, "勤怠管理アプリ 総合説明書")
    canvas.drawRightString(190 * mm, 12 * mm, f"{doc.page}")
    canvas.restoreState()


def build_pdf():
    register_fonts()
    styles = make_styles()
    OUT.parent.mkdir(parents=True, exist_ok=True)

    doc = BaseDocTemplate(
        str(OUT),
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin + 6 * mm, doc.width, doc.height - 6 * mm, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=frame, onPage=on_page)])

    story = []
    story.append(p("勤怠管理アプリ 総合説明書", styles["title"]))
    story.append(p("最初のアプリ・セカンドアプリ共通 / スタッフ用・管理者用 / 重要事項まとめ", styles["subtitle"]))
    story += note_box(
        "この資料の目的",
        "2つの勤怠管理アプリについて、何ができるのか、スタッフと管理者がどう使うのか、本運用で気をつけることをまとめた資料です。",
        styles,
    )

    story.append(p("1. アプリの種類と使い分け", styles["h1"]))
    story += simple_table(
        ["アプリ", "URL", "特徴"],
        [
            ["最初のアプリ", APP1_URL, "オンコール、緊急訪問回数、みなし残業20時間に近い場合の管理者アラートまで含む版です。"],
            ["セカンドアプリ", APP2_URL, "オンコール・緊急訪問・みなし残業アラートを外したシンプル版です。"],
        ],
        [32, 58, 80],
        styles,
    )
    story += note_box(
        "普段開くURL",
        "長いプレビューURLではなく、上記の短い本番URLを使います。VercelのプレビューURLは古い失敗デプロイが残って見えることがあります。",
        styles,
    )

    story.append(p("2. 共通仕様", styles["h1"]))
    story += bullets(
        [
            "スタッフはスマホで使いやすい画面、管理者はパソコンで一覧確認しやすい画面です。",
            "出勤、退勤、通常勤務登録、休暇申請、出退勤修正、パスワード変更ができます。",
            "管理者は全スタッフ1か月分の勤怠を一覧確認できます。",
            "休暇申請と勤怠修正は管理者承認が必要です。",
            "スタッフが出退勤を修正した場合、管理者画面に修正ログが残ります。",
            "月末締め後は、スタッフ側からその月の修正ができません。管理者は修正できます。",
            "有給は入社日と勤務条件に基づき自動付与し、原則2年で失効する前提です。",
            "退職者は削除せず、退職日を設定して過去データを残します。",
            "管理者画面からExcel、CSV、全データバックアップを出力できます。",
        ],
        styles,
    )

    story.append(p("3. 最初のアプリだけの仕様", styles["h1"]))
    story += bullets(
        [
            "オンコール当番の有無を登録できます。",
            "緊急訪問回数を入力できます。翌日に入力した回数は前日に反映される運用です。",
            "管理者画面でオンコール・緊急訪問回数を修正できます。",
            "全スタッフ月次一覧では、オンコール当番の日の色が変わり、緊急訪問回数は数字で表示されます。",
            "月15時間以上の残業がある場合、管理者画面にみなし20時間に近い旨のアラートが出ます。",
        ],
        styles,
    )

    story.append(p("4. セカンドアプリだけの仕様", styles["h1"]))
    story += bullets(
        [
            "オンコール、緊急訪問回数、みなし残業アラートは管理対象から外しています。",
            "スタッフ画面・管理者画面・Excel/CSV出力にもオンコール関連は表示されません。",
            "通常の勤怠、休暇、有給、代休、月末締め、バックアップ機能は使えます。",
        ],
        styles,
    )

    story.append(PageBreak())
    story.append(p("5. スタッフ用: 基本の使い方", styles["h1"]))
    story.append(p("5-1. ログイン", styles["h2"]))
    story += simple_table(
        ["アプリ", "スタッフログインURL"],
        [
            ["最初のアプリ", f"{APP1_URL}/staff-login"],
            ["セカンドアプリ", f"{APP2_URL}/staff-login"],
        ],
        [45, 125],
        styles,
    )
    story += bullets(
        [
            "管理者から案内されたメールアドレスと初期パスワードでログインします。",
            "初期パスワードは原則 password123 です。",
            "ログイン後、スタッフ画面下部のパスワード変更から自分のパスワードに変更します。",
        ],
        styles,
    )

    story.append(p("5-2. 出勤・退勤", styles["h2"]))
    story += bullets(
        [
            "出勤時に「出勤」を押します。",
            "退勤時に「退勤」を押します。",
            "退勤後は「今日も一日お疲れさまでした」と表示されます。",
            "「通常勤務」ボタンを押すと、スタッフ勤務設定に合わせた標準時間で登録できます。",
            "勤務設定を変えると、スタッフ画面の通常勤務ボタンの時間も変わります。",
        ],
        styles,
    )

    story.append(p("5-3. 休暇申請", styles["h2"]))
    story += simple_table(
        ["休暇種別", "使い方"],
        [
            ["有給", "有給休暇を取るときに使います。全日、半日、時間単位に対応します。"],
            ["半日有給", "午前・午後を選べます。"],
            ["特別休", "産休など、有給を減らさず休みの記録を残したい場合に使えます。"],
            ["振休", "振替休日として休む場合に使います。"],
            ["代休", "休日出勤などで付与された代休を使う場合に使います。"],
            ["欠勤", "有給等を使わず休む場合に使います。"],
        ],
        [35, 135],
        styles,
    )
    story += bullets(
        [
            "理由入力は任意です。未入力でも送信できます。",
            "申請後は管理者の承認待ちになります。",
            "申請履歴を押すと、小窓で過去の申請や使用日を確認できます。",
        ],
        styles,
    )

    story.append(p("5-4. 出退勤の修正", styles["h2"]))
    story += bullets(
        [
            "出退勤の修正画面で、カレンダーから対象日を選びます。",
            "登録済みの日は色がつき、未登録の日と見分けやすくなっています。",
            "出勤時刻、退勤時刻を入力して送信します。",
            "理由は任意です。",
            "スタッフが修正した内容は、管理者画面の修正ログに残ります。",
            "月末締め済みの月はスタッフ側から修正できません。",
        ],
        styles,
    )

    story.append(p("5-5. アラート確認", styles["h2"]))
    story += bullets(
        [
            "未打刻や退勤漏れがある場合、スタッフ画面に「アラートが○件あります」と表示されます。",
            "押すと対象日を一覧で確認できます。",
            "勤務曜日設定があるスタッフは、その曜日に基づいてアラート判定されます。",
            "土日祝や勤務予定日ではない日は原則アラート対象外です。",
        ],
        styles,
    )

    story.append(PageBreak())
    story.append(p("6. 管理者用: 基本の使い方", styles["h1"]))
    story.append(p("6-1. ログイン", styles["h2"]))
    story += simple_table(
        ["アプリ", "管理者ログインURL"],
        [
            ["最初のアプリ", f"{APP1_URL}/admin-login"],
            ["セカンドアプリ", f"{APP2_URL}/admin-login"],
        ],
        [45, 125],
        styles,
    )

    story.append(p("6-2. 月次勤怠一覧を見る", styles["h2"]))
    story += bullets(
        [
            "対象月を選び、「表示」を押します。",
            "全スタッフ1か月分をスタッフ×日付の表で確認できます。",
            "休みのセルにカーソルを合わせると、休暇種別や理由メモを確認できます。",
            "普通に出勤できている日も色がつき、見間違いを減らします。",
            "印刷ボタンで月次一覧を印刷できます。",
        ],
        styles,
    )
    story += simple_table(
        ["表示", "意味"],
        [
            ["出", "通常出勤"],
            ["遅", "遅刻"],
            ["早", "早退"],
            ["欠", "欠勤"],
            ["有", "有給"],
            ["漏", "未打刻・退勤漏れ"],
            ["申請", "承認待ち"],
        ],
        [25, 145],
        styles,
    )

    story.append(p("6-3. 申請を承認・却下する", styles["h2"]))
    story += bullets(
        [
            "未承認がある場合、管理者画面上部にアラートが表示されます。",
            "休暇申請と勤怠修正申請を確認します。",
            "問題なければ承認、内容に問題があれば却下します。",
            "承認・却下の履歴は記録として残ります。",
        ],
        styles,
    )

    story.append(p("6-4. スタッフ追加・勤務設定", styles["h2"]))
    story += bullets(
        [
            "スタッフ管理から新規スタッフを追加できます。",
            "職種は、看護師、理学療法士、作業療法士、言語聴覚士、その他から選べます。",
            "雇用形態、入社日、週所定日数、週所定時間、勤務曜日を設定します。",
            "既存スタッフの勤務設定は、適用開始日を指定して変更できます。",
            "パートなど週4日以内のスタッフは勤務曜日を選ぶことでアラート判定が正確になります。",
            "標準出勤・標準退勤を変更すると、スタッフ画面の通常勤務ボタンにも反映されます。",
        ],
        styles,
    )

    story.append(p("6-5. 退職者管理", styles["h2"]))
    story += bullets(
        [
            "退職者は削除しません。",
            "在籍状態を休職・退職にし、退職日を入力します。",
            "退職日以降は通常の月次対象や未打刻アラートから外れます。",
            "過去の勤怠、有給、申請、修正ログは残ります。",
        ],
        styles,
    )

    story.append(p("6-6. 代休付与", styles["h2"]))
    story += bullets(
        [
            "土日祝に出勤があった場合など、管理者画面から代休を付与できます。",
            "付与された代休はスタッフ側の残数にも表示されます。",
            "代休の付与履歴は管理者画面と出力ファイルに残ります。",
        ],
        styles,
    )

    story.append(p("6-7. 月末締め", styles["h2"]))
    story += bullets(
        [
            "月末の確認が終わったら「この月を締める」を押します。",
            "締め後はスタッフ側からその月の修正や申請ができなくなります。",
            "締め前に、未承認、未打刻、退勤漏れ、休日出勤候補を確認してください。",
        ],
        styles,
    )

    story.append(PageBreak())
    story.append(p("7. 出力・バックアップ", styles["h1"]))
    story += simple_table(
        ["ボタン", "用途"],
        [
            ["Excel出力", "対象月の勤怠を人が見やすい形で出力します。社労士提出用にも使えます。"],
            ["CSV出力", "スプレッドシート取り込みやシステム連携向けです。"],
            ["全データExcel", "スタッフ、勤怠、有給、休暇申請、修正ログなどをシート分けして保存します。"],
            ["全データJSON", "将来復元する可能性を考えたデータ控えです。"],
            ["印刷", "管理者画面の月次一覧を印刷します。"],
        ],
        [38, 132],
        styles,
    )
    story += note_box(
        "無料版Supabaseの注意",
        "Supabase無料版には自動バックアップがありません。月末締め後や大きな修正前に、必ず全データExcelと全データJSONを保存してください。",
        styles,
    )
    story += bullets(
        [
            "保存先は、パソコンだけでなくGoogle Drive、OneDrive、USBなど複数に分けると安心です。",
            "Excelは人が確認する控え、JSONは復元用の控えです。",
            "バックアップを作るだけでは自動復元はできません。復元が必要になったらJSONを使って戻す作業を行います。",
        ],
        styles,
    )

    story.append(p("8. 重要事項", styles["h1"]))
    story += simple_table(
        ["項目", "重要なポイント"],
        [
            ["法的確認", "有給付与、休憩、半休、代休、振休、産休などは就業規則と社労士確認が必要です。"],
            ["産休", "退職扱いにはせず、在籍中のまま特別休で管理する運用が現実的です。"],
            ["休職", "休職と退職は本来分けた方が安全です。今の運用では扱いに注意してください。"],
            ["パスワード", "スタッフが各自で変更します。忘れた場合は管理者が仮パスワード password123 に戻します。"],
            ["アカウント管理", "GitHub、Vercel、Supabaseのログイン情報と2段階認証の復旧情報を必ず保管してください。"],
            ["本番URL", "普段使うのは短い本番URLです。長いプレビューURLは確認用で、古いエラーが残ることがあります。"],
            ["本番修正", "大きな修正前には、全データJSONとExcelを保存してください。"],
        ],
        [35, 135],
        styles,
    )

    story.append(p("9. 本運用時のおすすめ手順", styles["h1"]))
    story += bullets(
        [
            "本運用開始日を決めます。",
            "スタッフ全員の氏名、メール、職種、雇用形態、入社日、勤務曜日、週所定時間を登録します。",
            "管理者・スタッフ全員がログインできるか確認します。",
            "スタッフに操作説明書とログインURLを共有します。",
            "月末締め前に未承認と未打刻を確認します。",
            "月末締め後にExcel出力、全データExcel、全データJSONを保存します。",
            "保存したファイルは月ごとのフォルダに分けて保管します。",
        ],
        styles,
    )

    story.append(p("10. 何かあった時の確認順", styles["h1"]))
    story += simple_table(
        ["困ったこと", "確認すること"],
        [
            ["ログインできない", "URLが本番URLか、メール・パスワードが正しいか、退職扱いになっていないか確認します。"],
            ["画面が500になる", "/api/health を開き、ok:true になるか確認します。エラー文を控えます。"],
            ["勤怠が違う", "スタッフ修正、管理者修正、修正ログを確認します。"],
            ["有給残数が違う", "有給付与履歴、失効日、承認済み休暇申請を確認します。"],
            ["データが消えたように見える", "月の選択、退職日、バックアップファイルを確認します。"],
        ],
        [45, 125],
        styles,
    )

    doc.build(story)
    print(OUT)


if __name__ == "__main__":
    build_pdf()
