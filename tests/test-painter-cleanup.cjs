const fs=require('fs'),vm=require('vm'),assert=require('assert');
async function renderer(path){
 const source=fs.readFileSync(path,'utf8');const begin=source.search(/const m2Painter\s*=/);const ending=/return m0;\s*}\)\(\);/.exec(source.slice(begin));assert(ending,'Painter boundary missing');const end=begin+ending.index+ending[0].length;
 let log=[],id=0;
 function context(label){return new Proxy({}, {set(o,k,v){o[k]=v;log.push([label,'set',k,v]);return true;},get(o,k){if(k in o)return o[k];if(k==='measureText')return text=>({width:String(text).length*24});return (...args)=>{log.push([label,k,...args.map(x=>x&&typeof x==='object'?x._id??x.src??'object':x)]);};}});}
 class Image {constructor(){this.width=100;this.height=100;}set src(v){this._src=v;queueMicrotask(()=>this.onload?.());}get src(){return this._src;}}
 const document={fonts:{load:async()=>{},ready:Promise.resolve()},createElement(){const label='canvas'+id++;const ctx=context(label);return {_id:label,getContext:()=>ctx};}};
 const scope={document,Image,HTMLImageElement:Image,console};vm.createContext(scope);vm.runInContext(source.slice(begin,end)+';globalThis.painter=m2Painter;',scope);
 await scope.painter.ensureCardAssetsReady();
 return card=>{log=[];id=0;scope.painter.paintCard({width:1192,height:1664},context('main'),card);return log;};
}
(async()=>{const before=await renderer('tests/fixtures/goa2-mobile-2d-v0.14.2.txt'),after=await renderer('dist/goa2-mobile-2d.user.js');let count=0;
 for(const color of ['GOLD','SILVER','RED','BLUE','GREEN','PURPLE'])for(const type of ['ATTACK','SKILL','DEFENSE','MOVEMENT'])for(const value of [0,2,-3]){
 const card={name:'Test',color,tier:color==='PURPLE'?'IV':'I',initiative:13,primary_action:type,primary_action_value:value,secondary_actions:{MOVEMENT:2,DEFENSE:1,ATTACK:3},range_value:4,effect_text:'Test card text.',item:'DEFENSE'};
 assert.deepStrictEqual(after(card),before(card),color+' '+type+' '+value);count++;
 }
 console.log(`PASS: identical canvas drawing commands for ${count} card variants.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
