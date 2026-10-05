const {JSDOM}=require('jsdom');const fs=require('fs'),assert=require('assert');
const code=fs.readFileSync('dist/goa2-mobile-2d.user.js','utf8');
const d=new JSDOM(`<div class="_layout_x_1"><header class="_bar_x_1"><div class="_matchMeta_x_1">Round 1PLANNINGTurn 1</div><section aria-label="Red team has 8 life remaining"><span class="_lifeScore_x_1"></span></section></header><div class="_main_x_1"><div class="_boardArea_x_1"><div aria-label="Starting position"><button>Done adjusting</button></div></div><div class="_sidebar_x_1"><div><div class="_label_x_1">Hand</div><div><button>Commit Enter</button></div></div></div></div><div class="_gameToolsRow_x_1"><button>Share links</button></div></div><div class="_modal_x_1"><div class="_cardGrid_x_1"><div><canvas></canvas></div></div></div>`,{url:'https://goa2.frontend.pedroliv.dev/game/test?token=test&3d=0',runScripts:'outside-only',pretendToBeVisual:true});
const w=d.window,doc=w.document;w.matchMedia=()=>({matches:true,addEventListener(){}});w.eval(code);
assert(doc.documentElement.hasAttribute('data-m2-active'));assert.equal(doc.querySelector('[data-m2-fraction]').getAttribute('data-m2-fraction'),'8');assert.equal(doc.querySelectorAll('.m2-hand-actions button').length,0);assert(doc.querySelector('[data-m2="deck"]'));assert(doc.querySelector('[data-m2="commit"]'));
for(const name of ['board','hand','split','setup','tools']){doc.querySelector(`[data-mode="${name}"]`).click();assert.equal(doc.documentElement.dataset[['setup','tools'].includes(name)?'m2Panel':'m2Mode'],name);}
w.eval(code);assert.equal(doc.querySelectorAll('#goa2-m2-nav').length,1);
w.GOA2Mobile2D.destroy();assert.equal(doc.querySelectorAll('[data-m2],#goa2-m2-nav,#goa2-m2-style').length,0);
w.history.replaceState(null,'','?3d=1');w.eval(code);assert(!w.GOA2Mobile2D);
console.log('PASS: 2D activation, board/hand/split modes, setup/menu, deck and commit targeting, reinjection, removal, 3D exclusion.');w.close();
