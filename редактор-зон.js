/* Test-only adapter. Rendering and material removal stay in the incumbent viewer. */
(function(){
'use strict';
window.startZoneEditor=function(api,bridge,data){
 const $=id=>document.getElementById(id), c=$('c'), stage=c.parentNode;
 const source={изделие:$('s_item').value,установка:$('s_setup').value,версия:$('s_ver').value};
 const key='lobaro-zones-v1:'+JSON.stringify(source), bounds=data.сетка;
 let model=ZoneModel.create(), selected=null, editing=false, drawing=false, drag=null, revision=0, mapId=crypto.randomUUID(), savedView=null, dirty=true;
 let history=[],future=[], updates=0;
 const NS='http://www.w3.org/2000/svg', svg=document.createElementNS(NS,'svg');
 svg.classList.add('zones-overlay');svg.setAttribute('aria-hidden','true');stage.appendChild(svg);
 function message(s,bad){$('z-status').textContent=s;$('z-status').classList.toggle('bad',!!bad);}
 function getRect(){return model.snapshot().rects.find(r=>r.id===selected);}
 function snapshot(){return {model:model.snapshot(),mapId,revision};}
 function cancelGesture(){const d=drag;drag=null;drawing=false;dirty=true;if(d&&c.hasPointerCapture(d.id))c.releasePointerCapture(d.id);}
 function remember(){cancelGesture();history.push(snapshot());if(history.length>60)history.shift();future=[];}
 function restore(s){cancelGesture();const current=model.snapshot();model=ZoneModel.create({...s.model,maxId:Math.max(current.maxId,s.model.maxId)});mapId=s.mapId;revision=Math.max(revision,s.revision)+1;selected=null;}
 function exported(){
  const s=api.состояние();
  return {формат:'lobaro-zones-v1',карта:mapId,редакция:revision,сохранено:new Date().toISOString(),источник:source,
   состояние:{программа:s.программа,строка:s.строка,секунды:s.t},сетка:bounds,единицы:'мм',плоскость:'XY',
   maxId:model.snapshot().maxId,зоны:model.snapshot().rects.map(r=>({номер:r.id,x0:r.x0,x1:r.x1,y0:r.y0,y1:r.y1,комментарий:r.note})),
   назначение:'Разметка для обсуждения; не станочная программа и не разрешение запуска'};
 }
 function persist(){try{localStorage.setItem(key,JSON.stringify(exported()));message('Сохранено в этом браузере · редакция '+revision);}catch(e){message('Не удалось сохранить в браузере. Сохраните карту в файл.',true);}}
 function changed(){revision++;dirty=true;renderList();persist();}
 function setMode(on){
  if(editing===!!on)return;
  cancelGesture();editing=!!on;
  if(editing){savedView=bridge.enable();}
  else bridge.disable(savedView);
  $('z-edit').setAttribute('aria-pressed',String(editing));$('z-edit').textContent=editing?'Закончить разметку':'Разметить зоны';
  $('z-add').disabled=!editing;$('z-add').setAttribute('aria-pressed','false');
  document.querySelectorAll('[data-view]').forEach(b=>b.disabled=editing);
  dirty=true;renderList();
 }
 function renderList(){
  const list=$('z-list');list.replaceChildren();
  const rects=model.snapshot().rects;
  if(!rects.length){let p=document.createElement('p');p.className='note';p.textContent='Зон пока нет.';list.appendChild(p);}
  rects.forEach(r=>{const b=document.createElement('button');b.type='button';b.className='z-item';b.setAttribute('aria-pressed',String(selected===r.id));
   b.textContent='Зона '+r.id+' · X '+r.x0.toFixed(2)+'…'+r.x1.toFixed(2)+' · Y '+r.y0.toFixed(2)+'…'+r.y1.toFixed(2);
   b.onclick=()=>{selected=r.id;dirty=true;renderList();};list.appendChild(b);});
  const r=getRect();$('z-fields').hidden=!r;
  if(r){$('z-number').textContent='Зона '+r.id;['x0','x1','y0','y1'].forEach(k=>$('z-'+k).value=r[k].toFixed(2));$('z-note').value=r.note;}
  $('z-delete').disabled=!r||!editing;$('z-apply').disabled=!editing;
  $('z-undo').disabled=!history.length;$('z-redo').disabled=!future.length;
  $('z-summary').textContent=rects.length+' зон · редакция '+revision;
  $('z-add').textContent=drawing?'Отменить прямоугольник':'Новый прямоугольник';
  $('z-add').setAttribute('aria-pressed',String(drawing));
 }
 function project(x,y){const v=new THREE.Vector3(x,y,0).project(api.сцена().камера);return {x:(v.x+1)*c.clientWidth/2,y:(1-v.y)*c.clientHeight/2};}
 function world(x,y){
  const b=c.getBoundingClientRect(), v=new THREE.Vector3((x-b.left)/b.width*2-1,-(y-b.top)/b.height*2+1,-1), camera=api.сцена().камера;
  v.unproject(camera);const dir=new THREE.Vector3(0,0,-1).transformDirection(camera.matrixWorld);
  if(!camera.isOrthographicCamera || Math.abs(dir.z)<1e-8)throw Error('Для координат включите разметку сверху');
  const t=-v.z/dir.z;return {x:v.x+dir.x*t,y:v.y+dir.y*t};
 }
 function element(name,attrs){const e=document.createElementNS(NS,name);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));svg.appendChild(e);return e;}
 const matrix=new THREE.Matrix4(),proj=new THREE.Matrix4();let width=-1,height=-1;
 function frame(){
  const cam=api.сцена().камера,w=c.clientWidth,h=c.clientHeight;
  if(!dirty&&width===w&&height===h&&matrix.equals(cam.matrixWorld)&&proj.equals(cam.projectionMatrix))return;
  width=w;height=h;matrix.copy(cam.matrixWorld);proj.copy(cam.projectionMatrix);dirty=false;updates++;
  svg.setAttribute('viewBox','0 0 '+w+' '+h);svg.replaceChildren();svg.style.display=editing?'block':'none';if(!editing)return;
  let rs=model.snapshot().rects;
  if(drag&&drag.preview)rs=rs.filter(r=>r.id!==drag.preview.id).concat([drag.preview]);
  rs.forEach(r=>{const a=project(r.x0,r.y1),b=project(r.x1,r.y0),x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),ww=Math.abs(b.x-a.x),hh=Math.abs(b.y-a.y),active=r.id===selected;
   element('rect',{x,y,width:ww,height:hh,class:active?'zone selected':'zone','data-zone':r.id});
   const lx=Math.max(2,Math.min(w-91,x)),ly=Math.max(2,Math.min(h-25,y));
   element('rect',{x:lx,y:ly,width:88,height:23,class:'zone-label-bg'});
   element('text',{x:lx+5,y:ly+16,class:'zone-label'}).textContent='Зона '+(r.id||'новая');
   if(active)[[r.x0,r.y0],[r.x1,r.y0],[r.x0,r.y1],[r.x1,r.y1]].forEach(p=>{const q=project(...p);element('rect',{x:q.x-5,y:q.y-5,width:10,height:10,class:'zone-handle'});});
  });
 }
 function hit(e){const b=c.getBoundingClientRect(),x=e.clientX-b.left,y=e.clientY-b.top,rs=model.snapshot().rects,r=getRect();
  if(r)for(const [kx,ky]of [['x0','y0'],['x1','y0'],['x0','y1'],['x1','y1']]){const p=project(r[kx],r[ky]);if(Math.hypot(x-p.x,y-p.y)<12)return {r,kx,ky};}
  for(let i=rs.length-1;i>=0;i--){const r=rs[i],a=project(r.x0,r.y1),b=project(r.x1,r.y0);if(x>=a.x&&x<=b.x&&y>=a.y&&y<=b.y)return {r};}return null;
 }
 function stop(e){e.preventDefault();e.stopImmediatePropagation();}
 c.addEventListener('pointerdown',e=>{
  if(!editing)return;stop(e);if(drag)return;
  if(![0,1,2].includes(e.button))return;c.setPointerCapture(e.pointerId);
  const start=world(e.clientX,e.clientY);
  if(e.button===2||e.button===1||e.shiftKey){drag={type:'pan',start,last:start,id:e.pointerId};return;}
  if(e.button!==0)return;
  if(drawing){drag={type:'new',start,id:e.pointerId,preview:{id:0,x0:start.x,x1:start.x,y0:start.y,y1:start.y}};return;}
  const h=hit(e);selected=h?h.r.id:null;
  if(h)drag={type:h.kx?'resize':'move',start,id:e.pointerId,original:h.r,kx:h.kx,ky:h.ky,preview:{...h.r}};
  dirty=true;renderList();
 },true);
 c.addEventListener('pointermove',e=>{
  if(!editing)return;stop(e);
  if(!drag){const h=hit(e);c.style.cursor=drawing?'crosshair':h?(h.kx?'nwse-resize':'move'):'default';return;}
  if(drag.id!==e.pointerId)return;
  const p=world(e.clientX,e.clientY),d=drag;
  if(d.type==='pan'){bridge.pan(d.last.x-p.x,d.last.y-p.y);bridge.frame();return;}
  if(d.type==='new'){d.preview={id:0,x0:Math.min(d.start.x,p.x),x1:Math.max(d.start.x,p.x),y0:Math.min(d.start.y,p.y),y1:Math.max(d.start.y,p.y)};}
  else if(d.type==='move'){const dx=p.x-d.start.x,dy=p.y-d.start.y;d.preview={...d.original,x0:d.original.x0+dx,x1:d.original.x1+dx,y0:d.original.y0+dy,y1:d.original.y1+dy};}
  else{d.preview={...d.original,[d.kx]:p.x,[d.ky]:p.y};let r=d.preview;[r.x0,r.x1]=[Math.min(r.x0,r.x1),Math.max(r.x0,r.x1)];[r.y0,r.y1]=[Math.min(r.y0,r.y1),Math.max(r.y0,r.y1)];}
  dirty=true;frame();
 },true);
 function release(e){if(!editing)return;stop(e);if(!drag||drag.id!==e.pointerId)return;const d=drag;drag=null;dirty=true;
  if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
  if(e.type==='pointercancel'||d.type==='pan'){frame();return;}
  if(d.original&&['x0','x1','y0','y1'].every(k=>d.original[k]===d.preview[k])){frame();return;}
  if(!d.preview||d.preview.x1-d.preview.x0<.1||d.preview.y1-d.preview.y0<.1){message('Прямоугольник слишком мал; нарисуйте заново.',true);frame();return;}
  try{if(d.type==='new'){add(d.preview);drawing=false;renderList();}
   else{const next=ZoneModel.create(model.snapshot());next.update(d.original.id,d.preview);remember();model=next;changed();}}
  catch(err){message(err.message,true);frame();}
 }
 c.addEventListener('pointerup',release,true);c.addEventListener('pointercancel',release,true);
 c.addEventListener('dblclick',e=>{if(editing)stop(e);},true);
 c.addEventListener('wheel',e=>{if(!editing)return;stop(e);const before=world(e.clientX,e.clientY);bridge.zoom(e.deltaY<0?.88:1/.88);bridge.frame();const after=world(e.clientX,e.clientY);bridge.pan(before.x-after.x,before.y-after.y);bridge.frame();}, {capture:true,passive:false});
 $('z-edit').onclick=()=>setMode(!editing);
 $('z-add').onclick=()=>{drawing=!drawing;renderList();};
 function add(r){const next=ZoneModel.create(model.snapshot()),a=next.add(r);remember();model=next;selected=a.id;changed();return a;}
 function remove(id){remember();model.remove(id);if(selected===id)selected=null;changed();}
 $('z-delete').onclick=()=>{if(selected)remove(selected);};
 $('z-apply').onclick=()=>{if(!selected)return;try{let r={note:$('z-note').value};const original=getRect();['x0','x1','y0','y1'].forEach(k=>r[k]=$('z-'+k).value===original[k].toFixed(2)?original[k]:Number($('z-'+k).value));const test=ZoneModel.create(model.snapshot());test.update(selected,r);remember();model.update(selected,r);changed();}catch(e){message(e.message,true);}};
 function undo(){if(!history.length)return;future.push(snapshot());restore(history.pop());dirty=true;renderList();persist();}
 function redo(){if(!future.length)return;history.push(snapshot());restore(future.pop());dirty=true;renderList();persist();}
 $('z-undo').onclick=undo;$('z-redo').onclick=redo;
 document.addEventListener('keydown',e=>{if(!editing||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
  if(e.key==='Escape'){cancelGesture();renderList();}
  if(e.key==='Delete'&&selected){e.preventDefault();remove(selected);}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}
 });
 function load(doc,quiet){
  if(!doc||doc.формат!=='lobaro-zones-v1'||!doc.источник||!Object.keys(source).every(k=>doc.источник[k]===source[k])||!doc.сетка||!Object.keys(bounds).every(k=>doc.сетка[k]===bounds[k])||doc.единицы!=='мм'||doc.плоскость!=='XY')throw Error('Карта относится к другой версии модели. Выберите её в списке версий; текущая карта не изменена.');
  if(typeof doc.карта!=='string'||!Number.isSafeInteger(doc.редакция)||doc.редакция<0||!Array.isArray(doc.зоны))throw Error('Неверный паспорт карты');
  const next=ZoneModel.create({maxId:doc.maxId,rects:doc.зоны.map(r=>({id:r.номер,x0:r.x0,x1:r.x1,y0:r.y0,y1:r.y1,note:r.комментарий}))});
  if(!quiet)remember();
  if(doc.карта===mapId){const current=model.snapshot();model=ZoneModel.create({...next.snapshot(),maxId:Math.max(current.maxId,doc.maxId)});revision=Math.max(revision,doc.редакция)+(quiet?0:1);}
  else{model=next;revision=doc.редакция;}
  mapId=doc.карта;selected=null;dirty=true;renderList();if(!quiet)persist();
 }
 $('z-load').onclick=()=>$('z-file').click();
 $('z-file').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>16*1024*1024)throw Error('Файл карты больше 16 МБ');load(JSON.parse(await f.text()));}catch(err){message(err.message,true);}finally{e.target.value='';}};
 $('z-save').onclick=async()=>{const payload=JSON.stringify(exported(),null,2),name='Карта-зон-'+source.версия+'-редакция-'+revision+'.json';
  try{if(window.showSaveFilePicker){const h=await window.showSaveFilePicker({suggestedName:name,types:[{description:'Карта зон',accept:{'application/json':['.json']}}]});const f=await h.createWritable();await f.write(payload);await f.close();}
   else{const url=URL.createObjectURL(new Blob([payload],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}message('Карта сохранена в файл · редакция '+revision);
  }catch(err){if(err.name!=='AbortError')message('Файл не сохранён: '+err.message,true);}
 };
 window.РЕДАКТОР={кадр:frame,режим:setMode,экран:project,координаты:world,добавить:add,удалить:remove,данные:exported,загрузить:load,обновлений:()=>updates};
 try{const raw=localStorage.getItem(key);if(raw){load(JSON.parse(raw),true);message('Восстановлена карта из этого браузера · редакция '+revision);}}
 catch(e){message('Сохранённая карта не прочитана; исходная запись оставлена. Можно загрузить файл карты.',true);}
 renderList();
};
})();
