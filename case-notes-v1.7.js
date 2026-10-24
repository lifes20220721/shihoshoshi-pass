/* Additive case-note navigation. Never writes study history. */
const v17CaseData=__CASE_DATA__;
const v17Cases=v17CaseData.cases;
const v17CaseMap=new Map(v17Cases.map(c=>[c.id,c]));
let v17TopicFilter='',v17BackPage='home';
const v17PreviousShow=show;
show=function(id){v17PreviousShow(id);document.getElementById('casebook').classList.toggle('hidden',id!=='casebook');if(id!=='casebook'&&window.location?.hash.startsWith('#case=')){window.history?.replaceState(null,'',window.location.pathname+window.location.search);}};
function v17CurrentPage(){return ['casebook','home','v14library','pastExam','lawAmendments','quiz','choice5','lessons','dashboard','v13view'].find(id=>{const el=document.getElementById(id);return el&&!el.classList.contains('hidden');})||'home';}
function v17Group(c){return v17CaseData.groups[c.group];}
function v17Frequency(c){const g=v17Group(c);return `関連論点：${g.years.length}/5年度・${g.question_count}問（${g.years.join('・')}年度）`;}
function v17Anchor(parent,c){const a=v15El('a',`${c.title}｜${c.source.date}`,'v17-case-link');a.href='#case='+encodeURIComponent(c.id);a.onclick=e=>{e.preventDefault();v17OpenCase(c.id);};parent.appendChild(a);}
function v17MatchesOrigin(id){return v17Cases.filter(c=>v17Group(c).related_questions.includes(id));}
function v17AddLinks(parent,cases){if(!cases.length)return;const details=v15El('details',undefined,'v17-related');details.appendChild(v15El('summary',`⚖ 関連論点の判例・解釈を読む（${cases.length}件）`));details.appendChild(v15El('p','原問と関連する論点の学習ノートです。この判例そのものが各問で直接出題されたという表示ではありません。','muted'));for(const c of cases)v17Anchor(details,c);parent.appendChild(details);}
function v17OpenCasebook(subject='',topic=''){
 if(v17CurrentPage()!=='casebook')v17BackPage=v17CurrentPage();
 v17TopicFilter=topic;document.getElementById('v17CaseSubject').value=subject;document.getElementById('v17CaseSearch').value='';document.getElementById('v17CaseFrequency').value='2';
 show('casebook');v17RenderCaseList();
}
function v17RenderCaseList(){
 const results=document.getElementById('v17CaseResults');results.replaceChildren();
 document.getElementById('v17CaseFilters').classList.remove('hidden');document.getElementById('v17CaseDetail').classList.add('hidden');results.classList.remove('hidden');
 const subject=document.getElementById('v17CaseSubject').value,needle=document.getElementById('v17CaseSearch').value.trim().toLocaleLowerCase(),minimum=Number(document.getElementById('v17CaseFrequency').value||0);
 const found=v17Cases.filter(c=>(!subject||c.subjects.includes(subject))&&(!v17TopicFilter||c.topics.includes(v17TopicFilter))&&v17Group(c).years.length>=minimum&&JSON.stringify([c.title,c.source,c.holding,c.interpretation,c.pitfall,v17Group(c).title]).toLocaleLowerCase().includes(needle)).sort((a,b)=>v17Group(b).years.length-v17Group(a).years.length||v17Group(b).question_count-v17Group(a).question_count||a.id.localeCompare(b.id));
 document.getElementById('v17CaseCount').textContent=`${found.length}件 / ${v17Cases.length}件。関連論点の出題年度数が多い順。`;
 const scope=document.getElementById('v17CaseScope');scope.replaceChildren();if(v17TopicFilter){scope.appendChild(v15El('span',`テキスト分野：${v16UnitMap.get(v17TopicFilter)?.title||v17TopicFilter}`,'tag'));const clear=v15El('button','分野の絞り込みを解除');clear.onclick=()=>{v17TopicFilter='';v17RenderCaseList();};scope.appendChild(clear);}
 if(!found.length){results.appendChild(v15El('p','条件に一致する判例ノートはありません。科目や検索語を変更してください。'));return;}
 for(const c of found){const card=v15El('article',undefined,'v17-case-card');card.appendChild(v15El('p',v17Group(c).title,'tag'));v17Anchor(card,c);card.appendChild(v15El('p',v17Frequency(c),'muted'));card.appendChild(v15El('p',c.holding));results.appendChild(card);}
}
function v17OpenCase(id){
 const c=v17CaseMap.get(id);if(!c)return false;
 const current=v17CurrentPage();if(current!=='casebook')v17BackPage=current;
 show('casebook');document.getElementById('v17CaseFilters').classList.add('hidden');document.getElementById('v17CaseResults').classList.add('hidden');
 const root=document.getElementById('v17CaseDetail');root.classList.remove('hidden');root.replaceChildren();
 root.appendChild(v15El('p',v17Group(c).title,'tag'));root.appendChild(v15El('h3',c.title));
 root.appendChild(v15El('p',`${c.source.court} ${c.source.date}${c.source.type}｜${c.source.case_number}`,'muted'));root.appendChild(v15El('p',v17Frequency(c),'muted'));
 root.appendChild(v15El('p','表示する頻度は関連論点を含む問題の集計です。判例自体の出題回数ではありません。要旨・解釈は本アプリの学習用のまとめです。','muted'));
 for(const [title,text]of [['事案の概要',c.facts],['争点',c.issue],['判例の結論（要約）',c.holding],['理由と解釈・判例の射程',c.interpretation],['具体例で理解する',c.example],['試験での見分け方',c.pitfall]]){root.appendChild(v15El('h3',title));root.appendChild(v15El('p',text,title==='試験での見分け方'?'v14-note':undefined));}
 const order=v15El('ol');for(const step of c.steps)order.appendChild(v15El('li',step));root.appendChild(order);
 root.appendChild(v15El('h3','現行法・改正との関係'));root.appendChild(v15El('p',c.current_law_note,'warning'));
 for(const id of c.amendments){const n=v15LawAmendments.find(a=>a.id===id);if(n){root.appendChild(v15El('p',`${n.title}｜${n.status}｜${n.date}\n${n.text}`));v15Link(root,n.url,'法改正の公式資料');}}
 root.appendChild(v15El('h3','根拠資料'));v15Link(root,c.source.url,'裁判所の判例ページ・判決原文へ');
 const urls=[...new Set(c.topics.flatMap(t=>v16UnitMap.get(t)?.sources||[]))];for(const url of urls)v15Link(root,url,'関連する現行法令');
 root.appendChild(v15El('p',`資料確認日：${c.reviewed_date}。判決ページの参照条文が旧法の番号である場合は、現行法の番号と区別してください。`,'muted'));
 root.appendChild(v15El('h3','関連する過去問へ'));
 for(const id of [...v17Group(c).related_questions].reverse()){const q=v16PastMap.get(id);if(!q)continue;const b=v15El('button',`${q.year}年度 ${q.part} 第${q.number}問｜${q.subject}`);b.onclick=()=>v16GoOrigin(q.id);root.appendChild(b);}
 root.appendChild(v15El('h3','関連テキストへ'));
 for(const id of c.topics){const u=v16UnitMap.get(id);if(!u)continue;const b=v15El('button',u.title);b.onclick=()=>{show('v14library');v14Topic(u.subject,u.id);};root.appendChild(b);}
 const nav=v15El('div',undefined,'actions'),back=v15El('button','← 元の学習画面へ'),list=v15El('button','判例一覧へ');back.onclick=()=>show(v17BackPage);list.onclick=()=>{window.history?.replaceState(null,'',window.location.pathname+window.location.search);v17RenderCaseList();};nav.append(back,list);root.appendChild(nav);
 if(window.history&&window.location)window.history.replaceState(null,'',window.location.pathname+window.location.search+'#case='+encodeURIComponent(c.id));
 window.scrollTo(0,0);return true;
}
const v17PreviousTopic=v14Topic;
v14Topic=function(subject,topic){v17PreviousTopic(subject,topic);const root=document.getElementById('v14libraryContent');v17AddLinks(root,v17Cases.filter(c=>c.topics.includes(topic)));};
const v17PreviousPastRender=v15PastRender;
v15PastRender=function(){v17PreviousPastRender();const target=document.getElementById('v17PastCaseLinks');target.replaceChildren();const q=v15PastList[Number(document.getElementById('v15QuestionSelect').value)];if(q)v17AddLinks(target,v17MatchesOrigin(q.id));};
const v17PreviousAnswer=answer;
answer=function(i){const already=answered,q=queue[pos];v17PreviousAnswer(i);if(!already&&answered&&q)v17AddLinks(document.getElementById('feedback'),q.origin?v17MatchesOrigin(q.origin):v17Cases.filter(c=>c.topics.includes(q.t)));};
const v17PreviousAnswerFive=v11AnswerFive;
v11AnswerFive=function(i,index){const already=fiveAnswered;v17PreviousAnswerFive(i,index);if(!already&&fiveAnswered){const origin=v16FiveMeta.get(index);v17AddLinks(document.getElementById('fiveFeedback'),origin?v17MatchesOrigin(origin):v17Cases.filter(c=>c.topics.includes(v11FiveTopic[index])));}};
const v17Subjects=document.getElementById('v17CaseSubject');v17Subjects.add(new Option('全科目',''));for(const s of v11Subjects)v17Subjects.add(new Option(`${s.name}（${v17Cases.filter(c=>c.subjects.includes(s.id)).length}件）`,s.id));
function v17HandleCaseHash(){const hash=window.location?.hash||'';if(!hash.startsWith('#case='))return;try{const id=decodeURIComponent(hash.slice(6));if(!v17OpenCase(id)){v17OpenCasebook();document.getElementById('v17CaseCount').textContent='指定された判例が見つかりません。以下の一覧から選択してください。';}}catch{v17OpenCasebook();}}
window.addEventListener?.('hashchange',v17HandleCaseHash);v17HandleCaseHash();
