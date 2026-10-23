from pathlib import Path
import json,re,shutil
R=Path(__file__).parent
BASE=R/'index-v15-backup-20261023.html'
s=BASE.read_text();assert 'Ver.1.5' in s and 'const v16Units=' not in s
units=json.loads((R/'study-content-v1.6.json').read_text());qs=json.loads((R/'question-expansion-v1.6.json').read_text())
js=(R/'v16-enrichment.js').read_text()
def payload(x):return json.dumps(x,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
js=js.replace('__UNITS__',payload(units)).replace('__QUESTIONS__',payload(qs))
s=s.replace('v1.5</title>','v1.6</title>').replace('Ver.1.5','Ver.1.6')
s=s.replace('全11科目の入門テキストと確認問題を収録。○×183問・5肢択一36問に加え、2022～2026年度の公式過去問350問・記述式10問の解説を収録。','全11科目・61分野のテキスト。○×2,000問（基本305問・過去問肢別1,695問）、5肢択一385問（基本36問・過去問349問）。過去５年の原問350問・記述式10問の解説も収録。')
s=s.replace('<h2>全11科目 テキスト（入門版）</h2>','<h2>全11科目・61分野 テキスト</h2>')
s=s.replace('<p class="muted">各問、正しいものを1つ選んでください。学習用オリジナル問題です。</p>','<p class="muted">基本問題と公式過去問を収録。原問が「誤っているもの」を問う場合もあるため、設問の条件を確認して番号を選んでください。</p>')
s=s.replace('<h3 id="question"></h3><div id="options">','<h3 id="question"></h3><div id="v16QuizContext"></div><div id="options">')
s=s.replace('<h3 id="fiveQuestion"></h3><div id="fiveOptions">','<h3 id="fiveQuestion"></h3><div id="v16FiveContext"></div><div id="fiveOptions">')
s=s.replace('<label for="topic">出題範囲</label>','<label for="v16OxSource">問題の種類</label><select id="v16OxSource" onchange="startQuiz(false)"><option value="">全問題（2,000問）</option><option value="basic">基本確認（305問）</option><option value="past">過去問の肢別（1,695問）</option></select><label for="topic">出題範囲</label>')
s=s.replace('<p id="fiveCount" class="muted">','<label for="v16FiveSource">問題の種類</label><select id="v16FiveSource" onchange="startFive()"><option value="">全問題（385問）</option><option value="basic">基本問題（36問）</option><option value="past">公式過去問（349問）</option></select><p id="fiveCount" class="muted">')
css='''<style>#question,#fiveQuestion{white-space:pre-wrap;overflow-wrap:anywhere}#feedback,#fiveFeedback{white-space:pre-line}.v16-context-text{font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;background:#f3f7fc;padding:12px;border-radius:10px}.v16-study-case{border-top:1px solid #d7e1ec;padding:9px 0}.v16-study-case p{line-height:1.85}.v16-proposition{padding:12px;background:#f3f7fc;border-radius:8px}.v16-study-case button{margin:5px 0}#v16QuizContext:empty,#v16FiveContext:empty{display:none}#v14libraryContent ol{line-height:1.9}</style>'''
s=s.replace('</body>',css+'<script>\n'+js+'\n</script></body>')
(R/'index.html').write_text(s)
# The published v1.5 backup remains unchanged.
print('Built',len(s.encode()),'bytes')
