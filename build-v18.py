"""Build the installable PWA edition from the Ver.1.7.1 source."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / "build-v171.py")], check=True)

page = ROOT / "index.html"
html = page.read_text(encoding="utf-8")

assert html.count("v1.7.1</title>") == 1
assert html.count("Ver.1.7.1") >= 1
assert html.count('<button onclick="v13Backup()">💾 バックアップ</button></div>') == 1
assert html.count("</head>") == 1

html = html.replace("v1.7.1</title>", "v1.8</title>", 1)
html = html.replace("Ver.1.7.1", "Ver.1.8")
html = html.replace(
    '<button onclick="v13Backup()">💾 バックアップ</button></div>',
    '<button onclick="v13Backup()">💾 バックアップ</button>'
    '<button class="primary" onclick="v18InstallApp()">📲 アプリとして追加</button>'
    '<button onclick="v18OpenInstallHelp()">📱 追加方法</button></div>'
    '<p id="v18NetworkStatus" class="v18-network muted" aria-live="polite"></p>',
    1,
)
html = html.replace(
    "</head>",
    '<link rel="manifest" href="manifest.webmanifest">'
    '<link rel="icon" href="icons/icon-192.png" type="image/png">'
    '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">'
    '<meta name="apple-mobile-web-app-capable" content="yes">'
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">'
    '<meta name="apple-mobile-web-app-title" content="司法書士PASS">'
    '<style>.v18-network{margin:8px 0 0}.v18-network.offline{color:#8b4e00;font-weight:700}</style>'
    '<script defer src="pwa-v1.8.js"></script></head>',
    1,
)

page.write_text(html, encoding="utf-8")
print("Built Ver.1.8", page.stat().st_size, "bytes")
