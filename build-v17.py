from pathlib import Path
import json
R=Path(__file__).parent
s=(R/'index-v16-backup-20261023.html').read_text()
assert 'Ver.1.6' in s and 'const v17CaseData=' not in s
payload=json.loads((R/'case-law-notes-v1.7.json').read_text())
js=(R/'case-notes-v1.7.js').read_text().replace('__CASE_DATA__',json.dumps(payload,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c'))
s=s.replace('v1.6</title>','v1.7</title>').replace('Ver.1.6','Ver.1.7')
s=s.replace('<button onclick="v15OpenAmendments()">⚖ 法改正の注釈</button>','<button class="primary" onclick="v17OpenCasebook()">⚖ 頻出論点・判例ノート（22件）</button><button onclick="v15OpenAmendments()">⚖ 法改正の注釈</button>',1)
s=s.replace('<div id="v15PdfLinks" class="actions"></div>','<div id="v15PdfLinks" class="actions"></div><div id="v17PastCaseLinks"></div>',1)
section='''<section id="casebook" class="panel hidden"><h2>⚖ 頻出論点・判例ノート</h2><p class="muted">2022～2026年度の過去問に関連する16論点・22判例。関連論点が出た年度数・問題数を表示します。判例そのものの出題回数ではありません。</p><div id="v17CaseFilters"><label for="v17CaseSearch">キーワード・判例の日付で探す</label><input id="v17CaseSearch" type="search" placeholder="例：法定地上権、相殺、自白" oninput="v17RenderCaseList()"><label for="v17CaseSubject">科目</label><select id="v17CaseSubject" onchange="v17RenderCaseList()"></select><label for="v17CaseFrequency">関連論点の出題年度数</label><select id="v17CaseFrequency" onchange="v17RenderCaseList()"><option value="2">複数年度で出題</option><option value="3">３年度以上で出題</option><option value="5">５年度全てで出題</option><option value="0">全て</option></select><div id="v17CaseScope" class="actions"></div><p id="v17CaseCount" class="muted" aria-live="polite"></p></div><div id="v17CaseResults"></div><div id="v17CaseDetail" class="hidden"></div><div class="actions"><button onclick="show('home')">← ホームへ</button></div></section>'''
s=s.replace('</main>',section+'</main>',1)
css='''<style>#v17CaseSearch{width:100%;font:inherit;min-height:44px;border:1px solid #bdc9d7;border-radius:10px;padding:12px}#v17CaseFilters label{display:block;margin:12px 0 5px}.v17-case-card{border:1px solid #d6e1ec;border-radius:12px;padding:14px;margin:12px 0}.v17-case-link{display:block;line-height:1.75;padding:10px 0;color:#145a91;overflow-wrap:anywhere}.v17-case-card>.v17-case-link{font-size:17px;font-weight:700}.v17-related{border-top:1px solid #c4d3e2;margin:14px 0;padding-top:12px}.v17-related summary{cursor:pointer;font-weight:700;color:#153a66}#v17CaseDetail p{line-height:1.9}#v17CaseDetail>button{display:block;width:100%;text-align:left;margin:8px 0}#v17CaseDetail ol{line-height:1.9}#v17CaseDetail>a{display:block;margin:10px 0;overflow-wrap:anywhere}</style>'''
s=s.replace('</body>',css+'<script>\n'+js+'\n</script></body>')
(R/'index.html').write_text(s)
print('Built Ver.1.7',len(s.encode()),'bytes')
