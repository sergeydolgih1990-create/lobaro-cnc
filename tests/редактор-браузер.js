// Run in a real, ready Chrome viewer with Runtime.evaluate.
(() => {
 const assert=(v,m)=>{if(!v)throw Error(m);};
 assert(window.РЕДАКТОР,'В штатной странице ещё нет отдельного редактора зон');
 const e=window.РЕДАКТОР, before=window.СМОТРЕЛКА.ячейка(106.9,280.1);
 e.режим(true);
 assert(window.СМОТРЕЛКА.сцена().камера.isOrthographicCamera,'Разметка в ортографической XY-проекции');
 const c=document.getElementById('c'),b=c.getBoundingClientRect(),p=e.экран(90,270),q=e.координаты(p.x+b.left,p.y+b.top);
 assert(Math.abs(q.x-90)<1e-5&&Math.abs(q.y-270)<1e-5,'Прямое и обратное XY-преобразования согласованы');
 assert(!e.данные().зоны.length,'Свежая разметка пустая');
 const a=e.добавить({x0:80,x1:100,y0:260,y1:280});e.удалить(a.id);
 const z=e.добавить({x0:82,x1:99,y0:263,y1:279});
 assert(z.id===a.id+1,'Удалённый номер не повторяется');
 const saved=e.данные();assert(saved.источник.версия&&saved.карта&&saved.редакция>0,'Паспорт привязан к точной версии');
 assert(saved.зоны[0].номер===z.id,'Номер экспортируется');
 const after=window.СМОТРЕЛКА.ячейка(106.9,280.1);
 assert(before.upper===after.upper,'Редактор не изменяет съём');
 const p2=e.экран(82,263);window.СМОТРЕЛКА.ракурс(-Math.PI/2,Math.PI/2-1e-9,700,[10,15,0]);
 const q2=e.координаты(...(()=>{const b=c.getBoundingClientRect(),p=e.экран(82,263);return [p.x+b.left,p.y+b.top];})());
 assert(Math.abs(q2.x-82)<1e-5&&Math.abs(q2.y-263)<1e-5,'XY после масштаба и сдвига');
 e.загрузить(saved);assert(e.данные().зоны[0].номер===z.id,'Импорт сохраняет номера');
 const bad=JSON.parse(JSON.stringify(saved));bad.источник.версия='чужая-версия';
 let rejected=false;try{e.загрузить(bad);}catch(_){rejected=true;}assert(rejected,'Чужая версия отклоняется');
 e.удалить(z.id);e.режим(false);
 assert(window.СМОТРЕЛКА.сцена().камера.isPerspectiveCamera,'Возврат штатного 3D');
 return {passed:true,roundTrip:q,retired:a.id,newNumber:z.id,unchangedStock:true};
})()
