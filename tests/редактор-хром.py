"""Exercise the separate zone page in real Chrome via DevTools."""
import asyncio, base64, json, os, sys, time, urllib.request
from pathlib import Path
import websockets
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ['TMPDIR'])/'проверка-редактора-хром'
OUT.mkdir(exist_ok=True)
async def main():
    port=(Path.home()/'AppData/Local/hermes/browser-profile/chrome/DevToolsActivePort').read_text().splitlines()[0]
    info=json.load(urllib.request.urlopen(f'http://127.0.0.1:{port}/json/version',timeout=5))
    async with websockets.connect(info['webSocketDebuggerUrl'],max_size=40*1024*1024) as ws:
        n=0
        async def call(method,params=None,sid=None):
            nonlocal n
            n+=1; ident=n; msg={'id':ident,'method':method,'params':params or {}}
            if sid:msg['sessionId']=sid
            await ws.send(json.dumps(msg))
            deadline=time.monotonic()+20
            while time.monotonic()<deadline:
                r=json.loads(await asyncio.wait_for(ws.recv(),20))
                if r.get('id')==ident:
                    if 'error' in r:raise RuntimeError(r['error'])
                    return r.get('result',{})
            raise TimeoutError(method)
        url=sys.argv[1]
        context=(await call('Target.createBrowserContext'))['browserContextId']
        tid=(await call('Target.createTarget',{'url':'about:blank','background':True,'browserContextId':context}))['targetId']
        sid=(await call('Target.attachToTarget',{'targetId':tid,'flatten':True}))['sessionId']
        await call('Emulation.setDeviceMetricsOverride',{'width':1600,'height':1100,'deviceScaleFactor':1,'mobile':False},sid)
        errors=[]
        async def js(s,target_sid=None):
            r=await call('Runtime.evaluate',{'expression':s,'returnByValue':True,'awaitPromise':True},target_sid or sid)
            if 'exceptionDetails' in r:raise RuntimeError(r['exceptionDetails'])
            return r.get('result',{}).get('value')
        async def ready():
            for _ in range(90):
                if await js('!!window.РЕДАКТОР && document.getElementById("busy").style.display==="none"'):return
                await asyncio.sleep(1)
            raise TimeoutError('Редактор не готов')
        async def mouse(kind,p,buttons=0,button='left'):
            await call('Input.dispatchMouseEvent',dict(type=kind,x=p['x'],y=p['y'],buttons=buttons,button=button),sid)
        async def point(x,y):return await js(f'(()=>{{const b=document.getElementById("c").getBoundingClientRect(),p=РЕДАКТОР.экран({x},{y});return {{x:p.x+b.left,y:p.y+b.top}}}})()')
        async def drag(a,b):
            await mouse('mouseMoved',a,button='none');await mouse('mousePressed',a,1);await mouse('mouseMoved',b,1);await mouse('mouseReleased',b)
        await call('Page.navigate',{'url':url},sid);await ready()
        await js('window.__errors=[];window.addEventListener("error",e=>__errors.push(e.message));РЕДАКТОР.режим(true)')
        original=await js('РЕДАКТОР.данные()')
        if original['зоны']:raise RuntimeError('Тест требует пустую карту; существующие зоны не изменены')
        await js('СМОТРЕЛКА.к(1)')
        stock_expression='''(async()=>{const v=СМОТРЕЛКА,b=v.сцена().заготовка,g=b.geometry,s=v.состояние();
          const hash=async a=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength)))).map(x=>x.toString(16).padStart(2,'0')).join('');
          return {state:s,ear:v.ячейка(106.9,280.1),position:await hash(g.attributes.position.array),color:await hash(g.attributes.color.array)};})()'''
        baseline_tid=(await call('Target.createTarget',{'url':'about:blank','background':True,'browserContextId':context}))['targetId']
        baseline_sid=(await call('Target.attachToTarget',{'targetId':baseline_tid,'flatten':True}))['sessionId']
        from urllib.parse import urlsplit,urlunsplit
        parts=urlsplit(url);base_url=urlunsplit((parts.scheme,parts.netloc,parts.path.rsplit('/',1)[0]+'/index.html',parts.query,''))
        await call('Page.navigate',{'url':base_url},baseline_sid)
        for _ in range(90):
            if await js('!!window.СМОТРЕЛКА && !!СМОТРЕЛКА.сцена().заготовка && document.getElementById("busy").style.display==="none"',baseline_sid):break
            await asyncio.sleep(1)
        else:raise TimeoutError('Штатная смотрелка не готова')
        await js('СМОТРЕЛКА.к(1)',baseline_sid)
        baseline=await js(stock_expression,baseline_sid)
        actual=await js(stock_expression)
        assert baseline==actual,{'baseline':baseline,'editor':actual}
        before=await js('СМОТРЕЛКА.ячейка(106.9,280.1)')
        await js('document.getElementById("z-add").click()')
        await drag(await point(80,260),await point(100,280))
        r=(await js('РЕДАКТОР.данные().зоны'))[0]
        assert abs(r['x0']-80)<.01 and abs(r['y1']-280)<.01,r
        await drag(await point(90,270),await point(95,273))
        r=(await js('РЕДАКТОР.данные().зоны'))[0]
        assert abs(r['x0']-85)<.01 and abs(r['y0']-263)<.01,r
        await drag(await point(105,283),await point(111,288))
        r=(await js('РЕДАКТОР.данные().зоны'))[0]
        assert abs(r['x1']-111)<.01 and abs(r['y1']-288)<.01,r
        await js('document.getElementById("z-undo").click();document.getElementById("z-redo").click()')
        assert (await js('РЕДАКТОР.данные().зоны'))[0]==r
        await js('document.querySelector("#z-list .z-item").click();document.getElementById("z-note").value="Проверка перемещения";document.getElementById("z-apply").click()')
        a=await point(95,273);a={k:round(v) for k,v in a.items()}
        anchor=await js(f'РЕДАКТОР.координаты({a["x"]},{a["y"]})')
        await call('Input.dispatchMouseEvent',dict(type='mouseWheel',x=a['x'],y=a['y'],deltaY=-120,deltaX=0),sid)
        q=await js(f'РЕДАКТОР.координаты({a["x"]},{a["y"]})')
        assert abs(q['x']-anchor['x'])<.01 and abs(q['y']-anchor['y'])<.01,q
        assert before==await js('СМОТРЕЛКА.ячейка(106.9,280.1)')
        saved=await js('РЕДАКТОР.данные()');assert saved['зоны'][0]['комментарий']=='Проверка перемещения'
        errors=await js('__errors');assert not errors,errors
        await call('Page.reload',{'ignoreCache':True},sid);await ready()
        restored=await js('РЕДАКТОР.данные()');assert restored['зоны']==saved['зоны']
        await js('РЕДАКТОР.режим(true);СМОТРЕЛКА.к(1);document.querySelector("#z-list .z-item").click()')
        assert baseline==await js(stock_expression)
        shot=await call('Page.captureScreenshot',{'format':'png'},sid)
        (OUT/'Редактор-зон-проверка.png').write_bytes(base64.b64decode(shot['data']))
        await js('РЕДАКТОР.загрузить('+json.dumps(original,ensure_ascii=False)+');РЕДАКТОР.режим(false)')
        result={'passed':True,'url':url,'drawing':True,'moving':True,'resizing':True,'undoRedo':True,'wheelAnchor':q,'persistence':True,'unchangedStock':before,'stockParity':baseline,'errors':errors,'screenshot':str(OUT/'Редактор-зон-проверка.png')}
        (OUT/'Результат.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(result,ensure_ascii=False,indent=2))
        await call('Target.closeTarget',{'targetId':tid})
        await call('Target.disposeBrowserContext',{'browserContextId':context})
asyncio.run(main())
