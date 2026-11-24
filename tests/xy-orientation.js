// Run in the ready viewer console or with CDP Runtime.evaluate; no dependencies.
(() => {
  const a = window.СМОТРЕЛКА, s = a.сцена(), assert = (v, m) => { if (!v) throw Error(m); };
  const original = {position:s.камера.position.clone()};
  a.ракурс(-Math.PI/2, Math.PI/2-.001, 1500);
  const o = a.ориентация();
  assert(o.origin.join() === '0,0,0' && o.units === 'мм', 'real XY origin and mm');
  assert(o.labels <= 24, 'bounded labels');
  const lines = s.scene.children.filter(x => /^XY ruler /.test(x.name));
  assert(lines.length === 2 && lines.every(x => x.geometry.attributes.position.count < 50), 'two small static buffers');
  for (const label of o.positions.filter(l => !l.hidden)) {
    const p = new THREE.Vector3(label.x,label.y,0).project(s.камера), c = document.getElementById('c');
    assert(Math.abs(parseFloat(label.left)-(p.x+1)*c.clientWidth/2)<.11, 'projected X');
    assert(Math.abs(parseFloat(label.top)-(1-p.y)*c.clientHeight/2)<.11, 'projected Y');
  }
  const u=o.updates; a.ракурс(-Math.PI/2,Math.PI/2-.001,1500);
  assert(a.ориентация().updates===u,'unchanged camera skips DOM update');
  a.ракурс(.4,.7,1200,[20,30,0]);assert(a.ориентация().updates>u,'rotation/pan/zoom');
  a.ракурс(-Math.PI/2,Math.PI/2-.001,1500);
  assert(!document.getElementById('t_dims') || !document.getElementById('t_dims').checked,'dimensions remain opt-in');
  return {passed:true,labels:o.labels,vertices:lines.map(l=>l.geometry.attributes.position.count)};
})()
