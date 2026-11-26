/* Pure zone data; no geometry calculation or machining output. */
(function(root){
  'use strict';
  function rect(r,id){
    if(!r || !['x0','x1','y0','y1'].every(function(k){return typeof r[k]==='number' && Number.isFinite(r[k]) && Math.abs(r[k])<1e6;})) throw Error('Координаты должны быть конечными числами в миллиметрах');
    var x0=Math.min(r.x0,r.x1),x1=Math.max(r.x0,r.x1),y0=Math.min(r.y0,r.y1),y1=Math.max(r.y0,r.y1);
    if(x1-x0<.01 || y1-y0<.01) throw Error('Ширина и высота зоны должны быть не меньше 0,01 мм');
    return {id:id,x0:x0,x1:x1,y0:y0,y1:y1,note:String(r.note||'').slice(0,2000)};
  }
  root.ZoneModel={create:function(input){
    input=input||{maxId:0,rects:[]};
    if(!Number.isSafeInteger(input.maxId)||input.maxId<0 || !Array.isArray(input.rects) || input.rects.length>1000) throw Error('Некорректный список зон');
    var max=input.maxId,ids=new Set(),rs=input.rects.map(function(r){
      if(!Number.isSafeInteger(r.id)||r.id<1||r.id>max||ids.has(r.id)) throw Error('Повторённый или некорректный номер зоны');
      ids.add(r.id);return rect(r,r.id);
    });
    return {
      snapshot:function(){return {maxId:max,rects:rs.map(function(r){return Object.assign({},r);})};},
      add:function(r){if(rs.length>=1000)throw Error('Не больше 1000 зон в одной карте');if(!Number.isSafeInteger(max+1))throw Error('Закончились допустимые номера зон');var n=rect(r,max+1);max++;rs.push(n);return Object.assign({},n);},
      remove:function(id){rs=rs.filter(function(r){return r.id!==id;});},
      update:function(id,changes){var i=rs.findIndex(function(r){return r.id===id;});if(i<0)throw Error('Зона не найдена');rs[i]=rect(Object.assign({},rs[i],changes),id);return Object.assign({},rs[i]);}
    };
  }};
})(typeof window==='undefined'?globalThis:window);
