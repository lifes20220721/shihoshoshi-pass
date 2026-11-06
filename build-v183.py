"""Build Ver.1.8.3 with return-to-text navigation."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / "build-v182.py")], check=True)

page = ROOT / "index.html"
html = page.read_text(encoding="utf-8")

assert html.count("v1.8.2</title>") == 1
assert html.count("Ver.1.8.2") >= 1
assert html.count('src="resume-v1.8.2.js"') == 1

html = html.replace("v1.8.2</title>", "v1.8.3</title>", 1)
html = html.replace("Ver.1.8.2", "Ver.1.8.3")
html = html.replace('src="resume-v1.8.2.js"', 'src="resume-v1.8.3.js"', 1)
html = html.replace(
    '<button id="v182OxBack" onclick="v182PreviousOx()" disabled>← 一つ前</button>',
    '<button id="v182OxBack" onclick="v182PreviousOx()" disabled>← 一つ前</button>'
    '<button id="v183TextBack" class="hidden" onclick="v183BackToText()">← 元のテキストへ</button>',
    1,
)
html = html.replace(
    '<button id="v182FiveBack" onclick="v182PreviousFive()" disabled>← 一つ前</button>',
    '<button id="v182FiveBack" onclick="v182PreviousFive()" disabled>← 一つ前</button>'
    '<button id="v183FiveTextBack" class="hidden" onclick="v183BackToText()">← 元のテキストへ</button>',
    1,
)

assert html.count('id="v183TextBack"') == 1
assert html.count('id="v183FiveTextBack"') == 1

# Keep AdSense ownership verification when regenerating the published page.
adsense_meta = '<meta name="google-adsense-account" content="ca-pub-8976067134459371">'
assert html.count('</head>') == 1
html = html.replace('</head>', adsense_meta + '</head>', 1)

page.write_text(html, encoding="utf-8")
print("Built Ver.1.8.3", page.stat().st_size, "bytes")
