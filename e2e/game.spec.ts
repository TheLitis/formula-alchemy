import type { EditorController } from '../src/editor/EditorController';
import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { RECIPES } from '../src/core/catalog';
import type { GameStore } from '../src/core/store';
import type { SimulationRuntime } from '../src/physics/Runtime';
import type { AudioEngine } from '../src/audio/AudioEngine';
import type { CanvasRenderer } from '../src/rendering/Renderer';

declare global { interface Window { __alchemyTest: {store: GameStore; runtime: SimulationRuntime; renderer: CanvasRenderer; audio: AudioEngine; editor: EditorController}; __ALCHEMY_QA__: boolean; } }
const offline = process.env.FA_OFFLINE_QA === '1';
async function boot(page: Page) {
    if (offline) {
        // Isolated, network-free rendering of the SAME source and real Matter/React.
        // Storage/reload is tested only in the normal HTTP CI run below.
        await page.setContent('<!doctype html><html lang="ru"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Formula Alchemy</title></head><body><div id="root"></div></body></html>');
        await page.addStyleTag({content:await readFile('/mnt/data/offline-app.css','utf8')});
        await page.evaluate(()=>{window.__ALCHEMY_QA__=true;});
        await page.addScriptTag({content:await readFile('/mnt/data/offline-app.js','utf8')});
    } else await page.goto('./?qa=1');
    await expect(page.locator('.board canvas')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>!!window.__alchemyTest)).toBe(true);
    await page.evaluate(()=>window.__alchemyTest.store.patch({paused:true}));
}
async function screen(page: Page,x:number,y:number) {
    return page.evaluate(({x,y})=>{const r=window.__alchemyTest.renderer, v=r.viewport,b=r.canvas.getBoundingClientRect();return {x:b.left+v.ox+x*v.scale,y:b.top+v.oy+y*v.scale};},{x,y});
}
async function resetRecipe(page: Page,id:string) {
    const nodeId=await page.evaluate(id=>{const {store,runtime}=window.__alchemyTest;store.reset();runtime.reset();store.openRecipe(id);store.patch({lab:'sandbox',activeId:null,selectedId:null,paused:true});return store.getState().nodes[0].id;},id);
    await expect.poll(()=>page.evaluate(id=>window.__alchemyTest.renderer.hits.targets().some(t=>t.nodeId===id),nodeId)).toBe(true);
    return nodeId;
}
async function actualHit(page:Page,nodeId:string) {
    return page.evaluate(id=>{
        const {renderer:r}=window.__alchemyTest;
        const regions=r.hits.regions.filter(r=>r.target.nodeId===id);
        const ordered=[...regions.filter(r=>r.core&&r.shape.type==='circle'&&r.shape.filled),...regions.filter(r=>r.core),...regions];
        for(const region of ordered) {
            const s=region.shape;let x=s.x,y=s.y;
            if(s.type==='rect'){x+=s.w/2;y+=s.h/2;}if(s.type==='line'){x=(x+s.x2)/2;y=(y+s.y2)/2;}
            if(x<40||x>940||y<70||y>625)continue;
            if(r.hits.pick(x,y)?.nodeId===id)return {x,y,bodyKey:region.target.bodyKey};
        }
        throw new Error(`No visible directly selectable geometry: ${window.__alchemyTest.store.getState().nodes.find(n=>n.id===id)?.recipeId}`);
    },nodeId);
}
async function position(page:Page,nodeId:string,bodyKey?:string) {
    return page.evaluate(({nodeId,bodyKey})=>{const {store,runtime}=window.__alchemyTest;
        if(bodyKey){const b=runtime.world.bodies.get(bodyKey)!;return {x:b.body.position.x,y:b.body.position.y};}
        const n=store.getState().nodes.find(n=>n.id===nodeId)!;return{x:n.x,y:n.y};
    },{nodeId,bodyKey});
}
async function mouseDrag(page:Page,from:{x:number;y:number},to:{x:number;y:number}) {
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});
}

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(async({page})=>{ const errors:string[]=[];pageErrors.set(page,errors);page.on('pageerror',e=>errors.push(e.message));await boot(page);});
test.afterEach(async({page})=>{expect(pageErrors.get(page) ?? []).toEqual([]);});

test('bare symbols; no proxy handles or formula overlays, no horizontal overflow',async({page})=>{
    await expect(page).toHaveTitle(/Formula Alchemy/);
    await expect(page.locator('.effect-card,.node-anchor,.canvas-node,.lab-heading,.board .formula')).toHaveCount(0);
    const appearance=await page.locator('[data-symbol="m"]').evaluate(el=>{const s=getComputedStyle(el);return {bg:s.backgroundColor,border:s.borderTopWidth,shadow:s.boxShadow};});
    expect(appearance.bg).toBe('rgba(0, 0, 0, 0)');expect(appearance.border).toBe('0px');expect(appearance.shadow).toBe('none');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('.render-error,vite-error-overlay')).toHaveCount(0);
});

test('drag the letters themselves to craft; the canvas keeps no equation',async({page})=>{
    const g=await screen(page,690,300),m=await screen(page,350,300);
    await mouseDrag(page,g,m);await page.mouse.up();
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.store.getState().nodes.map(n=>n.recipeId))).toEqual(['weight']);
    expect(await page.evaluate(()=>window.__alchemyTest.store.getState().selectedId)).toBeNull();
    await expect(page.locator('.board .formula,.node-anchor')).toHaveCount(0);
    await page.evaluate(()=>{const {store,runtime}=window.__alchemyTest;store.patch({paused:false});runtime.advance(.05);store.patch({paused:true});});
    expect(await page.evaluate(()=>window.__alchemyTest.runtime.world.bodies.size)).toBe(1);
});

test('Alt drags each entire recipe via real drawn geometry; position changes before release',async({page})=>{
    test.setTimeout(120000);
    await page.keyboard.down('Alt');
    for(const recipe of RECIPES) {
        const id=await resetRecipe(page,recipe.id),hit=await actualHit(page,id),start=await position(page,id,hit.bodyKey);
        const dy=hit.y>560?-25:25;
        const from=await screen(page,hit.x,hit.y),to=await screen(page,hit.x+40,hit.y+dy);
        await mouseDrag(page,from,to);
        const held=await position(page,id,hit.bodyKey);
        expect(held.x-start.x,recipe.id).toBeCloseTo(40,0);expect(held.y-start.y,recipe.id).toBeCloseTo(dy,0);
        expect(await page.evaluate(()=>window.__alchemyTest.store.getState().selectedId)).toBe(id);
        await page.mouse.up();
        const released=await position(page,id,hit.bodyKey);expect(released.x,recipe.id).toBeCloseTo(held.x,1);
    }
    await page.keyboard.up('Alt');
});

test('click the orbital visualization for its formula, not an invisible point above it',async({page})=>{
    const id=await resetRecipe(page,'gravitation');const hit=await actualHit(page,id), p=await screen(page,hit.x,hit.y);
    await page.mouse.click(p.x,p.y);
    await expect(page.locator('.inspector .recipe-title')).toHaveText('Всемирное тяготение');
    await expect(page.locator('.inspector-formula')).toBeVisible();
    await expect(page.locator('.board .formula,.effect-card')).toHaveCount(0);
});

test('black-hole hold uses the original grab offset, without jumping to the pointer',async({page})=>{
    const id=await resetRecipe(page,'blackhole');const start=await position(page,id),from=await screen(page,start.x+13,start.y+5),to=await screen(page,start.x+93,start.y+65);
    await page.mouse.move(from.x,from.y);await page.mouse.down();
    expect(await position(page,id)).toEqual(start);
    await page.mouse.move(to.x,to.y,{steps:8});const held=await position(page,id);
    expect(held.x).toBeCloseTo(start.x+80,0);expect(held.y).toBeCloseTo(start.y+60,0);await page.mouse.up();
});

test('touch pointer drag follows the actual object too',async({page})=>{
    const id=await resetRecipe(page,'gravitation'),hit=await actualHit(page,id),start=await position(page,id),from=await screen(page,hit.x,hit.y),to=await screen(page,hit.x+55,hit.y+15);
    await page.getByRole('button',{name:'Перемещать установку целиком',exact:true}).click();
    const c=page.locator('.board canvas');
    await c.dispatchEvent('pointerdown',{pointerId:8,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:from.x,clientY:from.y});
    for(let i=1;i<=6;i++)await c.dispatchEvent('pointermove',{pointerId:8,pointerType:'touch',isPrimary:true,button:0,buttons:1,clientX:from.x+(to.x-from.x)*i/6,clientY:from.y+(to.y-from.y)*i/6});
    const held=await position(page,id);expect(held.x-start.x).toBeCloseTo(55,0);
    await c.dispatchEvent('pointerup',{pointerId:8,pointerType:'touch',isPrimary:true,button:0,buttons:0,clientX:to.x,clientY:to.y});
});

test('standalone E really accelerates a charge; moving E moves the active area',async({page})=>{
    const {e,q}=await page.evaluate(()=>{const {store,runtime}=window.__alchemyTest;store.reset();runtime.reset();const e=store.addToken('E',800,450)!,q=store.addToken('q',350,260)!;store.patch({paused:true});return{e,q};});
    await expect.poll(()=>page.evaluate(id=>window.__alchemyTest.renderer.hits.targets().some(t=>t.nodeId===id),e)).toBe(true);
    const from=await screen(page,800,450),to=await screen(page,420,260);await mouseDrag(page,from,to);await page.mouse.up();
    const vx=await page.evaluate(q=>{const {store,runtime}=window.__alchemyTest;store.patch({paused:false});for(let i=0;i<60;i++)runtime.advance(1/120);store.patch({paused:true});return runtime.world.bodies.get(`${q}/0`)!.body.velocity.x;},q);
    expect(vx).toBeGreaterThan(1);
});

test('book search opens a real lab and circuit switch is usable from inspector',async({page})=>{
    await page.getByRole('button',{name:'Книга формул',exact:true}).click();await page.getByRole('textbox',{name:'Поиск формулы'}).fill('конденсатора');
    await page.getByRole('button',{name:'Заряд конденсатора: открыть опыт'}).click();
    if(await page.locator('.parameters-trigger').isVisible())await page.locator('.parameters-trigger').click();
    await page.getByRole('button',{name:'Разомкнуть цепь',exact:true}).click();
    expect(await page.evaluate(()=>window.__alchemyTest.store.getState().nodes.find(n=>n.recipeId==='capacitor')!.closed)).toBe(false);
    await page.getByRole('button',{name:'Замкнуть цепь',exact:true}).click();
    expect(await page.evaluate(()=>window.__alchemyTest.store.getState().nodes.find(n=>n.recipeId==='capacitor')!.closed)).toBe(true);
});

test('actual animation frames differ, while pause freezes pixels',async({page})=>{
    for(const id of ['gravitation','wave','pendulum','snell','lens','ampere','lengthContraction','blackhole','idealGas','capacitor']) {
        await resetRecipe(page,id);
        const a=await page.locator('.board canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());
        await page.evaluate(()=>{const {store,runtime}=window.__alchemyTest;store.patch({paused:false});for(let i=0;i<48;i++)runtime.advance(1/120);store.patch({paused:true});});
        await page.waitForTimeout(40);
        const b=await page.locator('.board canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());expect(b,id).not.toBe(a);
        await page.waitForTimeout(80);expect(await page.locator('.board canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL()),id).toBe(b);
    }
});

test('save/load and JSON export/import preserve signed fields, moved diagram and hole dust',async({page})=>{
    test.skip(offline,'Opaque offline page has no localStorage; this scenario runs on the real HTTP build in CI.');
    await page.evaluate(()=>{const {store,runtime}=window.__alchemyTest;store.reset();runtime.reset();const b=store.addToken('B',200,300)!;store.setParam(b,'B',-2);store.openRecipe('gravitation');const g=store.getState().nodes.find(n=>n.recipeId==='gravitation')!;store.move(g.id,710,240);store.openRecipe('blackhole');store.patch({paused:true,lab:'sandbox',activeId:null});});
    await page.getByRole('button',{name:'Сохранить',exact:true}).click();
    await page.getByLabel('Название эксперимента').fill('Поля и горизонт');
    const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Сохранить',exact:true}).click();
    await expect(dialog.locator('.saved-list h3')).toHaveText('Поля и горизонт');
    const slots=await page.evaluate(()=>JSON.parse(localStorage.getItem('formula-alchemy:slots:v1')!));
    expect(slots[0].state.nodes.find((n:{parts:string[]})=>n.parts[0]==='B').params.B).toBe(-2);
    expect(slots[0].runtime.bodies.some((b:{label:string})=>b.label==='')).toBe(true);
    const downloadPromise=page.waitForEvent('download');await dialog.getByRole('button',{name:'Экспорт JSON'}).click();const download=await downloadPromise;
    const path=await download.path();const bytes=await readFile(path!);const exported=JSON.parse(bytes.toString());expect(exported.runtime.bodies.length).toBeGreaterThan(0);
    await dialog.getByLabel('Файл эксперимента').setInputFiles({name:'experiment.json',mimeType:'application/json',buffer:bytes});
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.reload();await expect.poll(()=>page.evaluate(()=>!!window.__alchemyTest)).toBe(true);
    expect(await page.evaluate(()=>window.__alchemyTest.store.getState().nodes.find(n=>n.recipeId==='gravitation')!.x)).toBe(710);
    expect(await page.evaluate(()=>window.__alchemyTest.store.getState().nodes.find(n=>n.parts[0]==='B')!.params.B)).toBe(-2);
});

test('reference screenshots and console health after real object interaction',async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.evaluate(()=>{const {store,runtime}=window.__alchemyTest;store.reset();runtime.reset();store.addToken('E',365,330);store.addToken('B',680,340);const q=store.addToken('q',570,300)!;store.setParam(q,'v',4);store.patch({paused:true});});
    await page.waitForTimeout(120);
    await page.screenshot({path:info.outputPath('fields.png'),fullPage:true});
    await resetRecipe(page,'gravitation');await page.waitForTimeout(120);await page.screenshot({path:info.outputPath('orbit.png'),fullPage:true});
    await resetRecipe(page,'blackhole');await page.waitForTimeout(120);await page.screenshot({path:info.outputPath('blackhole.png'),fullPage:true});
    expect(errors).toEqual([]);await expect(page.locator('.render-error,vite-error-overlay')).toHaveCount(0);
});
