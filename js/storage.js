/* 司法書士PASS — js/storage.js. See README.md for load order and data editing. */
const KEY='shihoshoshi-pass-v03';let data;try{data=JSON.parse(localStorage.getItem(KEY))||null}catch(e){}if(!data){let prev;try{prev=JSON.parse(localStorage.getItem('shihoshoshi-pass-v02'))}catch(e){}data={answers:Array.isArray(prev?.answers)?prev.answers:[],wrong:Array.isArray(prev?.wrong)?prev.wrong:[]};}
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){}}
