"""Build the Ver.1.7.1 information pages update from the Ver.1.7 source."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / "build-v17.py")], check=True)
page = ROOT / "index.html"
html = page.read_text(encoding="utf-8")

old_title = "v1.7</title>"
old_footer = "</footer>"
assert html.count(old_title) == 1
assert html.count(old_footer) == 1

html = html.replace(old_title, "v1.7.1</title>", 1)
html = html.replace("Ver.1.7", "Ver.1.7.1")
html = html.replace(
    old_footer,
    '<nav aria-label="サイト情報" style="margin-top:12px;line-height:2">'
    '<a href="privacy.html">プライバシーポリシー</a>　'
    '<a href="contact.html">運営・お問い合わせ</a>'
    "</nav></footer>",
    1,
)
html = html.replace(
    '<meta name="theme-color" content="#153a66">',
    '<meta name="theme-color" content="#153a66">'
    '<meta name="description" content="司法書士試験の全11科目を学べる無料の学習サイト。科目別テキスト、過去問解説、○×問題、５肢択一、判例ノートを収録。">',
    1,
)
page.write_text(html, encoding="utf-8")
print("Built Ver.1.7.1", page.stat().st_size, "bytes")
