import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Filesystem, Directory, Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {LocalNotifications} from '@capacitor/local-notifications';
import {Purchases} from '@revenuecat/purchases-capacitor';
import {Billing} from './billing.mjs';
import {exportBackup, validateBackup, restoreBackup, allowedKey} from './backup.mjs';
import config from 'app-config';
import sample from 'sample-data';

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const native = Capacitor.isNativePlatform();
const demoKey = `pass-demo:${config.id}`;
let demo;
try { demo = JSON.parse(localStorage.getItem(demoKey)); } catch {}
if (!demo || typeof demo !== 'object' || Array.isArray(demo)) demo = {};
demo.positions ||= {}; demo.answers ||= {};
let route = 'home', currentSubject = null, currentIndex = 0, answered = false, toastTimer;
const billing = new Billing({sdk: Purchases, platform: Capacitor.getPlatform(), config, onChange: billingChanged});
function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 6500); }
function action(id, callback) { const element=$(id); if(element) element.onclick=()=>Promise.resolve().then(callback).catch(e=>toast(e.message||'操作を完了できませんでした。')); }
function saveDemo() { try { localStorage.setItem(demoKey,JSON.stringify(demo)); } catch { toast('学習記録を保存できませんでした。端末の空き容量を確認してください。'); } }
function page(name, content) { route=name; $('main').innerHTML=content; window.scrollTo(0,0); }
function footer() { return '<footer><button class="link" id="privacy">プライバシー</button><button class="link" id="terms">利用規約</button><button class="link" id="support">お問い合わせ</button></footer>'; }
function legalActions() { action('privacy',()=>legal('privacy')); action('terms',()=>legal('terms')); action('support',()=>legal('support')); }
function billingChanged() {
  if (!$('studyArea').hidden && !billing.active) { closeStudy(true); toast('購読状況をご確認ください。無料体験は引き続き利用できます。'); }
  if(route==='plans') plans(); else if(route==='home') home();
}
function home() {
  page('home',`<section class="card hero"><div class="eyebrow">毎日の積み重ねが、合格への一歩</div><h2>今日も、一問から。</h2><p>${esc(config.name)}を無料で体験できます。各科目の○×問題を繰り返し学習でき、途中位置を自動で保存します。</p><div class="actions"><button class="primary" id="demo">無料の問題を学ぶ</button><button id="full">${billing.active?'全機能で学習を再開':'全機能・購読プランを見る'}</button></div>${billing.active?'<p><span class="badge">購読中</span></p>':''}</section><section class="card"><h3>アプリで続ける学習</h3><p class="muted">教材を端末に収録。通信がない場所でも学習できます。条文の原文など外部資料には通信が必要です。</p><div class="grid"><button id="settings">学習通知・バックアップ</button><button id="purchases">購読・購入の復元</button></div></section>${footer()}`);
  action('demo',subjects);action('full',()=>billing.active?openStudy():plans());action('settings',settings);action('purchases',plans);legalActions();
}
function subjects() {
  page('subjects',`<h2>無料体験の科目を選ぶ</h2><p class="muted">各科目${config.samplePerSubject}問まで。回数制限なく学べます。</p><div class="actions">${sample.subjects.map(s=>`<button class="subject" data-subject="${esc(s.id)}"><span><b>${esc(s.name)}</b><small>${s.questions.length}問${demo.positions[s.id]?'・続きから':''}</small></span><span>→</span></button>`).join('')}</div><button class="link" id="all">全問題・テキストを見る</button>`);
  document.querySelectorAll('[data-subject]').forEach(b=>b.onclick=()=>startDemo(b.dataset.subject));action('all',()=>billing.active?openStudy():plans());
}
function startDemo(id) {
  currentSubject=sample.subjects.find(s=>s.id===id); if(!currentSubject?.questions.length)return;
  currentIndex=Math.max(0,currentSubject.questions.findIndex(q=>q.id===demo.positions[id]));renderDemo();
}
function renderDemo() {
  answered=false;const q=currentSubject.questions[currentIndex];
  page('demo',`<section class="card"><div class="eyebrow">${esc(currentSubject.name)}・無料体験</div><p>${currentIndex+1} / ${currentSubject.questions.length}問</p><progress value="${currentIndex}" max="${currentSubject.questions.length}"></progress><h2 class="question">${esc(q.text)}</h2><div class="options"><button data-choice="0">○ 正しい</button><button data-choice="1">× 誤り</button></div><div id="feedback" aria-live="polite"></div><div class="actions"><button id="next" class="primary" hidden>次の問題へ</button><button id="subjects">科目選択へ</button></div></section>`);
  document.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>{
    if(answered)return;answered=true;const correct=Number(b.dataset.choice)===q.answer;
    demo.answers[q.id]={correct,time:new Date().toISOString()};
    demo.positions[currentSubject.id]=currentSubject.questions[(currentIndex+1)%currentSubject.questions.length].id;saveDemo();
    document.querySelectorAll('[data-choice]').forEach(el=>el.disabled=true);
    $('feedback').innerHTML=`<div class="feedback"><strong>${correct?'正解です':'解説を確認しましょう'}</strong><p>${esc(q.explanation)}</p></div>`;$('next').hidden=false;
  });
  action('subjects',subjects);action('next',()=>{currentIndex++;if(currentIndex<currentSubject.questions.length)renderDemo();else completeDemo();});
}
function completeDemo() { page('demo-complete','<section class="card"><h2>無料体験の問題を終えました</h2><p>同じ問題は何度でも復習できます。購読すると、全問題・科目別テキストなどを利用できます。</p><div class="actions"><button id="repeat" class="primary">この科目をもう一度</button><button id="plans">購読プランを見る</button><button id="subjects">科目選択へ</button></div></section>');action('repeat',()=>{currentIndex=0;renderDemo()});action('plans',plans);action('subjects',subjects); }
function plans() {
  page('plans',`<h2>${esc(config.name)} プレミアム</h2><p>購読期間中、全問題・テキスト・復習・成績管理などの学習機能を利用できます。</p><p class="muted">このアプリ専用の購読です。もう一方の資格アプリの利用料は含まれません。</p>${billing.active?'<p class="badge">現在、購読中です</p>':''}<div class="grid">${billing.plans.map(p=>`<section class="card plan"><h3>${p.packageType==='MONTHLY'?'月額プラン':'年額プラン'}</h3><strong>${esc(p.product.priceString)}<small> / ${p.packageType==='MONTHLY'?'月':'年'}</small></strong><p>${p.packageType==='MONTHLY'?'1か月':'1年間'}ごとに自動更新</p><button class="primary" data-purchase="${esc(p.identifier)}" ${billing.busy||billing.active?'disabled':''}>このプランで購読する</button></section>`).join('')}</div>${billing.error?`<p class="card muted" role="status">${esc(billing.error)}</p>`:''}<p class="legal">無料問題の利用だけでは料金は発生しません。購読は自動更新です。購入確定時にストアアカウントへ請求されます。更新を止める場合は、期限に余裕をもってストアの定期購読設定で解約してください。アプリの削除だけでは解約されません。購入画面の価格・期間・更新条件をご確認ください。</p><div class="actions"><button id="restore" ${!billing.ready||billing.busy?'disabled':''}>購入を復元する</button><button id="refresh" ${!billing.ready||billing.busy?'disabled':''}>購入情報を更新する</button><button id="manage">定期購読の管理・解約</button>${billing.active?'<button id="study" class="primary">全機能で学習する</button>':''}<button id="free">無料体験を続ける</button></div><p class="muted">復元は購入時と同じストアアカウントで行ってください。iOSとAndroidの購入は自動では共有されません。</p>${footer()}`);
  document.querySelectorAll('[data-purchase]').forEach(b=>b.onclick=async()=>{try{if(await billing.purchase(b.dataset.purchase))openStudy()}catch(e){toast(e.message)}});
  action('restore',async()=>toast(await billing.restore()?'購入を復元しました。':'このストアアカウントで有効な購読が見つかりませんでした。'));
  action('refresh',()=>billing.refresh());action('free',subjects);action('study',openStudy);
  action('manage',()=>openExternal(Capacitor.getPlatform()==='ios'?'https://apps.apple.com/account/subscriptions':'https://play.google.com/store/account/subscriptions'));legalActions();
}
function openStudy() {
  if(!billing.active){plans();return;}
  if(!$('studyFrame').firstChild){const iframe=document.createElement('iframe');iframe.title=config.name+' 学習画面';iframe.src='./study/index.html';$('studyFrame').appendChild(iframe);}
  $('studyArea').hidden=false;
}
function closeStudy(remove=false) { $('studyArea').hidden=true;if(remove)$('studyFrame').replaceChildren(); }
async function openExternal(href) {
  const url=new URL(href,config.website);
  if(url.protocol!=='https:')throw Error('このリンクはアプリから開けません。');
  if(native)await Browser.open({url:url.href});else window.open(url.href,'_blank','noopener,noreferrer');
}
function settings() {
  page('settings',`<h2>学習を続ける設定</h2><section class="card"><h3>毎日の学習通知</h3><p>指定した時間に、この端末へ学習を促す通知を表示します。通知を有効にする際に許可を求めます。</p><label>通知時刻 <input id="reminderTime" type="time" value="20:00"></label><div class="actions"><button id="reminder" ${native?'':'disabled'}>この時間に通知する</button><button id="cancelReminder" ${native?'':'disabled'}>通知を停止する</button></div></section><section class="card"><h3>学習記録</h3><p>履歴はこの端末に保存されます。機種変更や再インストールの前にバックアップしてください。購読の復元と学習記録の復元は別です。</p><div class="actions"><button id="export">バックアップを保存・共有</button><button id="import">バックアップから復元</button><button id="clear">学習記録を削除</button></div><p class="muted">Web版のバックアップは、全機能の学習画面にある既存のバックアップ機能から取り込めます。ブラウザからアプリへ履歴が自動で移ることはありません。</p></section>${footer()}`);
  action('reminder',async()=>{const time=$('reminderTime').value;if(!/^\d{2}:\d{2}$/.test(time))throw Error('通知時刻を選んでください。');const permission=await LocalNotifications.requestPermissions();if(permission.display!=='granted')throw Error('通知が許可されていません。端末の設定をご確認ください。');const[hour,minute]=time.split(':').map(Number);await LocalNotifications.cancel({notifications:[{id:1001}]});await LocalNotifications.schedule({notifications:[{id:1001,title:config.name,body:'今日も一問から、学習を始めましょう。',schedule:{on:{hour,minute},repeats:true}}]});toast('学習通知を設定しました。端末の省電力設定などにより時刻が前後する場合があります。');});
  action('cancelReminder',async()=>{await LocalNotifications.cancel({notifications:[{id:1001}]});toast('通知を停止しました。');});
  action('export',async()=>{const text=JSON.stringify(exportBackup(localStorage,config),null,2),filename=`${config.id}-backup-${Date.now()}.json`;if(native){const file=await Filesystem.writeFile({path:filename,data:text,directory:Directory.Cache,encoding:Encoding.UTF8});await Share.share({title:'学習記録のバックアップ',files:[file.uri]});}else{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}});
  action('import',()=>$('backupFile').click());
  action('clear',()=>{if(!confirm('このアプリの学習記録を削除します。購読は解約されません。削除しますか？'))return;closeStudy(true);const keys=Object.keys(localStorage).filter(k=>allowedKey(k,config));keys.forEach(k=>localStorage.removeItem(k));demo={positions:{},answers:{}};toast('学習記録を削除しました。');});legalActions();
}
function legal(kind) {
  const text={
    privacy:`<h2>プライバシーポリシー</h2><p>学習履歴、解答、途中位置はこの端末に保存します。運営者へ学習履歴を送信する機能はありません。バックアップはご自身が選んだ保存・共有先へ渡されます。</p><p>購読の購入・復元・有効性確認にはApple／GoogleとRevenueCatを利用します。購入情報、匿名のアプリ利用者ID、アプリ・端末情報などが処理されます。学習通知は端末内で予定し、通知の送信先一覧を運営者に送信しません。</p><p>外部の条文原文や資料を開くとリンク先の方針が適用されます。このアプリ版には広告SDK・行動追跡SDKを組み込んでいません。</p><p>学習記録は設定から削除できます。購入関連データに関するお問い合わせは下記連絡先へお願いします。</p><p>RevenueCatのプライバシー：<a href="https://www.revenuecat.com/privacy">https://www.revenuecat.com/privacy</a></p>`,
    terms:`<h2>利用規約</h2><p>本アプリは試験学習を支援する教材です。合格や特定年度の出題を保証するものではありません。解説は学習用で、個別案件への法律相談ではありません。受験年度の公式情報・法令をご確認ください。</p><p>無料範囲は各科目の体験問題です。月額・年額の購読期間中は本アプリの全学習機能を利用できます。価格・課金期間は購入画面に表示します。購読の変更・解約・返金は購入したストアの手続き・規定に従います。</p><p>購入復元には同じストアアカウントをご利用ください。OS間や別の資格アプリとの購入共有は提供していません。購読を終了しても学習履歴は端末に残ります。</p><p>著作権は原著作者・出典の権利者に帰属します。出典情報は学習画面から確認できます。iOSではAppleの標準使用許諾契約も適用されます。</p><p><a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/">Apple標準使用許諾契約</a></p>`,
    support:'<h2>運営・お問い合わせ</h2><p>運営：lifes20220721</p><p>問題の誤り、不具合、購読については下記メールへご連絡ください。</p>'
  };
  page('legal',`<article class="card legal">${text[kind]}<p>お問い合わせ：${esc(config.supportEmail)}</p><p class="muted">最終更新日：2026年11月11日</p></article>`);
  $('main').querySelectorAll('a[href]').forEach(a=>a.onclick=e=>{e.preventDefault();openExternal(a.href).catch(err=>toast(err.message))});
}
$('backupFile').onchange=async()=>{try{const file=$('backupFile').files[0];if(!file)return;const values=validateBackup(await file.text(),config);if(!confirm('バックアップに含まれる学習記録で上書きしますか？'))return;closeStudy(true);restoreBackup(localStorage,values);demo=JSON.parse(localStorage.getItem(demoKey)||'{"positions":{},"answers":{}}');demo.positions||={};demo.answers||={};toast('学習記録を復元しました。');}catch(e){toast(e.message||'バックアップを読み込めませんでした。')}finally{$('backupFile').value='';}};
window.addEventListener('message',event=>{const frame=$('studyFrame').firstChild;if(event.source!==frame?.contentWindow||event.origin!==location.origin||event.data?.type!=='pass-external-link')return;openExternal(event.data.href).catch(e=>toast(e.message));});
$('appName').textContent=config.name;document.title=config.name;$('homeButton').onclick=home;$('closeStudy').onclick=()=>{closeStudy();home()};
if(native){App.addListener('appStateChange',state=>{if(state.isActive)billing.refresh()});App.addListener('backButton',()=>{if(!$('studyArea').hidden){closeStudy();home()}else if(route!=='home')home()});}
setInterval(()=>{if(!$('studyArea').hidden&&!billing.active)billingChanged()},30000);
home();billing.init();
