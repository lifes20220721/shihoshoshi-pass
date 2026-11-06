"""Build Ver.1.8.4 with links from citations to official original statutes."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
subprocess.run([sys.executable, str(ROOT / 'build-v183.py')], check=True)
page = ROOT / 'index.html'
html = page.read_text(encoding='utf-8')
assert html.count('v1.8.3</title>') == 1
assert html.count('src="resume-v1.8.3.js"') == 1
html = html.replace('v1.8.3</title>', 'v1.8.4</title>', 1).replace('Ver.1.8.3', 'Ver.1.8.4')
html = html.replace('<script defer src="resume-v1.8.3.js"></script>',
                    '<script defer src="resume-v1.8.3.js"></script><script defer src="article-links-v1.8.4.js"></script>', 1)
style = '<style>.v184-law-link{color:#145a91;text-decoration:underline;text-underline-offset:3px}.v184-law-link:focus-visible{outline:3px solid #cb9a30;outline-offset:3px}.v184-law-help{font-size:13px;line-height:1.8;border-top:1px solid #d6e1ec;padding-top:10px}</style>'
html = html.replace('</head>', style + '</head>', 1)
assert html.count('name="google-adsense-account"') == 1
page.write_text(html, encoding='utf-8')
print('Built Ver.1.8.4', page.stat().st_size, 'bytes')
