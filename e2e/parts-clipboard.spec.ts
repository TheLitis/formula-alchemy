import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

async function screen(page:Page,x:number,y:number){return page.evaluate(({x,y})=>{const r=window.__alchemyTest.renderer,v=r.viewport,b=r.canvas.getBoundingClientRect();return{x:b.left+v.ox+x*v.scale,y:b.top+v.oy+y*v.scale};},{x,y});}
async function snap(page:Page){return page.evaluate(()=>({state:window.__alchemyTest.store.getState(),runtime:window.__alchemyTest.runtime.snapshot()}));}
async function seed(page:Page,recipe?:string){const id=await page.evaluate(recipe=>{const{store:s,runtime:r,editor:e}=window.__alchemyTest;s.reset();r.reset();if(recipe)s.openRecipe(recipe);else{s.addToken('m',350,280);s.addToken('c',550,320);}s.patch({paused:true,lab:'sandbox',selectedId:null,selectedIds:[],activeId:null});e.history.clear();return s.getState().nodes[0].id;},recipe);await expect.poll(()=>page.evaluate(id=>window.__alchemyTest.renderer.hits.targets().some(t=>t.nodeId===id),id)).toBe(true);await page.waitForTimeout(40);return id;}
async function target(page:Page,id:string,partId:string,index=0){return page.evaluate(({id,partId,index})=>{const hit=window.__alchemyTest.renderer.hits.targets().filter(t=>t.nodeId===id&&t.partId===partId)[index];if(!hit)throw new Error(`Missing real part ${partId}`);return hit;},{id,partId,index});}
async function dragTo(page:Page,from:{x:number;y:number},to:{x:number;y:number}){const a=await screen(page,from.x,from.y),b=await screen(page,to.x,to.y);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});}
async function advance(page:Page,steps=40){await page.evaluate(steps=>{const{store:s,runtime:r}=window.__alchemyTest;s.patch({paused:false});for(let i=0;i<steps;i++)r.advance(1/120);s.patch({paused:true});},steps);await page.waitForTimeout(45);}
const errors = new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));await page.goto('./?qa=1');await expect(page.locator('.board canvas')).toBeVisible();await seed(page);});
test.afterEach(async({page})=>{expect(errors.get(page)).toEqual([]);await expect(page.locator('.render-error,vite-error-overlay')).toHaveCount(0);});

test('Q reverses R; WASD uses physical keys; Shift slows movement; Ctrl+S still saves',async({page})=>{
    const id=await seed(page);await page.locator('.board canvas').focus();await page.keyboard.press('Control+KeyA');const before=await snap(page);
    await page.keyboard.press('KeyR');await page.keyboard.press('KeyQ');expect((await snap(page)).state.nodes.map(n=>n.rotation??0)).toEqual([0,0]);
    for(const [key,code] of [['ц','KeyW'],['ф','KeyA'],['ы','KeyS'],['в','KeyD']])await page.locator('.board canvas').dispatchEvent('keydown',{key,code,bubbles:true});
    let s=await snap(page);expect(s.state.nodes.map(n=>[n.x,n.y])).toEqual(before.state.nodes.map(n=>[n.x,n.y]));
    await page.keyboard.press('KeyD');const x=(await snap(page)).state.nodes[0].x;await page.keyboard.press('Shift+KeyD');s=await snap(page);
    expect(x-before.state.nodes[0].x).toBeCloseTo(12,8);expect(s.state.nodes[0].x-x).toBeCloseTo(2,8);expect(s.state.nodes[0].id).toBe(id);
    await page.keyboard.press('Control+KeyS');await expect(page.getByRole('dialog')).toBeVisible();expect((await snap(page)).state.nodes[0].y).toBe(before.state.nodes[0].y);
});

test('native Ctrl+C/V/X copies physical states, cuts a group, and remains undoable',async({page,context})=>{
    await context.grantPermissions(['clipboard-read','clipboard-write']);await page.locator('.board canvas').focus();await page.keyboard.press('Control+KeyA');
    const before=await snap(page);await page.keyboard.press('Control+KeyC');const text=await page.evaluate(()=>navigator.clipboard.readText());expect(JSON.parse(text).kind).toBe('formula-alchemy/selection');
    expect((await snap(page)).state.nodes).toEqual(before.state.nodes);await page.keyboard.press('Control+KeyV');expect((await snap(page)).state.nodes).toHaveLength(4);
    const copied=(await snap(page)).state.nodes.slice(2).map(n=>n.id);expect(copied.every(id=>!before.state.nodes.some(n=>n.id===id))).toBe(true);
    await page.keyboard.press('Control+KeyX');expect((await snap(page)).state.nodes).toHaveLength(2);await page.keyboard.press('Control+KeyZ');expect((await snap(page)).state.nodes).toHaveLength(4);
    await page.keyboard.press('Control+KeyV');expect((await snap(page)).state.nodes).toHaveLength(6);
});

test('copied selection pastes into another tab; input text retains native clipboard and WASD',async({page,context})=>{
    await context.grantPermissions(['clipboard-read','clipboard-write']);await page.locator('.board canvas').focus();await page.keyboard.press('Control+KeyA');await page.keyboard.press('Control+KeyC');
    const other=await context.newPage();await other.goto('./?qa=1');await expect(other.locator('.board canvas')).toBeVisible();await seed(other);await other.locator('.board canvas').focus();await other.keyboard.press('Control+KeyV');expect((await snap(other)).state.nodes).toHaveLength(4);await other.close();await page.bringToFront();
    await page.getByRole('button',{name:'Сохранить',exact:true}).click();const input=page.locator('#experiment-name');await input.fill('wasd q');await input.focus();await page.keyboard.press('Control+KeyA');await page.keyboard.press('Control+KeyC');await page.keyboard.press('Control+KeyX');await expect(input).toHaveValue('');await page.keyboard.press('Control+KeyV');await expect(input).toHaveValue('wasd q');
    expect((await snap(page)).state.nodes).toHaveLength(2);
});

test('toolbar clipboard remains usable without system clipboard permission or a hardware keyboard',async({page})=>{
    await page.getByRole('button',{name:'Выбрать все объекты',exact:true}).click();await page.getByRole('button',{name:'Скопировать выделение',exact:true}).click();await page.getByRole('button',{name:'Вставить выделение',exact:true}).click();expect((await snap(page)).state.nodes).toHaveLength(4);
    await page.getByRole('button',{name:'Вырезать выделение',exact:true}).click();expect((await snap(page)).state.nodes).toHaveLength(2);await page.getByRole('button',{name:'Отменить действие',exact:true}).click();expect((await snap(page)).state.nodes).toHaveLength(4);
});

test('Hooke mass stretches without moving wall; actual spring releases from rest and its readout follows',async({page},info)=>{
    const id=await seed(page,'hooke'),t=await target(page,id,'body'),before=await snap(page);
    await dragTo(page,t,{x:t.x+30,y:t.y+20});let s=await snap(page);const b=s.runtime.bodies.find(b=>b.key===t.bodyKey)!;
    expect(s.state.nodes[0]).toEqual(before.state.nodes[0]);expect(s.runtime.anchors![id]).toEqual(before.runtime.anchors![id]);expect(b.x-t.x).toBeCloseTo(30,1);expect(b.y).toBeCloseTo(t.y,5);
    await page.screenshot({path:info.outputPath('hooke-pulled.png')});await page.mouse.up();const released=(await snap(page)).runtime.bodies[0];expect(released.vx).toBe(0);await advance(page,40);expect((await snap(page)).runtime.bodies[0].x).toBeLessThan(released.x);
    expect(await page.evaluate(()=>window.__alchemyTest.editor.history.getState().count)).toBe(1);await page.keyboard.press('Control+KeyZ');expect((await snap(page)).runtime).toEqual(before.runtime);
});

test('Alt and the touch assembly toggle keep whole-spring translation available',async({page})=>{
    const id=await seed(page,'hooke'),t=await target(page,id,'body'),before=await snap(page);await page.keyboard.down('Alt');await dragTo(page,t,{x:t.x+40,y:t.y+25});await page.mouse.up();await page.keyboard.up('Alt');let s=await snap(page);
    expect(s.state.nodes[0].x-before.state.nodes[0].x).toBeCloseTo(40,1);expect(s.runtime.anchors![id].y-before.runtime.anchors![id].y).toBeCloseTo(25,1);
    await page.getByRole('button',{name:'Перемещать установку целиком',exact:true}).click();const part=await target(page,id,'body'),a=await screen(page,part.x,part.y),to=await screen(page,part.x-25,part.y+15),c=page.locator('.board canvas');
    await c.dispatchEvent('pointerdown',{pointerId:40,pointerType:'touch',isPrimary:true,button:0,clientX:a.x,clientY:a.y});await c.dispatchEvent('pointermove',{pointerId:40,pointerType:'touch',isPrimary:true,clientX:to.x,clientY:to.y});await c.dispatchEvent('pointerup',{pointerId:40,pointerType:'touch',isPrimary:true,clientX:to.x,clientY:to.y});
    expect((await snap(page)).state.nodes[0].x-s.state.nodes[0].x).toBeCloseTo(-25,1);
});

test('individual collision bodies and field charges leave their neighbours/sources unchanged',async({page})=>{
    for(const recipe of ['momentum','coulomb','electricField','lorentz']){
        const id=await seed(page,recipe),t=await target(page,id,'body'),before=await snap(page);await dragTo(page,t,{x:t.x+20,y:t.y+30});await page.mouse.up();const after=await snap(page);
        expect(after.state.nodes[0],recipe).toEqual(before.state.nodes[0]);expect(after.runtime.bodies[0].x-before.runtime.bodies[0].x,recipe).toBeCloseTo(20,1);
        if(before.runtime.bodies[1])expect(after.runtime.bodies[1],recipe).toEqual(before.runtime.bodies[1]);
    }
});

test('pendulum and spring-period bobs acquire saved initial conditions and freeze only while held',async({page})=>{
    for(const recipe of ['pendulum','springPeriod']){
        const id=await seed(page,recipe),t=await target(page,id,'oscillator'),before=await snap(page);await dragTo(page,t,{x:t.x+24,y:t.y});const held=await snap(page);expect(held.runtime.labStates![id].kind).toBe('oscillator');expect(held.state.nodes).toEqual(before.state.nodes);
        await advance(page,40);expect((await snap(page)).runtime.ages[id]).toBe(held.runtime.ages[id]);await page.mouse.up();await advance(page,25);expect((await snap(page)).runtime.ages[id]).toBeGreaterThan(held.runtime.ages[id]);
        await page.waitForTimeout(50);const moved=await target(page,id,'oscillator');expect(moved.x).not.toBeCloseTo(t.x+24,1);
    }
});

test('physical drag controls change piston, optics, conductor and slit parameters not whole diagrams',async({page})=>{
    for(const [recipe,partId,key,dx,dy] of [['idealGas','piston','V',0,20],['snell','incident-ray','theta',-30,10],['lens','lens-object','d',20,0],['lens','lens-focus','focus',20,0],['ampere','wire','alpha',-25,20],['interference','slit','d',0,-18],['wave','wavelength','lambda',20,0]] as const){
        const id=await seed(page,recipe),t=await target(page,id,partId),before=await snap(page);await dragTo(page,t,{x:t.x+dx,y:t.y+dy});await page.mouse.up();const s=await snap(page);
        expect(s.state.nodes[0].params[key],recipe).not.toBe(before.state.nodes[0].params[key]);expect(s.state.nodes[0].x,recipe).toBe(before.state.nodes[0].x);expect(s.state.nodes[0].y,recipe).toBe(before.state.nodes[0].y);
    }
});

test('drawn circuit key and atomic levels are directly clickable',async({page})=>{
    const id=await seed(page,'capacitor'),key=await target(page,id,'switch'),p=await screen(page,key.x,key.y);await page.mouse.click(p.x,p.y);expect((await snap(page)).state.nodes[0].closed).toBe(false);await expect(page.locator('.inspector-open')).toHaveCount(0);
    const a=await seed(page,'bohr'),level=await target(page,a,'bohr-level',2),q=await screen(page,level.x,level.y);await page.mouse.click(q.x,q.y);expect((await snap(page)).state.nodes[0].params.n).toBe(3);await expect(page.locator('.inspector-open')).toHaveCount(0);
    for(const index of [0,4,2]){const next=await target(page,a,'bohr-level',index),p=await screen(page,next.x,next.y);await page.mouse.click(p.x,p.y);expect((await snap(page)).state.nodes[0].params.n).toBe(index+1);}
});

test('satellite, submerged block and induction magnet can be manipulated independently',async({page})=>{
    for(const [recipe,partId,kind,dx,dy] of [['gravitation','satellite','orbit',-20,30],['buoyancy','fluid','fluid',0,24],['induction','magnet','induction',60,0]] as const){
        const id=await seed(page,recipe),t=await target(page,id,partId),before=await snap(page);await dragTo(page,t,{x:t.x+dx,y:t.y+dy});await page.mouse.up();const s=await snap(page);expect(s.runtime.labStates![id].kind).toBe(kind);expect(s.state.nodes[0].x).toBe(before.state.nodes[0].x);
        if(kind==='induction')expect(s.runtime.labStates![id].velocity).toBe(0);
    }
});

test('held mass really leaves the canvas and remains visible above palette before deletion',async({page},info)=>{
    const id=await seed(page,'hooke'),t=await target(page,id,'body'),p=await screen(page,t.x,t.y),palette=(await page.locator('[data-palette-return]').boundingBox())!;
    const destination={x:palette.x+palette.width*.52,y:palette.y+palette.height*.55};const before=await snap(page);
    await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(destination.x,destination.y,{steps:12});await expect(page.locator('[data-drag-layer]')).toHaveCount(1);await expect(page.locator('.palette-return-active')).toHaveCount(1);
    const b=(await snap(page)).runtime.bodies.find(b=>b.key===t.bodyKey)!;const position=await screen(page,b.x,b.y);expect(position.x).toBeCloseTo(destination.x,0);expect(position.y).toBeCloseTo(destination.y,0);
    await advance(page,35);const after=(await snap(page)).runtime.bodies.find(b=>b.key===t.bodyKey)!;expect(after.x).toBeCloseTo(b.x,5);expect(after.y).toBeCloseTo(b.y,5);
    // Verify pixels around the actual pointer, not merely existence of an empty overlay canvas.
    const ink=await page.locator('[data-drag-layer]').evaluate((el:HTMLCanvasElement,p)=>{const c=el.getContext('2d')!,d=el.width/innerWidth,box=c.getImageData(Math.max(0,Math.floor((p.x-32)*d)),Math.max(0,Math.floor((p.y-32)*d)),Math.floor(64*d),Math.floor(64*d));let count=0;for(let i=3;i<box.data.length;i+=4)if(box.data[i]>20)count++;return count;},destination);expect(ink).toBeGreaterThan(10);
    await page.screenshot({path:info.outputPath('body-over-palette.png')});await page.mouse.up();expect((await snap(page)).state.nodes).toHaveLength(0);await expect(page.locator('[data-drag-layer]')).toHaveCount(0);
    await page.keyboard.press('Control+KeyZ');expect((await snap(page)).runtime).toEqual(before.runtime);
});

test('Escape outside canvas restores parts, removes floating layer and leaves no phantom history',async({page})=>{
    const id=await seed(page,'hooke'),t=await target(page,id,'body'),before=await snap(page),p=await screen(page,t.x,t.y),palette=(await page.locator('[data-palette-return]').boundingBox())!;
    await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(palette.x+20,palette.y+20,{steps:9});await page.keyboard.press('Escape');await page.mouse.up();expect((await snap(page)).runtime).toEqual(before.runtime);await expect(page.locator('[data-drag-layer]')).toHaveCount(0);expect(await page.evaluate(()=>window.__alchemyTest.editor.history.active)).toBe(false);
});

test('manual oscillator states survive JSON export/import and reload with correct draggable geometry',async({page})=>{
    const id=await seed(page,'pendulum'),t=await target(page,id,'oscillator');await dragTo(page,t,{x:t.x+28,y:t.y+2});await page.mouse.up();const before=await snap(page);await page.keyboard.press('Control+KeyS');const dialog=page.getByRole('dialog');const downloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'Экспорт JSON'}).click();const download=await downloadPromise;const bytes=await readFile((await download.path())!);expect(JSON.parse(bytes.toString()).runtime.labStates[id]).toEqual(before.runtime.labStates![id]);
    await dialog.getByLabel('Файл эксперимента').setInputFiles({name:'parts.json',mimeType:'application/json',buffer:bytes});await page.reload();await expect(page.locator('.board canvas')).toBeVisible();await page.evaluate(()=>window.__alchemyTest.store.patch({paused:true}));expect((await snap(page)).runtime.labStates![id]).toEqual(before.runtime.labStates![id]);expect(await target(page,id,'oscillator')).toBeTruthy();
});

test('old angular spin is removed without disabling authored rotation or orbital motion',async({page})=>{
    const id=await seed(page,'kinetic');await page.evaluate(id=>{const r=window.__alchemyTest.runtime,s=r.snapshot();s.bodies[0].angle=.61;s.bodies[0].av=.7;r.restore(s);},id);await advance(page,360);let s=await snap(page);expect(s.runtime.bodies[0].angle).toBeCloseTo(.61,7);expect(s.runtime.bodies[0].av).toBe(0);
    await seed(page,'lorentz');const before=(await snap(page)).runtime.bodies[0];await advance(page,30);const b=(await snap(page)).runtime.bodies[0];expect(b.vy).not.toBe(before.vy);expect(Math.hypot(b.vx,b.vy)).toBeCloseTo(Math.hypot(before.vx,before.vy),6);
});
