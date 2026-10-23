/* Additive v1.6 content. Existing question order, IDs and storage key are kept. */
const v16Units=__UNITS__;
const v16AddedQuestions=__QUESTIONS__;
const v16PastMap=new Map(v15PastQuestions.map(q=>[q.id,q]));
const v16UnitMap=new Map(v16Units.map(u=>[u.id,u]));
const v16OldOxCount=questions.length,v16OldFiveCount=fiveQuestions.length;
for(const u of v16Units){
 const sub=v11Subjects.find(s=>s.id===u.subject);if(!sub)throw Error('Unknown subject');
 if(!sub.topics.includes(u.id))sub.topics.push(u.id);
 const body=[...u.body,'【具体例】'+u.example,'【間違えやすい点】'+u.pitfall];
 const ch=chapters.find(c=>c.id===u.id);if(ch){ch.title=u.title;ch.body=body;}else chapters.push({id:u.id,title:u.title,body});
 v14Notes[u.id]=[u.title,u.body.join('\n'),u.example,u.pitfall,u.steps];
 const select=document.getElementById('topic');if(![...select.options].some(o=>o.value===u.id))select.add(new Option(u.title,u.id));
 else [...select.options].find(o=>o.value===u.id).textContent=u.title;
}
questions.push(...v16AddedQuestions);
const v16FiveMeta=new Map();
for(const q of v15PastQuestions.filter(q=>q.kind==='択一式'&&q.answer!==null).sort((a,b)=>a.year-b.year||(a.part==='午後')-(b.part==='午後')||a.number-b.number)){
 const candidates=v16AddedQuestions.filter(x=>x.origin===q.id);const counts={};for(const x of candidates)counts[x.t]=(counts[x.t]||0)+1;
 const subjectId=Object.entries(v14Names).find(([id,name])=>name===q.subject||id==='company'&&q.subject==='会社法・商法')?.[0];
 const topic=Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]||v16Units.find(u=>u.subject===subjectId)?.id;
 if(!topic)throw Error('No topic for '+q.id);
 const index=fiveQuestions.length;
 fiveQuestions.push({q:`【${q.year}年度 ${q.part} 第${q.number}問】\n${q.text}`,opts:['１番','２番','３番','４番','５番'],a:q.answer-1,why:q.explanation.summary+'\n'+Object.entries(q.explanation.statements).map(([k,v])=>`${k}：${v}`).join('\n')});
 v11FiveTopic.push(topic);v16FiveMeta.set(index,q.id);
}
if(questions.length!==2000||fiveQuestions.length!==385)throw Error('Question count mismatch');
const v16MetaByOxId=new Map(v16AddedQuestions.map(q=>[q.id,q]));
function v16QuestionSource(q){return q?.kind==='past'?'past':'basic';}
function v16FilterOx(list){const value=document.getElementById('v16OxSource').value;return list.filter(q=>!value||v16QuestionSource(q)===value);}
function v16FilterFive(list){const value=document.getElementById('v16FiveSource').value;return list.filter(i=>!value||(v16FiveMeta.has(i)?'past':'basic')===value);}
const v16OldStartQuiz=startQuiz;
startQuiz=function(onlyWrong){v16OldStartQuiz(onlyWrong);queue=v16FilterOx(queue);pos=0;renderQuestion();};
startFive=function(){v11FiveQueue=v16FilterFive(fiveQuestions.map((q,i)=>i));v11FiveIndex=0;v11RenderFive();};
v11StartTopicFive=function(){v11FiveQueue=v16FilterFive(fiveQuestions.map((q,i)=>i).filter(i=>v11FiveTopic[i]===v11Topic.id));v11FiveIndex=0;v11RenderFive();};
function v16GoOrigin(id){const q=v16PastMap.get(id);if(!q)return;v15OpenPastExam();document.getElementById('v15Year').value=String(q.year);document.getElementById('v15Kind').value='択一式';document.getElementById('v15Part').value=q.part;document.getElementById('v15Subject').value=q.subject;v15PastFilter();const i=v15PastList.findIndex(x=>x.id===id);document.getElementById('v15QuestionSelect').selectedIndex=i;v15PastRender();v15RevealPast();}
function v16AddOriginLinks(parent,q){v15Link(parent,`past-exams/${q.pdf}#page=${q.page}`,'📄 原本PDF・図表を確認');const button=v15El('button','原問と全肢解説を読む');button.onclick=()=>v16GoOrigin(q.id);parent.appendChild(button);}
function v16Context(parent,q,context){
 parent.replaceChildren();parent.appendChild(v15El('p',`出題当時の法令基準日：${q.basis}。現在の制度との違いは解説の法改正注釈を確認してください。`,'warning'));
 if(context){const details=v15El('details');details.open=true;details.appendChild(v15El('summary','原問の共通設定・対話の質問'));details.appendChild(v15El('pre',context,'v16-context-text'));parent.appendChild(details);}
 v16AddOriginLinks(parent,q);
}
const v16OldRenderQuestion=renderQuestion;
renderQuestion=function(){v16OldRenderQuestion();const root=document.getElementById('v16QuizContext');root.replaceChildren();const q=queue[pos];if(q?.kind==='past')v16Context(root,v16PastMap.get(q.origin),q.context);};
const v16OldRenderFive=v11RenderFive;
v11RenderFive=function(){v16OldRenderFive();const root=document.getElementById('v16FiveContext');root.replaceChildren();const origin=v16FiveMeta.get(v11FiveQueue[v11FiveIndex]);if(origin)v16Context(root,v16PastMap.get(origin));};
function v16AnswerAppend(target,topic,origin){const box=document.getElementById(target),q=origin?v16PastMap.get(origin):null,u=v16UnitMap.get(topic);if(q){v15Sources(box,q.explanation.sources||[]);v15LawNote(box,q.law_note);}else if(u){v15Sources(box,u.sources);}if(u){const b=v15El('button','📖 この分野のテキストで復習');b.onclick=()=>{show('v14library');v14Topic(u.subject,u.id);};box.appendChild(b);}}
const v16OldAnswer=answer;
answer=function(i){if(answered)return;const wasAnswered=answered,q=queue[pos];v16OldAnswer(i);if(!wasAnswered&&answered&&q)v16AnswerAppend('feedback',q.t,q.origin);};
const v16OldAnswerFive=v11AnswerFive;
v11AnswerFive=function(i,index){if(fiveAnswered)return;const wasAnswered=fiveAnswered;v16OldAnswerFive(i,index);if(!wasAnswered&&fiveAnswered)v16AnswerAppend('fiveFeedback',v11FiveTopic[index],v16FiveMeta.get(index));};
function v16StartUnit(topic,kind='all'){document.getElementById('topic').value=topic;document.getElementById('v16OxSource').value=kind==='all'?'':kind;startQuiz(false);}
v14Topic=function(subject,topic){
 const u=v16UnitMap.get(topic),sub=v11Subjects.find(s=>s.id===subject);if(!u||!sub)return;
 const root=document.getElementById('v14libraryContent');root.replaceChildren();
 root.appendChild(v15El('p',`${sub.name} › ${u.title}`,'v14-breadcrumb'));root.appendChild(v15El('h3',u.title));
 root.appendChild(v15El('p',`基本テキストの法令確認日：${u.basis}。過去問の判断理由は各年度の基準日で表示します。`,'muted'));
 root.appendChild(v15El('h3','基本の仕組み'));for(const p of u.body)root.appendChild(v15El('p',p));
 root.appendChild(v15El('h3','判断する順序'));const list=v15El('ol');for(const p of u.steps)list.appendChild(v15El('li',p));root.appendChild(list);
 root.appendChild(v15El('h3','具体例'));root.appendChild(v15El('p',u.example,'v14-detail'));
 root.appendChild(v15El('h3','間違えやすい点'));root.appendChild(v15El('p',u.pitfall,'v14-note'));
 const actions=v15El('div',undefined,'actions');const all=v15El('button',`この分野を演習（${questions.filter(q=>q.t===topic).length}問）`);all.className='primary';all.onclick=()=>v16StartUnit(topic);actions.appendChild(all);
 const basic=v15El('button','基本確認問題');basic.onclick=()=>v16StartUnit(topic,'basic');actions.appendChild(basic);
 const pastCount=v16AddedQuestions.filter(q=>q.t===topic&&q.kind==='past').length;if(pastCount){const past=v15El('button',`過去問の肢別演習（${pastCount}肢）`);past.onclick=()=>v16StartUnit(topic,'past');actions.appendChild(past);}root.appendChild(actions);
 v15Sources(root,u.sources);
 const amendment=v15El('div');amendment.innerHTML=v15AmendmentHtml(subject,topic);root.appendChild(amendment);
 const points=v16AddedQuestions.filter(q=>q.t===topic&&q.kind==='past');
 if(points.length){root.appendChild(v15El('h3',`過去５年で出題された判断理由（${points.length}肢）`));root.appendChild(v15El('p','原問の設定・基準日を確認し、記述と判断理由を対応させて読んでください。','muted'));const groups=new Map();for(const p of points){if(!groups.has(p.origin))groups.set(p.origin,[]);groups.get(p.origin).push(p);}for(const [id,items]of [...groups].sort((a,b)=>b[0].localeCompare(a[0]))){const origin=v16PastMap.get(id),details=v15El('details',undefined,'v16-study-case');details.appendChild(v15El('summary',`${origin.year}年度 ${origin.part} 第${origin.number}問｜${items.map(p=>p.label).join('・')}`));details.appendChild(v15El('p',`法令基準日：${origin.basis}`,'muted'));for(const p of items){if(p.context){const context=v15El('details');context.appendChild(v15El('summary',`【${p.label}】の共通設定・対話を確認`));context.appendChild(v15El('pre',p.context,'v16-context-text'));details.appendChild(context);}details.appendChild(v15El('p',`【${p.label}】${p.statement}`,'v16-proposition'));details.appendChild(v15El('p',p.why));}v16AddOriginLinks(details,origin);v15LawNote(details,origin.law_note);root.appendChild(details);}}
 const back=v15El('button','← 分野一覧へ');back.onclick=()=>v14Topics(subject);root.appendChild(back);window.scrollTo(0,0);
};
const v16BaseAmendments=v15AmendmentHtml;
v15AmendmentHtml=function(subject,topic){const ids={cv_ownership:['condominium'],cv_family:['family'],cv_succession:['estate','inheritance'],cv_wills:['guardianship','legacy'],cv_mortgage:['security'],re_inheritance:['inheritance','legacy'],re_evidence:['address','search'],re_ownership:['address'],re_use:['condominium'],cr_incorporation:['holiday'],cr_officers:['representative'],cl_public:['custodial','sex']};if(subject==='civilprocedure')return v16BaseAmendments(subject,'civilprocedure');if(!ids[topic])return v16BaseAmendments(subject,topic);return '<div class="v15-amendments"><h3>⚖ 法改正の注釈</h3>'+v15LawAmendments.filter(n=>ids[topic].includes(n.id)).map(n=>'<div class="v15-amendment"><small>'+v14Escape(n.status+'｜'+n.date)+'</small><strong>'+v14Escape(n.title)+'</strong><p>'+v14Escape(n.text)+'</p><a href="'+v14Escape(n.url)+'" target="_blank" rel="noopener noreferrer">法務省の資料</a></div>').join('')+'</div>';};
/* Legacy text screen now links to every enriched unit. */
const v16Lessons=document.getElementById('lessonList');v16Lessons.replaceChildren();for(const u of v16Units){const section=v15El('section',undefined,'lesson');section.appendChild(v15El('h3',u.title));section.appendChild(v15El('p',u.body[0]));const button=v15El('button','テキスト・出題例を読む');button.onclick=()=>{show('v14library');v14Topic(u.subject,u.id);};section.appendChild(button);v16Lessons.appendChild(section);}
