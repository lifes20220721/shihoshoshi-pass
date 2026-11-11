/* 司法書士PASS — app.js. See README.md for load order and data editing. */

const chapters=window.SHIHOPASS_DATA.chapters;
chapters.push(...window.SHIHOPASS_DATA.base_1);
const questions=window.SHIHOPASS_DATA.questions;

questions.push(...window.SHIHOPASS_DATA.base_2);
questions.push(...window.SHIHOPASS_DATA.base_3);
let queue=[],pos=0,review=false,answered=false;
function show(id){for(const x of ['home','lessons','quiz','choice5','dashboard','v13view','pastExam','lawAmendments'])document.getElementById(x).classList.toggle('hidden',x!==id);renderStats();window.scrollTo(0,0)}function renderStats(){let n=data.answers.length,c=data.answers.filter(x=>x.correct).length;document.getElementById('stats').innerHTML=`<p>累計解答：<b>${n}</b>問 ／ 正答率：<b>${n?Math.round(c/n*100):0}%</b> ／ 復習対象：<b>${data.wrong.length}</b>問</p><progress max="100" value="${n?100*c/n:0}"></progress>`}function startQuiz(onlyWrong){review=onlyWrong;let t=document.getElementById('topic').value;queue=questions.filter(x=>(t==='all'||x.t===t)&&(!onlyWrong||data.wrong.includes(x.id)));pos=0;show('quiz');document.getElementById('quizTitle').textContent=onlyWrong?'間違い復習':'科目別・確認問題';renderQuestion()}function renderQuestion(){let q=queue[pos],op=document.getElementById('options');answered=false;document.getElementById('next').classList.add('hidden');document.getElementById('feedback').textContent='';if(!q){document.getElementById('counter').textContent='';document.getElementById('question').textContent=review?'この範囲に復習する問題はありません。':'演習が終了しました。';op.innerHTML='';return}document.getElementById('counter').textContent=`${pos+1} / ${queue.length}問`;document.getElementById('question').textContent=q.q;op.innerHTML='';['○ 正しい','× 誤り'].forEach((label,i)=>{let b=document.createElement('button');b.className='option';b.textContent=label;b.onclick=()=>answer(i);op.appendChild(b)})}function answer(i){if(answered)return;answered=true;let q=queue[pos],ok=i===q.a;data.answers.push({id:q.id,correct:ok,time:new Date().toISOString()});if(ok)data.wrong=data.wrong.filter(id=>id!==q.id);else if(!data.wrong.includes(q.id))data.wrong.push(q.id);save();Array.from(document.getElementById('options').children).forEach((b,j)=>{b.disabled=true;if(j===q.a)b.classList.add('correct');else if(j===i)b.classList.add('wrong')});let fb=document.getElementById('feedback');fb.textContent=(ok?'正解！ ':'不正解。 ')+q.why;document.getElementById('next').textContent=pos===queue.length-1?'終了する':'次の問題 →';document.getElementById('next').classList.remove('hidden')}function nextQuestion(){pos++;if(pos>=queue.length)show('home');else renderQuestion()}function resetData(){if(confirm('この端末の学習履歴を削除しますか？')){data={answers:[],wrong:[]};save();show('home')}}const list=document.getElementById('lessonList'),select=document.getElementById('topic');chapters.forEach(ch=>{let s=document.createElement('section');s.className='lesson';let h=document.createElement('h3');h.textContent=ch.title;s.appendChild(h);ch.body.forEach(t=>{let p=document.createElement('p');p.textContent=t;s.appendChild(p)});let b=document.createElement('button');b.textContent='この分野の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};s.appendChild(b);list.appendChild(s);let opt=document.createElement('option');opt.value=ch.id;opt.textContent=ch.title;select.appendChild(opt)});renderStats();

const fiveQuestions=window.SHIHOPASS_DATA.fiveQuestions;
fiveQuestions.push(...window.SHIHOPASS_DATA.base_4);
fiveQuestions.push(...window.SHIHOPASS_DATA.base_5);
const extraChapter1=window.SHIHOPASS_DATA.extraChapter1;
chapters.push(extraChapter1);
{const ch=extraChapter1,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_6);
questions.push(window.SHIHOPASS_DATA.base_7);
questions.push(window.SHIHOPASS_DATA.base_8);
fiveQuestions.push(window.SHIHOPASS_DATA.base_9);
const extraChapter2=window.SHIHOPASS_DATA.extraChapter2;
chapters.push(extraChapter2);
{const ch=extraChapter2,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_10);
questions.push(window.SHIHOPASS_DATA.base_11);
questions.push(window.SHIHOPASS_DATA.base_12);
fiveQuestions.push(window.SHIHOPASS_DATA.base_13);
const extraChapter3=window.SHIHOPASS_DATA.extraChapter3;
chapters.push(extraChapter3);
{const ch=extraChapter3,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_14);
questions.push(window.SHIHOPASS_DATA.base_15);
questions.push(window.SHIHOPASS_DATA.base_16);
fiveQuestions.push(window.SHIHOPASS_DATA.base_17);
const extraChapter4=window.SHIHOPASS_DATA.extraChapter4;
chapters.push(extraChapter4);
{const ch=extraChapter4,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_18);
questions.push(window.SHIHOPASS_DATA.base_19);
questions.push(window.SHIHOPASS_DATA.base_20);
fiveQuestions.push(window.SHIHOPASS_DATA.base_21);
const extraChapter5=window.SHIHOPASS_DATA.extraChapter5;
chapters.push(extraChapter5);
{const ch=extraChapter5,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_22);
questions.push(window.SHIHOPASS_DATA.base_23);
questions.push(window.SHIHOPASS_DATA.base_24);
fiveQuestions.push(window.SHIHOPASS_DATA.base_25);
const extraChapter6=window.SHIHOPASS_DATA.extraChapter6;
chapters.push(extraChapter6);
{const ch=extraChapter6,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_26);
questions.push(window.SHIHOPASS_DATA.base_27);
questions.push(window.SHIHOPASS_DATA.base_28);
fiveQuestions.push(window.SHIHOPASS_DATA.base_29);
const extraChapter7=window.SHIHOPASS_DATA.extraChapter7;
chapters.push(extraChapter7);
{const ch=extraChapter7,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_30);
questions.push(window.SHIHOPASS_DATA.base_31);
questions.push(window.SHIHOPASS_DATA.base_32);
fiveQuestions.push(window.SHIHOPASS_DATA.base_33);
const extraChapter8=window.SHIHOPASS_DATA.extraChapter8;
chapters.push(extraChapter8);
{const ch=extraChapter8,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_34);
questions.push(window.SHIHOPASS_DATA.base_35);
questions.push(window.SHIHOPASS_DATA.base_36);
fiveQuestions.push(window.SHIHOPASS_DATA.base_37);
const extraChapter9=window.SHIHOPASS_DATA.extraChapter9;
chapters.push(extraChapter9);
{const ch=extraChapter9,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_38);
questions.push(window.SHIHOPASS_DATA.base_39);
questions.push(window.SHIHOPASS_DATA.base_40);
fiveQuestions.push(window.SHIHOPASS_DATA.base_41);
const extraChapter10=window.SHIHOPASS_DATA.extraChapter10;
chapters.push(extraChapter10);
{const ch=extraChapter10,section=document.createElement('section');section.className='lesson';const h=document.createElement('h3');h.textContent=ch.title;section.appendChild(h);ch.body.forEach(t=>{const p=document.createElement('p');p.textContent=t;section.appendChild(p)});const b=document.createElement('button');b.textContent='この科目の問題を解く →';b.onclick=()=>{select.value=ch.id;startQuiz(false)};section.appendChild(b);list.appendChild(section);const o=document.createElement('option');o.value=ch.id;o.textContent=ch.title;select.appendChild(o);}
questions.push(window.SHIHOPASS_DATA.base_42);
questions.push(window.SHIHOPASS_DATA.base_43);
questions.push(window.SHIHOPASS_DATA.base_44);
fiveQuestions.push(window.SHIHOPASS_DATA.base_45);
let fivePos=0,fiveAnswered=false;
function startFive(){fivePos=0;show('choice5');renderFive()}
function renderFive(){const q=fiveQuestions[fivePos],opts=document.getElementById('fiveOptions');fiveAnswered=false;document.getElementById('fiveFeedback').textContent='';document.getElementById('fiveNext').classList.add('hidden');if(!q){document.getElementById('fiveCount').textContent='';document.getElementById('fiveQuestion').textContent='5肢択一演習が終了しました。';opts.innerHTML='';return}document.getElementById('fiveCount').textContent=`${fivePos+1} / ${fiveQuestions.length}問`;document.getElementById('fiveQuestion').textContent=q.q;opts.innerHTML='';q.opts.forEach((o,i)=>{const b=document.createElement('button');b.className='option';b.textContent=`${i+1}. ${o}`;b.onclick=()=>answerFive(i);opts.appendChild(b)})}
function answerFive(i){if(fiveAnswered)return;fiveAnswered=true;const q=fiveQuestions[fivePos],ok=i===q.a;Array.from(document.getElementById('fiveOptions').children).forEach((b,j)=>{b.disabled=true;if(j===q.a)b.classList.add('correct');else if(j===i)b.classList.add('wrong')});document.getElementById('fiveFeedback').textContent=(ok?'正解！ ':'不正解。 ')+q.why;document.getElementById('fiveNext').textContent=fivePos===fiveQuestions.length-1?'終了する':'次の問題 →';document.getElementById('fiveNext').classList.remove('hidden')}
function nextFive(){fivePos++;if(fivePos>=fiveQuestions.length)show('home');else renderFive()}

