"""Build Ver.1.8.2 with previous-question navigation."""

from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / "build-v181.py")], check=True)

page = ROOT / "index.html"
html = page.read_text(encoding="utf-8")

assert html.count("v1.8.1</title>") == 1
assert html.count("Ver.1.8.1") >= 1
assert html.count('src="resume-v1.8.1.js"') == 1

html = html.replace("v1.8.1</title>", "v1.8.2</title>", 1)
html = html.replace("Ver.1.8.1", "Ver.1.8.2")
html = html.replace('src="resume-v1.8.1.js"', 'src="resume-v1.8.2.js"', 1)

html = html.replace(
    '<button id="next" class="primary hidden" onclick="nextQuestion()">',
    '<button id="v182OxBack" onclick="v182PreviousOx()" disabled>← 一つ前</button>'
    '<button id="next" class="primary hidden" onclick="nextQuestion()">',
    1,
)
html = html.replace(
    '<button id="fiveNext" class="primary hidden" onclick="nextFive()">',
    '<button id="v182FiveBack" onclick="v182PreviousFive()" disabled>← 一つ前</button>'
    '<button id="fiveNext" class="primary hidden" onclick="nextFive()">',
    1,
)
html = html.replace(
    '<button id="v15Reveal" class="primary" onclick="v15RevealPast()">正答・解説を見る</button><button onclick="v15NextPast()">次の問題 →</button>',
    '<button id="v15Reveal" class="primary" onclick="v15RevealPast()">正答・解説を見る</button>'
    '<button id="v182PastBack" onclick="v182PreviousPast()" disabled>← 一つ前</button>'
    '<button id="v182PastNext" onclick="v15NextPast()">次の問題 →</button>',
    1,
)

assert html.count('id="v182OxBack"') == 1
assert html.count('id="v182FiveBack"') == 1
assert html.count('id="v182PastBack"') == 1
assert html.count('id="v182PastNext"') == 1

page.write_text(html, encoding="utf-8")
print("Built Ver.1.8.2", page.stat().st_size, "bytes")
