/* 司法書士PASS — js/amendments.js. See README.md for load order and data editing. */

/* Current-law notes. The 2026 exam booklet specifies laws in force on 2026-04-01. */
function v15AmendmentHtml(subject,topic){
 const notes={
  realestate:[
   {date:'2024年4月1日施行',title:'相続登記の申請義務',body:'不動産を相続で取得したことを知った日から原則3年以内に申請します。施行前の相続で未登記の場合は、原則2027年3月31日までの経過措置があります。',url:'https://www.moj.go.jp/MINJI/minji05_00599.html'},
   {date:'2026年4月1日施行',title:'住所・氏名等の変更登記の申請義務',body:'所有権の登記名義人は変更日から原則2年以内に申請します。施行前の変更で未登記の場合は、原則2028年3月31日までの経過措置があります。',url:'https://www.moj.go.jp/MINJI/minji05_00693.html'}
  ],
  civilprocedure:[
   {date:'2026年5月21日施行',title:'民事訴訟手続のデジタル化',body:'電子申立て・オンライン送達等の制度が始まりました。令和8年度司法書士試験は2026年4月1日現在の施行法令を基準とするため、この変更を同年度の過去問の正誤判定には使いません。',url:'https://www.courts.go.jp/saiban/minjidejitaruka/minso_gaiyou/index.html'},
   {date:'現行条文',title:'訴え提起の方式の条文番号',body:'訴状を裁判所に提出して訴えを提起する方式は、民事訴訟法134条です。',url:'https://laws.e-gov.go.jp/law/408AC0000000109'}
  ]
 };
 const list=notes[topic]||[];
 if(!list.length)return '';
 return '<div class="v15-amendments"><h3>⚖ 法改正・現行法の注釈</h3><p class="muted">過去問は問題冊子が指定する適用法令の日付で判断します。</p>'+list.map(n=>'<div class="v15-amendment"><small>'+v14Escape(n.date)+'</small><strong>'+v14Escape(n.title)+'</strong><span>'+v14Escape(n.body)+'</span><br><a href="'+v14Escape(n.url)+'" target="_blank" rel="noopener noreferrer">公的資料を見る</a></div>').join('')+'</div>';
}

