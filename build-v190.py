"""Build Ver.1.9.0 with the shared PASS visual design."""
from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / "build-v184.py")], check=True)

page = ROOT / "index.html"
html = page.read_text(encoding="utf-8")
assert html.count("v1.8.4</title>") == 1
assert html.count("Ver.1.8.4") >= 1
assert "design-v1.9.css" not in html

html = html.replace("v1.8.4</title>", "v1.9.0</title>", 1)
html = html.replace("Ver.1.8.4", "Ver.1.9.0")
html = html.replace('<meta name="theme-color" content="#153a66">', '<meta name="theme-color" content="#173f5f">', 1)
html = html.replace(
    "<header><h1>⚖ 司法書士PASS</h1>",
    '<header><h1><span class="v190-mark" aria-hidden="true">司</span>司法書士PASS</h1>',
    1,
)
html = html.replace(
    '<section id="home" class="panel"><h2>学習ホーム</h2>',
    '<section id="home" class="panel"><p class="v190-kicker">STUDY DASHBOARD</p><h2>学習ホーム</h2>',
    1,
)
html = html.replace("</head>", '<link rel="stylesheet" href="design-v1.9.css"></head>', 1)
assert html.count("design-v1.9.css") == 1
assert html.count('class="v190-mark"') == 1
assert html.count('class="v190-kicker"') == 1
page.write_text(html, encoding="utf-8")

for info_name in ("privacy.html", "contact.html", "sources.html"):
    info_path = ROOT / info_name
    info_html = info_path.read_text(encoding="utf-8")
    info_html = info_html.replace('<meta name="theme-color" content="#153a66">', '<meta name="theme-color" content="#173f5f">', 1)
    if "design-v1.9.css" not in info_html:
        info_html = info_html.replace("</head>", '  <link rel="stylesheet" href="design-v1.9.css">\n</head>', 1)
    info_path.write_text(info_html, encoding="utf-8")

worker = ROOT / "service-worker.js"
worker_text = worker.read_text(encoding="utf-8")
worker_text = worker_text.replace("v184-core-1", "v190-core-1")
if "'./design-v1.9.css'" not in worker_text:
    worker_text = worker_text.replace("  './index.html',", "  './index.html',\n  './design-v1.9.css',", 1)
worker.write_text(worker_text, encoding="utf-8")

manifest_path = ROOT / "manifest.webmanifest"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["background_color"] = "#f3f5f2"
manifest["theme_color"] = "#173f5f"
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("Built Ver.1.9.0", page.stat().st_size, "bytes")
