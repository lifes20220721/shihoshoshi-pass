"""Build Ver.1.9.2 with independent subject/topic resume positions."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / 'build-v191.py')], check=True)
page = ROOT / 'index.html'
html = page.read_text(encoding='utf-8')
assert html.count('<script defer src="resume-v1.8.3.js"></script>') == 1
assert html.count('<script defer src="question-quality-v1.9.1.js"></script>') == 1
html = html.replace('v1.9.1</title>', 'v1.9.2</title>', 1).replace('Ver.1.9.1', 'Ver.1.9.2')
html = html.replace('<script defer src="resume-v1.8.3.js"></script>', '', 1)
# Initialize resume after all question banks, including the v1.9.1 additions.
html = html.replace('<script defer src="question-quality-v1.9.1.js"></script>',
                    '<script defer src="question-quality-v1.9.1.js"></script><script defer src="resume-v1.9.2.js"></script>', 1)
style = '<style>.v192-scoped-resume h3{margin-top:0}.v192-resume-row{border-top:1px solid #c5d6e4;padding-top:8px;margin-top:12px}.v192-resume-row .actions{display:flex;flex-wrap:wrap;gap:8px}.v192-resume-row button{min-height:44px;white-space:normal}</style>'
html = html.replace('</head>', style + '</head>', 1)
assert html.count('name="google-adsense-account"') == 1
assert 'https://gyoseishoshipass.com/' in html
page.write_text(html, encoding='utf-8')
worker_path = ROOT / 'service-worker.js'
worker = worker_path.read_text(encoding='utf-8')
worker = worker.replace("'v191-core-2'", "'v192-core-1'").replace("'./resume-v1.8.3.js'", "'./resume-v1.9.2.js'")
worker_path.write_text(worker, encoding='utf-8')
print('Built Ver.1.9.2', page.stat().st_size, 'bytes')
