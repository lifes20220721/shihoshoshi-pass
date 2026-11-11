/* 司法書士PASS — js/library.js. See README.md for load order and data editing. */

/* v1.4 content layer: never modifies stored progress or old question IDs. */
const v14Notes=window.SHIHOPASS_DATA.v14Notes;
const v14Names=window.SHIHOPASS_DATA.v14Names;
const v14Escape=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const v14Diagram=steps=>'<div class="v14-diagram" role="img" aria-label="学習内容の流れ：'+v14Escape(steps.join('、'))+'">'+steps.map((s,i)=>(i?'<div class="v14-arrow" aria-hidden="true">↓</div>':'')+'<div class="v14-node">'+v14Escape(s)+'</div>').join('')+'</div>';
const v14OriginalShow=show;show=function(id){if(id==='v14library'){for(const el of document.querySelectorAll('main > section.panel[id]'))el.classList.toggle('hidden',el.id!==id);renderStats();window.scrollTo(0,0)}else {document.getElementById('v14library').classList.add('hidden');v14OriginalShow(id)}};
function v14OpenLibrary(){show('v14library');v14Subjects()}
function v14Subjects(){const root=document.getElementById('v14libraryContent');root.innerHTML='<p class="muted">11科目から選択してください。各科目の分野別テキスト・図解・確認問題に進めます。</p>';v11Subjects.forEach(sub=>{const b=document.createElement('button');b.className='v14-subject';b.textContent='📘 '+sub.name+'　（'+sub.topics.length+'分野）';b.onclick=()=>v14Topics(sub.id);root.appendChild(b)})}
function v14Topics(subject){const sub=v11Subjects.find(x=>x.id===subject),root=document.getElementById('v14libraryContent');root.innerHTML='<p class="v14-breadcrumb">全科目 › '+v14Escape(sub.name)+'</p><p class="muted">読みたい分野を選んでください。</p>';sub.topics.forEach(t=>{const note=v14Notes[t];if(!note)return;const b=document.createElement('button');b.className='v14-subject';b.textContent='📄 '+note[0];b.onclick=()=>v14Topic(subject,t);root.appendChild(b)});const back=document.createElement('button');back.textContent='← 科目一覧へ';back.onclick=v14Subjects;root.appendChild(back)}
function v14Topic(subject,t){const sub=v11Subjects.find(x=>x.id===subject),n=v14Notes[t],root=document.getElementById('v14libraryContent'),ch=chapters.find(c=>c.id===t);if(!n)return;root.innerHTML='<p class="v14-breadcrumb">全科目 › '+v14Escape(sub.name)+' › '+v14Escape(n[0])+'</p><h3>'+v14Escape(n[0])+'</h3><h3>まず理解する</h3><div class="v14-detail">'+v14Escape(n[1])+'</div><h3>図で整理する</h3>'+v14Diagram(n[4])+'<h3>具体例</h3><div class="v14-detail">'+v14Escape(n[2])+'</div><h3>試験で間違えやすい点</h3><div class="v14-note">'+v14Escape(n[3])+'</div>'+(ch?'<h3>基本テキスト（既存教材）</h3>'+ch.body.map(p=>'<p>'+v14Escape(typeof p==='string'?p:JSON.stringify(p))+'</p>').join(''):'')+v15AmendmentHtml(subject,t)+'<p class="muted">学習用の独自解説です。重要な条文・判例は最新の法令・公式資料で確認してください。</p>';const quiz=document.createElement('button');quiz.className='primary';quiz.textContent='この分野の○×問題を解く →';quiz.onclick=()=>{document.getElementById('topic').value=t;startQuiz(false)};root.appendChild(quiz);const back=document.createElement('button');back.textContent='← 分野一覧へ';back.onclick=()=>v14Topics(subject);root.appendChild(back);window.scrollTo(0,0)}
function v14Feedback(target,q){const n=v14Notes[q.t];if(!n)return;const fb=document.getElementById(target);if(!fb)return;const detail=document.createElement('details');detail.className='v14-explanation';const summary=document.createElement('summary');summary.textContent='📘 図解・深掘り解説を開く';detail.appendChild(summary);const intro=document.createElement('p');intro.textContent='基本の考え方：'+n[1];detail.appendChild(intro);const flow=document.createElement('div');flow.innerHTML=v14Diagram(n[4]);detail.appendChild(flow);const example=document.createElement('p');example.textContent='具体例：'+n[2];detail.appendChild(example);const caution=document.createElement('p');caution.textContent='ひっかけ注意：'+n[3];detail.appendChild(caution);const go=document.createElement('button');go.textContent='この分野のテキストを読む →';go.onclick=()=>{const sub=v11Subjects.find(s=>s.topics.includes(q.t));if(sub){show('v14library');v14Topic(sub.id,q.t)}};detail.appendChild(go);fb.appendChild(detail)}
const v14OldAnswer=answer;answer=function(i){const q=queue[pos];v14OldAnswer(i);if(q)v14Feedback('feedback',q)};
const v14OldFiveAnswer=answerFive;answerFive=function(i){const idx=fivePos;v14OldFiveAnswer(i);const t=v11FiveTopic[idx];if(t)v14Feedback('fiveFeedback',{t})};

/* v1.4.1: subject-specific five-choice uses a different answer handler. */
const v141OldSubjectFiveAnswer=v11AnswerFive;
v11AnswerFive=function(i,qIndex){
 const wasAnswered=fiveAnswered;
 v141OldSubjectFiveAnswer(i,qIndex);
 if(!wasAnswered && fiveAnswered){
   const topic=v11FiveTopic[qIndex];
   if(topic)v14Feedback('fiveFeedback',{t:topic});
 }
};

