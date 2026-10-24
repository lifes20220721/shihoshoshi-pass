const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=__dirname+'/';
function boot(file){
const html=fs.readFileSync(file,'utf8');
class El{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.classes=new Set();this._text='';this._value=undefined;this._index=-1;this.classList={add:(...x)=>x.forEach(v=>this.classes.add(v)),remove:(...x)=>x.forEach(v=>this.classes.delete(v)),toggle:(x,b)=>{b??=!this.classes.has(x);b?this.classes.add(x):this.classes.delete(x);return b},contains:x=>this.classes.has(x)};}
 appendChild(x){this.children.push(x);if(this.tagName==='SELECT'&&this._index<0)this._index=0;return x}
 append(...x){x.forEach(i=>this.appendChild(i))} insertBefore(x,b){const i=this.children.indexOf(b);if(i<0)return this.appendChild(x);this.children.splice(i,0,x)}
 replaceChildren(...x){this.children=[];this._index=-1;this._text='';x.forEach(i=>this.appendChild(i))}add(x){this.appendChild(x)}
 set textContent(x){this._text=String(x);this.children=[]}get textContent(){return this._text+this.children.map(c=>c.textContent||'').join('')}
 set innerHTML(x){this._html=x;this._text=String(x).replace(/<[^>]+>/g,'');this.children=[]}get innerHTML(){return this._html||''}
 set className(x){this.classes=new Set(x.split(/\s+/))}get className(){return [...this.classes].join(' ')}
 get options(){return this.children}set selectedIndex(x){this._index=x;this._value=undefined}get selectedIndex(){return this._index}
 get value(){return this.tagName==='SELECT'?this.options[this._index]?.value||'':this._value||''}set value(x){if(this.tagName==='SELECT'){this._index=this.options.findIndex(o=>o.value===String(x))}else this._value=String(x)}
 querySelector(){return null}querySelectorAll(){return []}setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]}insertAdjacentHTML(){} addEventListener(){}
}
const ids={};for(const m of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new El(m[1]);el.id=m[2];if(m[0].includes('hidden'))el.classList.add('hidden');ids[el.id]=el;}
for(const [id,opts]of Object.entries({v15Kind:['','択一式','記述式'],v15Part:['','午前','午後'],topic:['all'],v16OxSource:['','basic','past'],v16FiveSource:['','basic','past'],v17CaseFrequency:['2','3','5','0']})){for(const text of opts){const o=new El('option');o.value=text;o.textContent=text;(ids[id]||(ids[id]=new El('select'))).add(o)}}
const historic={answers:[{id:'m1',correct:true,time:'2026-10-20T00:00:00.000Z'}],wrong:['m3'],fiveAnswers:[{id:'f5-2',correct:false,time:'2026-10-20T00:00:00.000Z'}],fiveWrong:['f5-2'],customPreserved:'keep'};
const storage=new Map([['shihoshoshi-pass-v03',JSON.stringify(historic)]]);const before=storage.get('shihoshoshi-pass-v03');let writes=0;
const document={getElementById:id=>ids[id]||(ids[id]=new El()),createElement:tag=>new El(tag),createTextNode:t=>{let e=new El();e.textContent=t;return e},querySelectorAll:s=>s.startsWith('main > section')?Object.values(ids).filter(e=>e.tagName==='SECTION'):[],querySelector:()=>new El(),body:new El('body'),head:new El('head')};
const ctx=vm.createContext({document,window:{scrollTo(){},location:{hash:'',pathname:'/shihoshoshi-pass/',search:''},history:{replaceState(a,b,path){this.lastPath=path;}},addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{storage.set(k,v);writes++},removeItem(){throw Error('storage deletion')}},Option:function(t,v){let e=new El('option');e.textContent=t;e.value=v;return e},console,Date,JSON,Set,Map,Math,Number,String,Array,Object,RegExp,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},alert(){throw Error('unexpected alert')},confirm(){throw Error('confirmation/reset not allowed')}});
for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],ctx);
vm.runInContext('v15OpenPastExam()',ctx);assert.equal(ids.v15QuestionSelect.options.length,72);assert(!ids.pastExam.classList.contains('hidden'));
let counts={mc:0,essay:0,notes:0};for(let year=2022;year<=2026;year++){ids.v15Year.value=year;vm.runInContext('v15PastFilter()',ctx);assert.equal(ids.v15QuestionSelect.options.length,72);for(let i=0;i<72;i++){ids.v15QuestionSelect.selectedIndex=i;vm.runInContext('v15PastRender();v15RevealPast()',ctx);const text=ids.v15PastAnswer.textContent;assert(text.length>180);assert.equal(ids.v15PdfLinks.children.length,i<70?2:1);if(i<70){counts.mc++;assert(text.includes('条文・判例に基づく解説'));}else{counts.essay++;assert(text.includes('公式解答ではありません'));}if(text.includes('⚖ 法改正・年度の注意'))counts.notes++;}}
ids.v15Year.value='2025';ids.v15Kind.value='択一式';ids.v15Part.value='午後';vm.runInContext('v15PastFilter()',ctx);assert.equal(ids.v15QuestionSelect.options.length,35);ids.v15QuestionSelect.selectedIndex=32;vm.runInContext('v15PastRender();v15RevealPast()',ctx);assert(ids.v15PastAnswer.textContent.includes('全員正解'));
ids.v15Kind.value='記述式';vm.runInContext('v15PastFilter()',ctx);assert.equal(ids.v15QuestionSelect.options.length,2);
vm.runInContext("v15OpenAmendments()",ctx);assert.equal(ids.v15AmendmentList.children.length,14);assert(ids.pastExam.classList.contains('hidden'));assert(!ids.lawAmendments.classList.contains('hidden'));
vm.runInContext("v14OpenLibrary()",ctx);assert(ids.lawAmendments.classList.contains('hidden'));vm.runInContext("show('home')",ctx);assert(ids.pastExam.classList.contains('hidden'));assert(ids.v14library.classList.contains('hidden'));
assert.equal(storage.get('shihoshoshi-pass-v03'),before);assert.equal(writes,0);
return {ctx,ids,storage,before,writes,counts};
}
const baseline=boot(root+'index-v15-backup-20261023.html');
const expanded=boot(root+'index.html');
const {ctx,ids,storage,before,writes,counts}=expanded;
const run=(code,c=ctx)=>vm.runInContext(code,c);
const plain=(code,c=ctx)=>JSON.parse(run('JSON.stringify('+code+')',c));
assert.deepStrictEqual(plain('questions.slice(0,183)'),plain('questions',baseline.ctx));
assert.deepStrictEqual(plain('fiveQuestions.slice(0,36)'),plain('fiveQuestions',baseline.ctx));
assert.deepStrictEqual(plain('v11FiveTopic.slice(0,36)'),plain('v11FiveTopic',baseline.ctx));
assert.deepStrictEqual(plain('v15PastQuestions'),plain('v15PastQuestions',baseline.ctx));
assert.equal(run('KEY'),'shihoshoshi-pass-v03');
assert.equal(run('questions.length'),2000);assert.equal(run('fiveQuestions.length'),385);
assert.equal(run('new Set(questions.map(q=>q.id)).size'),2000);
assert.equal(run('v11Subjects.length'),11);assert.equal(run('v11Subjects.flatMap(s=>s.topics).length'),61);
assert.equal(run('new Set(v11Subjects.flatMap(s=>s.topics)).size'),61);
for(const u of plain('v16Units')){run(`show('v14library');v14Topic(${JSON.stringify(u.subject)},${JSON.stringify(u.id)})`);assert(ids.v14libraryContent.textContent.includes(u.pitfall));assert(ids.v14libraryContent.textContent.includes(u.body[1]));assert.equal(run(`questions.filter(q=>q.t===${JSON.stringify(u.id)}&&q.kind==='basic').length`),2);}
for(const source of ['', 'basic','past']){
 ids.v16OxSource.value=source;ids.topic.value='all';run('startQuiz(false)');assert.equal(run('queue.length'),source==='basic'?305:source==='past'?1695:2000);
 ids.v16FiveSource.value=source;run('startFive()');assert.equal(run('v11FiveQueue.length'),source==='basic'?36:source==='past'?349:385);
}
for(const q of plain('v16AddedQuestions.filter(q=>q.kind==="past")')){
 const original=plain(`v16PastMap.get(${JSON.stringify(q.origin)})`);assert.equal(q.why,original.explanation.statements[q.label]);assert(q.why.startsWith(q.a===0?'正しい':'誤り'));assert(q.context.length>5);assert(q.statement.length>4);
}
run(`for(const [index,id]of v16FiveMeta){const original=v16PastMap.get(id);if(fiveQuestions[index].a!==original.answer-1)throw Error(id);}`);
assert.equal(run("[...v16FiveMeta.values()].some(id=>{const q=v16PastMap.get(id);return q.year===2025&&q.part==='午後'&&q.number===33})"),false);
for(const id of plain('[...v16FiveMeta.values()]')){run(`v16GoOrigin(${JSON.stringify(id)})`);assert.equal(run('v15PastList[document.getElementById("v15QuestionSelect").selectedIndex].id'),id);}
assert.equal(storage.get('shihoshoshi-pass-v03'),before);
// Answers use a private VM store; never touch the user's browser storage.
ids.v16OxSource.value='past';ids.topic.value='all';run('startQuiz(false)');assert(ids.v16QuizContext.textContent.includes('出題当時'));
const old=JSON.parse(before),oxId=run('queue[0].id');run('answer(1-queue[0].a)');const afterOx=JSON.parse(storage.get('shihoshoshi-pass-v03'));assert.equal(afterOx.answers.length,old.answers.length+1);assert.deepStrictEqual(afterOx.answers[0],old.answers[0]);assert(afterOx.wrong.includes(oxId));assert(afterOx.wrong.includes('m3'));assert.equal(afterOx.customPreserved,'keep');
const once=storage.get('shihoshoshi-pass-v03');run('answer(0)');assert.equal(storage.get('shihoshoshi-pass-v03'),once);
ids.v16FiveSource.value='past';run('startFive()');assert(ids.v16FiveContext.textContent.includes('出題当時'));const fiveId=run("'f5-'+v11FiveQueue[0]");run('v11AnswerFive(1-fiveQuestions[v11FiveQueue[0]].a,v11FiveQueue[0])');const afterFive=JSON.parse(storage.get('shihoshoshi-pass-v03'));assert.equal(afterFive.fiveAnswers.length,old.fiveAnswers.length+1);assert.deepStrictEqual(afterFive.fiveAnswers[0],old.fiveAnswers[0]);assert(afterFive.fiveWrong.includes(fiveId));assert(afterFive.fiveWrong.includes('f5-2'));assert.equal(afterFive.customPreserved,'keep');
const fiveOnce=storage.get('shihoshoshi-pass-v03');run('v11AnswerFive(0,v11FiveQueue[0])');assert.equal(storage.get('shihoshoshi-pass-v03'),fiveOnce);
ids.v16OxSource.value='past';ids.topic.value='all';run('startQuiz(true)');assert(run('queue.some(q=>q.id==='+JSON.stringify(oxId)+')'));
const report={runtime:'Node VM with minimal DOM adapter; no real browser',subjects:11,studyUnits:61,ox:{previous:183,basicAdded:122,pastStatementsAdded:1695,total:2000},five:{previous:36,pastAdded:349,total:385},originalPastExam:counts,lawCards:14,checks:['all scripts execute','old question prefixes and five-choice topics unchanged','all 61 units render','all source filters','1695 judgments match reviewed explanations','349 official answer mappings','349 origin navigation links','all 360 original questions render','read-only navigation leaves history unchanged','new answers append once and retain old history and custom fields','wrong-answer review preserves IDs'],limitations:['Real Chromium unavailable in sandbox; visual layout not verified']};
report.subjectCounts=plain('v11Subjects.map(s=>({subject:s.name,units:s.topics.length,ox:questions.filter(q=>s.topics.includes(q.t)).length,addedOx:v16AddedQuestions.filter(q=>s.topics.includes(q.t)).length,five:fiveQuestions.filter((q,i)=>s.topics.includes(v11FiveTopic[i])).length}))');
fs.writeFileSync(root+'verification-inherited-v1.7.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
// v1.7 navigation, associations and preservation checks.
const source16=boot(root+'index-v16-backup-20261023.html');
assert.deepStrictEqual(plain('questions'),plain('questions',source16.ctx));
assert.deepStrictEqual(plain('fiveQuestions'),plain('fiveQuestions',source16.ctx));
assert.deepStrictEqual(plain('v11FiveTopic'),plain('v11FiveTopic',source16.ctx));
const study=boot(root+'index.html');const sc=study.ctx,si=study.ids;
const go=code=>vm.runInContext(code,sc),value=code=>JSON.parse(go('JSON.stringify('+code+')'));
const walk=el=>[el,...el.children.flatMap(walk)];
const hasCaseLinks=el=>walk(el).some(x=>x.tagName==='A'&&x.href?.startsWith('#case='));
const book=value('v17CaseData');assert.equal(book.cases.length,22);assert.equal(Object.keys(book.groups).length,16);
for(const [id,g]of Object.entries(book.groups)){
 const matched=value('v15PastQuestions.filter(q=>q.kind===\"択一式\").filter(q=>'+JSON.stringify(g.subjects)+'.includes(q.subject)&&new RegExp('+JSON.stringify(g.pattern)+').test(q.text.replace(/\\s+/g,\"\"))).map(q=>q.id)');
 assert.deepStrictEqual(g.related_questions.sort(),matched.sort());assert.equal(g.question_count,matched.length);assert.equal(g.years.length,new Set(matched.map(id=>Number(id.slice(0,4)))).size);
}
go('v17OpenCasebook()');assert.equal(si.v17CaseResults.children.length,22);
for(const c of book.cases){
 assert(c.source.url.startsWith('https://www.courts.go.jp/hanrei/'));assert(c.source.case_number);assert(c.source.date);assert(c.topics.every(t=>go('v16UnitMap.has('+JSON.stringify(t)+')')));
 go('v17OpenCase('+JSON.stringify(c.id)+')');assert(!si.casebook.classList.contains('hidden'));assert(si.home.classList.contains('hidden'));assert(si.v17CaseDetail.textContent.includes(c.holding));assert(si.v17CaseDetail.textContent.includes(c.pitfall));assert(si.v17CaseDetail.textContent.includes(c.source.case_number));assert(walk(si.v17CaseDetail).some(e=>e.href===c.source.url));
 const questionButtons=si.v17CaseDetail.children.filter(e=>e.tagName==='BUTTON');assert.equal(questionButtons.length,book.groups[c.group].question_count+c.topics.length);
 questionButtons[0].onclick();assert(!si.pastExam.classList.contains('hidden'));assert(si.casebook.classList.contains('hidden'));assert(hasCaseLinks(si.v17PastCaseLinks));
 go('v17OpenCase('+JSON.stringify(c.id)+')');const buttons=si.v17CaseDetail.children.filter(e=>e.tagName==='BUTTON');buttons.at(-1).onclick();assert(!si.v14library.classList.contains('hidden'));assert(hasCaseLinks(si.v14libraryContent));
}
for(const [subject,count]of [['civil',18],['criminal',1],['constitution',2],['company',0]]){go('v17OpenCasebook('+JSON.stringify(subject)+')');assert.equal(si.v17CaseResults.children.filter(e=>e.tagName==='ARTICLE').length,count);}
go('v17OpenCasebook()');si.v17CaseSearch.value='真正';go('v17RenderCaseList()');assert.equal(si.v17CaseResults.children.length,1);
si.v17CaseSearch.value='__none__';go('v17RenderCaseList()');assert(si.v17CaseResults.textContent.includes('ありません'));
go('v17OpenCasebook()');si.v17CaseFrequency.value='5';go('v17RenderCaseList()');assert.equal(si.v17CaseResults.children.length,3); // time and retention groups
// Direct hash entry and malformed/unknown IDs are safe.
go("window.location.hash='#case=instant-delivery';v17HandleCaseHash()");assert(si.v17CaseDetail.textContent.includes('占有改定'));
go("window.location.hash='#case=%E0%A4%A';v17HandleCaseHash()");assert(!si.casebook.classList.contains('hidden'));
go("window.location.hash='#case=not-a-case';v17HandleCaseHash()");assert(si.v17CaseCount.textContent.includes('見つかりません'));
go("window.location.hash='';show('home')");
assert.equal(study.storage.get('shihoshoshi-pass-v03'),study.before);
// Follow a case link after answering; return preserves current question and feedback.
go("queue=[questions.find(q=>q.origin==='2025-午前-09'&&q.label==='ア')];pos=0;show('quiz');renderQuestion();answer(1)");assert(hasCaseLinks(si.feedback));const learningState=value('data');const feedback=si.feedback.textContent;
walk(si.feedback).find(x=>x.tagName==='A'&&x.href?.startsWith('#case=')).onclick({preventDefault(){}});assert(!si.casebook.classList.contains('hidden'));
si.v17CaseDetail.children.at(-1).children[0].onclick();assert(!si.quiz.classList.contains('hidden'));assert.equal(si.feedback.textContent,feedback);assert.deepStrictEqual(value('data'),learningState);assert.equal(go('answered'),true);
// Subject five-choice explanation receives case links with one history append.
go("v11FiveQueue=[[...v16FiveMeta.entries()].find(([i,id])=>id==='2026-午前-13')[0]];v11FiveIndex=0;v11RenderFive()");const fiveBefore=value('data.fiveAnswers.length');go('v11AnswerFive(fiveQuestions[v11FiveQueue[0]].a,v11FiveQueue[0])');assert(hasCaseLinks(si.fiveFeedback));assert.equal(go('data.fiveAnswers.length'),fiveBefore+1);
const onceHistory=study.storage.get('shihoshoshi-pass-v03');go('v11AnswerFive(0,v11FiveQueue[0])');assert.equal(study.storage.get('shihoshoshi-pass-v03'),onceHistory);
const checks={version:'1.7',runtime:'Node VM with minimal DOM adapter',caseNotes:22,issueGroups:16,preservation:'all 2,000 OX, 385 five-choice and their topics exactly equal to v1.6; localStorage key and prior histories retained',readOnlyCaseNavigation:'zero history change',passed:['all case details render','all source URLs are source-verified courts pages','all issue frequency counts recomputed from normalized original question text','all case-to-question and case-to-text links work','keyword, subject, frequency and empty-result filters','deep links including invalid encoding and unknown IDs','OX explanation to case and return without losing answer state','five-choice explanation links and one history write','all inherited 61 unit and 360 original question checks'],limitations:['No real browser launched; smartphone layout remains unverified','Frequency counts related issue questions, not citations of each judgment','Keyword associations indicate related reading, not exhaustive legal case matching']};
fs.writeFileSync(root+'verification-v1.7.json',JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify(checks,null,2));
