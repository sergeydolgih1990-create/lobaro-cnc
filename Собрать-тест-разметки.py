"""Build a separate test page; never modify the production index."""
from pathlib import Path
import hashlib
root=Path(__file__).resolve().parent
source=root/'index.html'
base=source.read_text(encoding='utf-8')
before=hashlib.sha256(source.read_bytes()).hexdigest()
def replace(old,new):
 global base
 assert base.count(old)==1,old[:90]
 base=base.replace(old,new)
replace('<title>Смотрелка программ</title>','<title>Смотрелка ЧПУ — тест разметки зон</title>')
replace('</style>', '''
  button:disabled { opacity:.45; cursor:default; }
  .zones-overlay { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; overflow:hidden; }
  .zones-overlay .zone { fill:none; stroke:#10181b; stroke-width:2; stroke-dasharray:7 4; }
  .zones-overlay .zone.selected { stroke:var(--accent); stroke-width:3; stroke-dasharray:none; }
  .zone-label-bg { fill:var(--panel); stroke:var(--line); }
  .zone-label { fill:var(--ink); font:600 13px "IBM Plex Sans",system-ui,sans-serif; }
  .zone-handle { fill:var(--panel); stroke:var(--accent); stroke-width:2; }
  #z-list { display:flex; flex-direction:column; gap:4px; max-height:180px; overflow-y:auto; }
  #z-list .z-item { text-align:left; font-size:12px; padding:5px 7px; overflow-wrap:anywhere; }
  #z-fields { display:flex; flex-direction:column; gap:6px; }
  .z-coordinates { display:grid; grid-template-columns:1fr 1fr; gap:6px; }
  .z-coordinates label { font-size:12px; display:flex; flex-direction:column; }
  .z-coordinates input { width:100%; min-width:0; box-sizing:border-box; padding:4px; }
  #z-note { width:100%; min-height:56px; box-sizing:border-box; resize:vertical; font:inherit; font-size:13px; border:1px solid var(--line); background:var(--panel); color:var(--ink); }
  #z-group { border-bottom:1px solid var(--line); padding-bottom:12px; }
  #z-group .row { gap:5px; }
  .zones-active .gcode,.zones-active .toolinfo { display:none; }
  #z-status { min-height:2.7em; }
</style>''')
replace('<aside class="side">','''<aside class="side">
    <section class="group" id="z-group" aria-label="Разметка зон — тест">
      <span class="label">Разметка зон · тест</span>
      <div class="row"><button type="button" id="z-edit" aria-pressed="false">Разметить зоны</button><button type="button" id="z-add" aria-pressed="false" disabled>Новый прямоугольник</button></div>
      <div class="row"><button type="button" id="z-undo" disabled>Отменить</button><button type="button" id="z-redo" disabled>Повторить</button><button type="button" id="z-delete" disabled>Удалить зону</button></div>
      <p class="note" id="z-summary"></p>
      <div id="z-list"></div>
      <div id="z-fields" hidden>
        <b id="z-number"></b>
        <div class="z-coordinates">
          <label>X от, мм<input id="z-x0" type="number" step="0.01"></label><label>X до, мм<input id="z-x1" type="number" step="0.01"></label>
          <label>Y от, мм<input id="z-y0" type="number" step="0.01"></label><label>Y до, мм<input id="z-y1" type="number" step="0.01"></label>
        </div>
        <label for="z-note">Комментарий</label><textarea id="z-note" maxlength="2000"></textarea>
        <button type="button" id="z-apply">Применить координаты и комментарий</button>
      </div>
      <div class="row"><button type="button" id="z-save">Сохранить карту</button><button type="button" id="z-load">Загрузить карту</button><input id="z-file" type="file" accept=".json,application/json" hidden></div>
      <p class="note" id="z-status" role="status" aria-live="polite"></p>
    </section>''')
replace('<script src="three.min.js?v=9274bbcec8d9"></script>','''<script src="three.min.js?v=9274bbcec8d9"></script>
<script src="редактор-зон-модель.js?v=1"></script>
<script src="редактор-зон.js?v=2"></script>''')
replace('var camera = new THREE.PerspectiveCamera(32, 1, 1, 8000);','''var camera = new THREE.PerspectiveCamera(32, 1, 1, 8000);
  var perspectiveCamera = camera, zoneCamera = new THREE.OrthographicCamera(-100,100,100,-100,1,8000), zoneMode=false, zoneSpan=Р;
'''.replace('zoneSpan=Р','zoneSpan=300'))
replace('renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();','renderer.setSize(w, h, false); perspectiveCamera.aspect = w / h; perspectiveCamera.updateProjectionMatrix();')
replace('''  function place() {
    if ($("t_follow").checked)''','''  function place() {
    if(zoneMode){
      var aspect=(canvas.clientWidth||1)/(canvas.clientHeight||1),half=zoneSpan/2;
      camera=zoneCamera; camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
      camera.updateProjectionMatrix();цель.set(ЦЕНТР[0]+сдвиг.x,ЦЕНТР[1]+сдвиг.y,0);
      camera.position.set(цель.x,цель.y,2000);camera.up.set(0,1,0);camera.lookAt(цель);camera.updateMatrixWorld();return;
    }
    if ($("t_follow").checked)''')
replace('function кадр() { resize(); place(); xyProject(); выгрузить(); renderer.render(scene, camera); }','function кадр() { resize(); place(); xyProject(); выгрузить(); renderer.render(scene, camera); if(window.РЕДАКТОР)window.РЕДАКТОР.кадр(); }')
replace('''    selectProg(0, true);
    requestAnimationFrame(tick);''','''    window.startZoneEditor(window.СМОТРЕЛКА,{
      enable:function(){
        var old={a:азимут,h:высота,d:дистанция,shift:сдвиг.clone(),spin:$("t_spin").checked,follow:$("t_follow").checked};
        playing=false;$("b_play").textContent="▶";$("t_spin").checked=false;$("t_follow").checked=false;
        ["t_spin","t_follow","b_play"].forEach(function(id){$(id).disabled=true;});
        document.body.classList.add('zones-active');zoneMode=true;camera=zoneCamera;zoneSpan=Math.max((NY*RES)*1.12,(NX*RES)*1.12/((canvas.clientWidth||1)/(canvas.clientHeight||1)));
        сдвиг.set(GX0+NX*RES/2-ЦЕНТР[0],GY0+NY*RES/2-ЦЕНТР[1],0);кадр();return old;
      },
      disable:function(old){zoneMode=false;camera=perspectiveCamera;document.body.classList.remove('zones-active');
        if(old){азимут=old.a;высота=old.h;дистанция=old.d;сдвиг.copy(old.shift);$("t_spin").checked=old.spin;$("t_follow").checked=old.follow;}
        ["t_spin","t_follow","b_play"].forEach(function(id){$(id).disabled=false;});canvas.style.cursor='';кадр();},
      pan:function(x,y){сдвиг.x+=x;сдвиг.y+=y;},zoom:function(k){zoneSpan=Math.max(2,Math.min(8000,zoneSpan*k));},frame:кадр
    },Д);
    selectProg(0, true);
    requestAnimationFrame(tick);''')
(root/'Разметка-зон-тест.html').write_text(base,encoding='utf-8')
assert hashlib.sha256(source.read_bytes()).hexdigest()==before
print('Separate page built; production index unchanged:',before)
