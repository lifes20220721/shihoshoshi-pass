/* 司法書士PASS — js/subjects.js. See README.md for load order and data editing. */

/* v1.1 extension: preserve the original shihoshoshi-pass-v03 storage key. */
const v11Subjects=window.SHIHOPASS_DATA.v11Subjects;
if(!Array.isArray(data.fiveAnswers))data.fiveAnswers=[];
if(!Array.isArray(data.fiveWrong))data.fiveWrong=[];
/* Existing 5-choice ordering is fixed in v1.0: 26 civil questions, then one per other subject. */
const v11FiveTopic=fiveQuestions.map((q,i)=>i<26?(i<5?['capacity','minor','guardianship','declaration','declaration'][i]:i<20?['capacity','minor','guardianship','declaration','declaration'][Math.floor((i-5)/3)]:i<23?'agency':'prescription'):v11Subjects[i-25]?.topics[0]||'civil');
let v11Subject=null,v11Topic=null,v11FiveQueue=[],v11FiveIndex=0;
const v11AllIds=(topics)=>[...questions.filter(q=>topics.includes(q.t)).map(q=>q.id),...fiveQuestions.map((q,i)=>topics.includes(v11FiveTopic[i])?'f5-'+i:null).filter(Boolean)];
function v11Metrics(topics){
 const ids=v11AllIds(topics),answered=new Set([...data.answers.map(x=>x.id),...data.fiveAnswers.map(x=>x.id)]),seen=ids.filter(id=>answered.has(id)).length;
 const all=[...data.answers,...data.fiveAnswers].filter(a=>ids.includes(a.id)),right=all.filter(a=>a.correct).length;
 const wrong=[...data.wrong,...data.fiveWrong].filter(id=>ids.includes(id)).length;
 return {ids,total:ids.length,seen,rate:all.length?Math.round(100*right/all.length):0,wrong,pct:ids.length?Math.round(100*seen/ids.length):0};
}
function v11Esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function v11Stats(m){return `<div class="v11-bar"><span style="width:${m.pct}%"></span></div><div class="v11-grid"><div class="v11-stat">学習済み<br><b>${m.seen} / ${m.total}</b>問</div><div class="v11-stat">進捗率<br><b>${m.pct}%</b></div><div class="v11-stat">正答率（延べ回答）<br><b>${m.rate}%</b></div><div class="v11-stat">復習対象<br><b>${m.wrong}</b>問</div></div>`;}
function openDashboard(){v11Subject=null;v11Topic=null;v11Render();}
function v11PickSubject(id){v11Subject=v11Subjects.find(s=>s.id===id);v11Topic=null;v11Render();}
function v11PickTopic(id){v11Topic=chapters.find(c=>c.id===id);v11Render();}
function v11Back(){if(v11Topic)v11Topic=null;else v11Subject=null;v11Render();}
function v11Render(){
 show('dashboard');const h=document.getElementById('v11heading'),crumb=document.getElementById('v11crumb'),out=document.getElementById('v11content');
 document.getElementById('v11back').disabled=!v11Subject;
 if(!v11Subject){h.textContent='全11科目の学習進捗';crumb.textContent='全体 → 科目を選択';out.innerHTML=v11Stats(v11Metrics(v11Subjects.flatMap(s=>s.topics)))+'<h3>科目を選ぶ</h3>'+v11Subjects.map(s=>{let m=v11Metrics(s.topics);return `<button class="v11-card" onclick="v11PickSubject('${s.id}')"><strong>${v11Esc(s.name)} →</strong>学習済み ${m.seen}/${m.total}問・進捗 ${m.pct}%・復習 ${m.wrong}問<div class="v11-bar"><span style="width:${m.pct}%"></span></div></button>`}).join('');return;}
 if(!v11Topic){h.textContent=v11Subject.name;crumb.textContent='全体 → '+v11Subject.name+' → 分野を選択';out.innerHTML=v11Stats(v11Metrics(v11Subject.topics))+'<h3>分野を選ぶ</h3>'+v11Subject.topics.map(id=>{let ch=chapters.find(c=>c.id===id);if(!ch)return '';let m=v11Metrics([id]);return `<button class="v11-card" onclick="v11PickTopic('${id}')"><strong>${v11Esc(ch.title)} →</strong>学習済み ${m.seen}/${m.total}問・進捗 ${m.pct}%・復習 ${m.wrong}問<div class="v11-bar"><span style="width:${m.pct}%"></span></div></button>`}).join('');return;}
 h.textContent=v11Topic.title;crumb.textContent='全体 → '+v11Subject.name+' → '+v11Topic.title;
 const m=v11Metrics([v11Topic.id]);out.innerHTML=v11Stats(m)+'<div class="actions"><button class="primary" onclick="v11StartTopicQuiz()">○×問題を解く</button><button onclick="v11StartTopicFive()">5肢択一を解く</button></div><h3>分野別テキスト</h3>'+v11Topic.body.map(t=>`<p class="v11-text">${v11Esc(t)}</p>`).join('')+'<p class="v11-note">入門教材です。内容の正確性・最新法令への適合は別途確認してください。</p>';
}
function v11StartTopicQuiz(){document.getElementById('topic').value=v11Topic.id;startQuiz(false);}
function v11StartTopicFive(){v11FiveQueue=fiveQuestions.map((q,i)=>i).filter(i=>v11FiveTopic[i]===v11Topic.id);v11FiveIndex=0;v11RenderFive();}
function v11RenderFive(){show('choice5');const qIndex=v11FiveQueue[v11FiveIndex],q=fiveQuestions[qIndex],opts=document.getElementById('fiveOptions');fiveAnswered=false;document.getElementById('fiveFeedback').textContent='';document.getElementById('fiveNext').classList.add('hidden');if(!q){document.getElementById('fiveCount').textContent='';document.getElementById('fiveQuestion').textContent='この分野には5肢択一問題がありません。';opts.innerHTML='';return;}document.getElementById('fiveCount').textContent=`${v11FiveIndex+1} / ${v11FiveQueue.length}問（分野別）`;document.getElementById('fiveQuestion').textContent=q.q;opts.innerHTML='';q.opts.forEach((o,i)=>{let b=document.createElement('button');b.className='option';b.textContent=`${i+1}. ${o}`;b.onclick=()=>v11AnswerFive(i,qIndex);opts.appendChild(b);});}
function v11AnswerFive(i,qIndex){if(fiveAnswered)return;fiveAnswered=true;const q=fiveQuestions[qIndex],ok=i===q.a,id='f5-'+qIndex;data.fiveAnswers.push({id,correct:ok,time:new Date().toISOString()});if(ok)data.fiveWrong=data.fiveWrong.filter(x=>x!==id);else if(!data.fiveWrong.includes(id))data.fiveWrong.push(id);save();Array.from(document.getElementById('fiveOptions').children).forEach((b,j)=>{b.disabled=true;if(j===q.a)b.classList.add('correct');else if(j===i)b.classList.add('wrong');});document.getElementById('fiveFeedback').textContent=(ok?'正解！ ':'不正解。 ')+q.why;document.getElementById('fiveNext').textContent=v11FiveIndex===v11FiveQueue.length-1?'終了する':'次の問題 →';document.getElementById('fiveNext').classList.remove('hidden');}
/* All-subject 5-choice mode also stores answers. */
startFive=function(){v11FiveQueue=fiveQuestions.map((_,i)=>i);v11FiveIndex=0;v11RenderFive();};
nextFive=function(){v11FiveIndex++;if(v11FiveIndex>=v11FiveQueue.length){if(v11Subject&&v11Topic)v11Render();else show('home');}else v11RenderFive();};
answerFive=function(i){const qIndex=v11FiveQueue[v11FiveIndex];if(qIndex!==undefined)v11AnswerFive(i,qIndex);};
/* Keep the existing reset confirmation and original history format intact. */

/* Ver.1.3: separate statistics, retain existing shihoshoshi-pass-v03 storage. */
function v12Summary(entries,wrong){
 const n=entries.length,correct=entries.filter(a=>a.correct).length;
 return {n,correct,rate:n?Math.round(100*correct/n):0,wrong:wrong.length};
}
function v12StatsBlock(title,s){
 return `<div class="v12-stat-block"><h3>${title}</h3><div class="v12-stat-row"><span>累計解答 <b>${s.n}</b>問</span><span>正答率 <b>${s.rate}%</b></span><span>復習対象 <b>${s.wrong}</b>問</span></div><progress max="100" value="${s.rate}"></progress></div>`;
}
renderStats=function(){
 const ox=v12Summary(data.answers,data.wrong),five=v12Summary(data.fiveAnswers,data.fiveWrong);
 document.getElementById('stats').innerHTML=v12StatsBlock('○×問題',ox)+v12StatsBlock('5肢択一',five);
};
/* The dashboard also shows both formats independently within the selected topics. */
v11Stats=function(m){
 const ids=new Set(m.ids||[]);
 const ox=v12Summary(data.answers.filter(a=>ids.has(a.id)),data.wrong.filter(id=>ids.has(id)));
 const five=v12Summary(data.fiveAnswers.filter(a=>ids.has(a.id)),data.fiveWrong.filter(id=>ids.has(id)));
 return `<div class="v11-bar"><span style="width:${m.pct}%"></span></div><div class="v11-grid"><div class="v11-stat">学習済み<br><b>${m.seen} / ${m.total}</b>問</div><div class="v11-stat">進捗率<br><b>${m.pct}%</b></div></div>`+v12StatsBlock('○×問題',ox)+v12StatsBlock('5肢択一',five);
};
/* Reset must clear both modes only after explicit confirmation. */
resetData=function(){
 if(confirm('○×問題と5肢択一の学習履歴をすべて削除しますか？')){
  data={answers:[],wrong:[],fiveAnswers:[],fiveWrong:[]};save();show('home');
 }
};
renderStats();

/* Ver.1.3 additive study content: IDs appended only, never alter existing records. */
{const ch=chapters.find(c=>c.id==="realestate");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_1);}
questions.push(window.SHIHOPASS_DATA.subjects_2);
questions.push(window.SHIHOPASS_DATA.subjects_3);
questions.push(window.SHIHOPASS_DATA.subjects_4);
{const ch=chapters.find(c=>c.id==="company");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_5);}
questions.push(window.SHIHOPASS_DATA.subjects_6);
questions.push(window.SHIHOPASS_DATA.subjects_7);
questions.push(window.SHIHOPASS_DATA.subjects_8);
{const ch=chapters.find(c=>c.id==="commercialreg");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_9);}
questions.push(window.SHIHOPASS_DATA.subjects_10);
questions.push(window.SHIHOPASS_DATA.subjects_11);
questions.push(window.SHIHOPASS_DATA.subjects_12);
{const ch=chapters.find(c=>c.id==="civilprocedure");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_13);}
questions.push(window.SHIHOPASS_DATA.subjects_14);
questions.push(window.SHIHOPASS_DATA.subjects_15);
questions.push(window.SHIHOPASS_DATA.subjects_16);
{const ch=chapters.find(c=>c.id==="execution");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_17);}
questions.push(window.SHIHOPASS_DATA.subjects_18);
questions.push(window.SHIHOPASS_DATA.subjects_19);
questions.push(window.SHIHOPASS_DATA.subjects_20);
{const ch=chapters.find(c=>c.id==="preservation");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_21);}
questions.push(window.SHIHOPASS_DATA.subjects_22);
questions.push(window.SHIHOPASS_DATA.subjects_23);
questions.push(window.SHIHOPASS_DATA.subjects_24);
{const ch=chapters.find(c=>c.id==="constitution");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_25);}
questions.push(window.SHIHOPASS_DATA.subjects_26);
questions.push(window.SHIHOPASS_DATA.subjects_27);
questions.push(window.SHIHOPASS_DATA.subjects_28);
{const ch=chapters.find(c=>c.id==="criminal");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_29);}
questions.push(window.SHIHOPASS_DATA.subjects_30);
questions.push(window.SHIHOPASS_DATA.subjects_31);
questions.push(window.SHIHOPASS_DATA.subjects_32);
{const ch=chapters.find(c=>c.id==="deposit");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_33);}
questions.push(window.SHIHOPASS_DATA.subjects_34);
questions.push(window.SHIHOPASS_DATA.subjects_35);
questions.push(window.SHIHOPASS_DATA.subjects_36);
{const ch=chapters.find(c=>c.id==="scrivener");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_37);}
questions.push(window.SHIHOPASS_DATA.subjects_38);
questions.push(window.SHIHOPASS_DATA.subjects_39);
questions.push(window.SHIHOPASS_DATA.subjects_40);
{const ch=chapters.find(c=>c.id==="capacity");if(ch)ch.body.push(...window.SHIHOPASS_DATA.subjects_41);}
questions.push(window.SHIHOPASS_DATA.subjects_42);
questions.push(window.SHIHOPASS_DATA.subjects_43);
questions.push(window.SHIHOPASS_DATA.subjects_44);

/* Keep v03 untouched except on actual answers; separate settings and exam results. */

