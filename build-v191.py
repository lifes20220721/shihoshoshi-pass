"""Build Ver.1.9.1 with frequency-weighted original reinforcement questions."""
from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / "build-v190.py")], check=True)

questions = json.loads((ROOT / "question-reinforcement-v1.9.1.json").read_text(encoding="utf-8"))
assert len(questions) == 33
template = (ROOT / "question-quality-v1.9.1.template.js").read_text(encoding="utf-8")
payload = json.dumps(questions, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
runtime = template.replace("__V191_QUESTIONS__", payload)
assert "__V191_QUESTIONS__" not in runtime
(ROOT / "question-quality-v1.9.1.js").write_text(runtime, encoding="utf-8")

page = ROOT / "index.html"
html = page.read_text(encoding="utf-8")
assert html.count("v1.9.0</title>") == 1
assert html.count("Ver.1.9.0") >= 1
assert "question-quality-v1.9.1.js" not in html

html = html.replace("v1.9.0</title>", "v1.9.1</title>", 1)
html = html.replace("Ver.1.9.0", "Ver.1.9.1")
html = html.replace(
    "○×2,000問（基本305問・過去問肢別1,695問）",
    "○×2,033問（基本・頻出補強338問・過去問肢別1,695問）",
    1,
)
html = html.replace(
    '<option value="">全問題（2,000問）</option><option value="basic">基本確認（305問）</option>',
    '<option value="">全問題（2,033問）</option><option value="basic">基本・頻出補強（338問）</option>',
    1,
)
home_marker = '<div id="stats"></div>'
quality_note = (
    '<p class="v191-quality-note"><strong>過去5年の出題分布を反映</strong><br>'
    '頻出上位11分野に、原問の誤答パターンを比較できる独自問題33問を追加しました。</p>'
)
assert html.count(home_marker) == 1
html = html.replace(home_marker, quality_note + home_marker, 1)
html = html.replace(
    '<link rel="stylesheet" href="design-v1.9.css"></head>',
    '<link rel="stylesheet" href="design-v1.9.css"><script defer src="question-quality-v1.9.1.js"></script></head>',
    1,
)
assert html.count("question-quality-v1.9.1.js") == 1
page.write_text(html, encoding="utf-8")

worker_path = ROOT / "service-worker.js"
worker = worker_path.read_text(encoding="utf-8")
worker = worker.replace("v190-core-1", "v191-core-1")
if "'./question-quality-v1.9.1.js'" not in worker:
    worker = worker.replace("  './design-v1.9.css',", "  './design-v1.9.css',\n  './question-quality-v1.9.1.js',", 1)
worker_path.write_text(worker, encoding="utf-8")

print("Built Ver.1.9.1", page.stat().st_size, "bytes")
