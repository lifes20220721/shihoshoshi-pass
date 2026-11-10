const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=__dirname+'/';
function boot(file, seed = {}){
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
 get firstChild(){return this.children[0]||null} querySelector(){return null}querySelectorAll(){return []}setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]}insertAdjacentHTML(){} addEventListener(){}
}
const ids={};for(const m of html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const el=new El(m[1]);el.id=m[2];if(m[0].includes('hidden'))el.classList.add('hidden');ids[el.id]=el;}
for(const [id,opts]of Object.entries({v15Kind:['','択一式','記述式'],v15Part:['','午前','午後'],topic:['all'],v16OxSource:['','basic','past'],v16FiveSource:['','basic','past'],v17CaseFrequency:['2','3','5','0']})){for(const text of opts){const o=new El('option');o.value=text;o.textContent=text;(ids[id]||(ids[id]=new El('select'))).add(o)}}
const historic={answers:[{id:'m1',correct:true,time:'2026-10-20T00:00:00.000Z'}],wrong:['m3'],fiveAnswers:[{id:'f5-2',correct:false,time:'2026-10-20T00:00:00.000Z'}],fiveWrong:['f5-2'],customPreserved:'keep'};
const storage=new Map([['shihoshoshi-pass-v03',JSON.stringify(historic)], ...Object.entries(seed)]);const before=storage.get('shihoshoshi-pass-v03');let writes=0;
const document={getElementById:id=>ids[id]||(ids[id]=new El()),createElement:tag=>new El(tag),createTextNode:t=>{let e=new El();e.textContent=t;return e},querySelectorAll:s=>s.startsWith('main > section')?Object.values(ids).filter(e=>e.tagName==='SECTION'):[],querySelector:()=>new El(),body:new El('body'),head:new El('head')};
const ctx=vm.createContext({document,window:{alert(){throw Error("unexpected window alert")},confirm(){return true},scrollTo(){},location:{hash:'',pathname:'/shihoshoshi-pass/',search:''},history:{replaceState(a,b,path){this.lastPath=path;}},addEventListener(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{storage.set(k,v);writes++},removeItem(k){storage.delete(k)}},Option:function(t,v){let e=new El('option');e.textContent=t;e.value=v;return e},console,Date,JSON,Set,Map,Math,Number,String,Array,Object,RegExp,setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},alert(){throw Error('unexpected alert')},confirm(){return true}});
for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],ctx);
vm.runInContext(fs.readFileSync(root+'question-quality-v1.9.1.js','utf8'),ctx);
vm.runInContext(fs.readFileSync(root+'resume-v1.9.2.js','utf8'),ctx);
return {ctx,ids,storage,before,writes};
}

module.exports = {boot};
