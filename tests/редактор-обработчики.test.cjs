// Tests execute the actual editor handlers with a minimal DOM and real Three.js math.
const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const THREE=require('../three.min.js');
function setup(){
 class Element{
  constructor(id=''){this.id=id;this.value='';this.textContent='';this.style={};this.children=[];this.disabled=false;this.hidden=false;this.handlers={};this.attrs={};this.classList={add(){},remove(){},toggle(){}};}
  setAttribute(k,v){this.attrs[k]=v;} appendChild(x){this.children.push(x);} replaceChildren(...xs){this.children=xs;}
  addEventListener(k,f){(this.handlers[k]??=[]).push(f);} click(){this.onclick?.();}
  setPointerCapture(id){this.capture=id;} hasPointerCapture(id){return this.capture===id;} releasePointerCapture(id){if(this.capture===id)this.capture=null;}
  getBoundingClientRect(){return {left:0,top:0,width:1000,height:1000};}
 }
 const els=new Map(),$=id=>{if(!els.has(id))els.set(id,new Element(id));return els.get(id);};
 const c=$('c');c.clientWidth=c.clientHeight=1000;c.parentNode=new Element();
 $('s_item').value='Заяц';$('s_setup').value='Лицо';$('s_ver').value='тест';
 const document=new Element();Object.assign(document,{getElementById:$,createElement:()=>new Element(),createElementNS:()=>new Element(),querySelectorAll:()=>[]});
 const camera=new THREE.OrthographicCamera(-500,500,500,-500,1,8000);camera.position.set(500,500,2000);camera.lookAt(500,500,0);camera.updateMatrixWorld();
 const storage=new Map();let file='';
 const box={window:null,document,THREE,Blob,crypto:require('node:crypto').webcrypto,localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)},setTimeout,URL};box.window=box;
 box.showSaveFilePicker=async()=>({createWritable:async()=>({write:async x=>{file=x;},close:async()=>{}})});
 vm.createContext(box);
 for(const f of ['редактор-зон-модель.js','редактор-зон.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),box);
 box.startZoneEditor({состояние:()=>({программа:'p',строка:1,t:0}),сцена:()=>({камера:camera})},{enable(){},disable(){},pan(){},zoom(){},frame(){}},{сетка:{RES:1}});
 const e=box.РЕДАКТОР;e.режим(true);
 function event(type,x=150,y=150,extra={}){const ev={type,clientX:x,clientY:y,pointerId:1,button:0,target:c,preventDefault(){},stopImmediatePropagation(){},...extra};for(const f of c.handlers[type]||[])f(ev);}
 const key=(k,extra={})=>{for(const f of document.handlers.keydown||[])f({key:k,target:{tagName:'BODY'},preventDefault(){},...extra});};
 return {e,$,event,key,storage,getFile:()=>file};
}
const rect={x0:100,x1:300,y0:700,y1:900};
test('Отклонённое создание не стирает историю повторения',()=>{
 const {e,$}=setup();e.добавить(rect);e.добавить(rect);$('z-undo').click();
 assert.throws(()=>e.добавить({...rect,x0:NaN}));assert.equal($('z-redo').disabled,false);
 $('z-redo').click();assert.equal(e.данные().зоны.length,2);
});
test('Загрузка во время перемещения не изменяет загруженную карту',()=>{
 const {e,event}=setup();e.добавить(rect);const doc=e.данные();doc.зоны[0].x0=120;
 event('pointerdown',200,200);event('pointermove',250,200);e.загрузить(doc);event('pointerup',250,200);
 assert.equal(e.данные().зоны[0].x0,120);
});
test('Карта с 1000 длинными комментариями сохраняется и загружается',async()=>{
 const {e,$,getFile}=setup();const doc=e.данные();doc.maxId=1000;doc.зоны=Array.from({length:1000},(_,i)=>({номер:i+1,...rect,комментарий:'я'.repeat(2000)}));e.загрузить(doc);
 await $('z-save').onclick();const payload=getFile();assert.ok(payload);const bytes=Buffer.byteLength(payload);assert.ok(bytes>2e6);
 e.удалить(1);await $('z-file').onchange({target:{files:[{size:bytes,text:async()=>payload}],value:'file'}});
 assert.equal(e.данные().зоны.length,1000);
});
test('Комментарий не округляет координаты зоны',()=>{
 const {e,$}=setup();e.добавить({...rect,x0:100.123456789});$('z-note').value='ухо';$('z-apply').click();
 assert.equal(e.данные().зоны[0].x0,100.123456789);assert.equal(e.данные().зоны[0].комментарий,'ухо');
});
test('Выбор зоны щелчком сохраняет редакцию и возможность повторить',()=>{
 const {e,$,event}=setup();e.добавить(rect);e.добавить({x0:400,x1:500,y0:300,y1:400});$('z-undo').click();
 const rev=e.данные().редакция;event('pointerdown',200,200);event('pointerup',200,200);
 assert.equal(e.данные().редакция,rev);assert.equal($('z-redo').disabled,false);
});
test('Отмена во время перемещения не возвращает устаревшую геометрию',()=>{
 const {e,$,event}=setup();e.добавить(rect);
 event('pointerdown',200,200);event('pointermove',230,220);$('z-undo').click();
 assert.doesNotThrow(()=>event('pointerup',230,220));assert.equal(e.данные().зоны.length,0);
});

test('Удаление во время перемещения отменяет устаревший жест',()=>{
 const {e,event,key}=setup();e.добавить(rect);
 event('pointerdown',200,200);event('pointermove',220,220);key('Delete');
 assert.doesNotThrow(()=>event('pointerup',220,220));assert.equal(e.данные().зоны.length,0);
});

test('Второй указатель не подменяет начатое рисование',()=>{
 const {e,$,event}=setup();$('z-add').click();event('pointerdown',100,100);event('pointermove',200,200);
 event('pointerdown',400,400,{pointerId:2});event('pointermove',500,500,{pointerId:2});event('pointerup',500,500,{pointerId:2});
 event('pointerup',200,200);assert.equal(e.данные().зоны.length,1);assert.equal(e.данные().зоны[0].x0,100);
});
test('Escape и выход из разметки освобождают указатель',()=>{
 for(const exit of ['escape','mode']){const {e,$,event,key}=setup();$('z-add').click();event('pointerdown',100,100);event('pointermove',200,200);
 if(exit==='mode')e.режим(false);else key('Escape');
 assert.equal($('c').hasPointerCapture(1),false);event('pointerup',200,200);assert.equal(e.данные().зоны.length,0);
 }
});
test('Предел зон при рисовании показывает сообщение без необработанного исключения',()=>{
 const {e,$,event}=setup();const doc=e.данные();doc.maxId=1000;doc.зоны=Array.from({length:1000},(_,i)=>({номер:i+1,...rect,комментарий:''}));e.загрузить(doc);
 $('z-add').click();event('pointerdown',100,100);event('pointermove',200,200);
 assert.doesNotThrow(()=>event('pointerup',200,200));assert.equal(e.данные().зоны.length,1000);assert.match($('z-status').textContent,/1000/);
});
test('Отмена рисования не создаёт зону',()=>{
 const {e,$,event}=setup();$('z-add').click();event('pointerdown',100,100);event('pointermove',200,200);event('pointercancel',200,200);assert.equal(e.данные().зоны.length,0);
});
