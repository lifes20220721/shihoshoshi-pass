"""Build Ver.1.8.1 with resumable quiz sessions."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / "build-v18.py")], check=True)

page = ROOT / "index.html"
html = page.read_text(encoding="utf-8")

assert html.count("v1.8</title>") == 1
assert html.count("Ver.1.8") >= 1
assert html.count('<div id="stats"></div>') == 1
assert html.count("</head>") == 1

html = html.replace("v1.8</title>", "v1.8.1</title>", 1)
html = html.replace("Ver.1.8", "Ver.1.8.1")
html = html.replace(
    '<div id="stats"></div>',
    '<div id="stats"></div>'
    '<div id="v181Resume" class="v181-resume hidden" aria-live="polite">'
    '<strong>前回の続きがあります</strong>'
    '<p id="v181ResumeText"></p>'
    '<div class="actions">'
    '<button class="primary" onclick="v181ResumeProgress()">▶ 続きから再開</button>'
    '<button onclick="v181DiscardProgress()">途中位置を消す</button>'
    '</div></div>',
    1,
)
html = html.replace(
    "</head>",
    '<style>.v181-resume{border:1px solid #9fb8d2;background:#eef6ff;border-radius:12px;padding:14px;margin:14px 0}'
    '.v181-resume strong{color:#153a66}.v181-resume p{margin:6px 0}</style>'
    '<script defer src="resume-v1.8.1.js"></script></head>',
    1,
)

page.write_text(html, encoding="utf-8")
print("Built Ver.1.8.1", page.stat().st_size, "bytes")
