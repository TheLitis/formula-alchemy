changes = [
{'path':'e2e/game.spec.ts','sha256':'0e14b4dadb657706300cb4f030a95d99156766e5f7a84ac01fc0fddcf730ecc6','edits':[[0,6300,r'''import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { RECIPES } from '../src/core/catalog';
import type { GameStore } from '../src/core/store';
import type { SimulationRuntime } from '../src/physics/Runtime';
import type { CanvasRenderer } from '../src/rendering/Renderer';

declare global { interface Window { __alchemyTest: {store: GameStore; runtime: SimulationRuntime; renderer: CanvasRenderer}; __ALCHEMY_QA__: boolean; } }
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

test('every recipe is draggable via real drawn geometry; position changes before release',async({page})=>{
    test.setTimeout(120000);
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
''']]},
{'path':'playwright.config.ts','sha256':'a7b583133bf3da080b2a937499b276cbeba54d7f83a143005ab4545baf11bf4d','edits':[[0,802,r'''import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: './e2e', timeout: 40000, expect: { timeout: 8000 }, fullyParallel: false,
    forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0, workers: 1,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: { launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined }, baseURL: 'http://127.0.0.1:4173/formula-alchemy/', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
    projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }, { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
    webServer: process.env.FA_OFFLINE_QA === '1' ? undefined : { command: 'npm run preview:pages', url: 'http://127.0.0.1:4173/formula-alchemy/', reuseExistingServer: !process.env.CI, timeout: 60000 },
});
''']]},
{'path': 'src/app/App.tsx', 'sha256': '4c7d2dba1bf0deca427d95c93325c75f035465e0740de9c1c8535e54850bd672', 'edits': [[2653, 2653, "            if (e.code === 'BracketLeft' || e.code === 'BracketRight') {\n                e.preventDefault();\n                const current = store.getState(), nodes = current.nodes;\n                if (nodes.length) {\n                    const index = nodes.findIndex(n => n.id === current.selectedId);\n                    store.select(nodes[(index + (e.code === 'BracketLeft' ? -1 : 1) + nodes.length) % nodes.length].id);\n                }\n            }\n            if (e.key.startsWith('Arrow')) {\n                const current = store.getState(), n = current.nodes.find(n => n.id === current.selectedId);\n                const delta = ({ ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] } as Record<string, number[]>)[e.key];\n                if (n && delta) {\n                    e.preventDefault(); const p = runtime.world.positionFor(n), b = runtime.world.bodies.get(`${n.id}/0`);\n                    if (b) { runtime.world.hold(b.key); runtime.world.drag(p.x + delta[0], p.y + delta[1]); runtime.world.release(); }\n                    else store.move(n.id, p.x + delta[0], p.y + delta[1]);\n                }\n            }\n"], [2852, 2870, ', [store, runtime, modal]);'], [5195, 5230, '() => setInspectOpen(true)}']]},
{'path':'src/app/usePointerCraft.ts','sha256':'5d3a348d48f91b539c2ed239291935da38c41fd7777a5b786261075182b2edd2','edits':[[0,6462,r'''import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useSession } from './session';
import { candidates } from '../core/crafting';
import { SYMBOL_MAP } from '../core/symbols';
import { tokenGlyph } from '../core/entities';
import { toWorld } from '../rendering/Renderer';
import type { CanvasRenderer } from '../rendering/Renderer';
import type { SceneTarget } from '../rendering/interaction';
interface Drag {
    pointer: number; source: HTMLElement; symbol?: string; hit?: SceneTarget;
    sx: number; sy: number; wx: number; wy: number; moved: boolean;
}
/** One pointer controller for actual Canvas geometry and the palette. No proxy DOM handles. */
export function usePointerCraft(board: RefObject<HTMLDivElement | null>, renderer: RefObject<CanvasRenderer | null>, onInspect: () => void) {
    const { store, runtime, audio } = useSession(), inspect = useRef(onInspect);
    inspect.current = onInspect;
    useEffect(() => {
        let drag: Drag | null = null, ghost: HTMLDivElement | null = null;
        const point = (x: number, y: number) => { const b = board.current!.getBoundingClientRect(); return toWorld(renderer.current!.viewport, x - b.left, y - b.top); };
        const clean = () => {
            if (drag) { try { if (drag.source.hasPointerCapture(drag.pointer)) drag.source.releasePointerCapture(drag.pointer); } catch { /* target removed during craft */ } }
            runtime.world.release(); runtime.heldNode = null; ghost?.remove(); ghost = null; drag = null;
            if (renderer.current) { renderer.current.craftTarget = null; renderer.current.canvas.style.cursor = 'grab'; }
        };
        const cancel = () => {
            if (drag?.moved && drag.hit) {
                if (drag.hit.bodyKey) runtime.world.drag(drag.hit.x, drag.hit.y);
                else store.move(drag.hit.nodeId, drag.hit.x, drag.hit.y);
            }
            clean();
        };
        const down = (event: PointerEvent) => {
            if (drag || event.button !== 0 || event.isPrimary === false || !renderer.current || !board.current || document.querySelector('[aria-modal="true"]')) return;
            const target = event.target as Element, palette = target.closest<HTMLElement>('[data-symbol]');
            const onCanvas = target === renderer.current.canvas;
            if (!palette && !onCanvas) return;
            const p = point(event.clientX, event.clientY);
            const hit = onCanvas ? renderer.current.hits.pick(p.x, p.y, undefined, false, 9 / renderer.current.viewport.scale) : null;
            if (onCanvas && !hit) { store.select(null); return; }
            event.preventDefault();
            const source = palette ?? renderer.current.canvas;
            drag = { pointer: event.pointerId, source, symbol: palette?.dataset.symbol, hit: hit ?? undefined, sx: event.clientX, sy: event.clientY, wx: p.x, wy: p.y, moved: false };
            if (hit) store.select(hit.nodeId);
            try { source.setPointerCapture(event.pointerId); } catch { /* Synthetic QA events or a detached pointer: window listeners still release the drag. */ }
            void audio.unlock().catch(() => {}); audio.click();
        };
        const move = (event: PointerEvent) => {
            const draw = renderer.current;
            if (!draw || !board.current) return;
            if (!drag) { if (event.target === draw.canvas) { const p = point(event.clientX, event.clientY); draw.canvas.style.cursor = draw.hits.pick(p.x, p.y) ? 'grab' : 'default'; } return; }
            if (event.pointerId !== drag.pointer) return;
            const p = point(event.clientX, event.clientY);
            if (!drag.moved && Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) > 4) {
                drag.moved = true;
                if (drag.hit?.bodyKey) runtime.world.hold(drag.hit.bodyKey);
                if (drag.hit) runtime.heldNode = drag.hit.nodeId;
                if (drag.symbol) {
                    ghost = document.createElement('div'); ghost.className = 'drag-ghost';
                    ghost.textContent = tokenGlyph({ id: 'ghost', parts: [drag.symbol], x: 0, y: 0, params: {}, revision: 0, closed: true });
                    document.body.appendChild(ghost);
                }
            }
            if (!drag.moved) return;
            draw.canvas.style.cursor = 'grabbing';
            if (ghost) { ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`; }
            if (drag.hit) {
                const x = drag.hit.x + p.x - drag.wx, y = drag.hit.y + p.y - drag.wy;
                if (drag.hit.bodyKey) runtime.world.drag(x, y); else store.move(drag.hit.nodeId, x, y);
            }
            const target = draw.hits.pick(p.x, p.y, drag.hit?.nodeId, true, 6 / draw.viewport.scale);
            const a = drag.symbol ? [drag.symbol] : store.getState().nodes.find(n => n.id === drag!.hit?.nodeId)?.parts ?? [];
            const b = target && store.getState().nodes.find(n => n.id === target.nodeId);
            draw.craftTarget = b && candidates([...a, ...b.parts]).length ? b.id : null;
        };
        const up = (event: PointerEvent) => {
            if (!drag || event.pointerId !== drag.pointer || !renderer.current || !board.current) return;
            const d = drag, p = point(event.clientX, event.clientY), r = board.current.getBoundingClientRect();
            const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
            if (!d.moved) {
                if (d.symbol && SYMBOL_MAP[d.symbol]) store.addToken(d.symbol);
                else if (d.hit && window.matchMedia('(max-width:1020px)').matches) inspect.current();
                clean(); return;
            }
            const trash = [...document.querySelectorAll<HTMLElement>('[data-trash]')].some(el => { const b = el.getBoundingClientRect(); return event.clientX >= b.left && event.clientX <= b.right && event.clientY >= b.top && event.clientY <= b.bottom; });
            if (trash && d.hit) { store.remove(d.hit.nodeId); clean(); return; }
            if (!inside) { cancel(); return; }
            const hit = renderer.current.hits.pick(p.x, p.y, d.hit?.nodeId, true, 6 / renderer.current.viewport.scale);
            const a = d.symbol ? [d.symbol] : store.getState().nodes.find(n => n.id === d.hit?.nodeId)?.parts ?? [];
            const b = hit && store.getState().nodes.find(n => n.id === hit.nodeId);
            runtime.world.release();
            if (hit && b && candidates([...a, ...b.parts]).length) {
                if (d.symbol) store.dropSymbol(d.symbol, b.id, { x: hit.x, y: hit.y });
                else if (d.hit) store.combine(d.hit.nodeId, b.id, { x: hit.x, y: hit.y });
            } else if (d.symbol) store.addToken(d.symbol, p.x, p.y);
            clean();
        };
        const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (drag) cancel(); else if (!document.querySelector('[aria-modal="true"]')) store.select(null); } };
        document.addEventListener('pointerdown', down);
        window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', cancel); window.addEventListener('blur', cancel); window.addEventListener('keydown', key);
        return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key); clean(); };
    }, [store, runtime, audio, board, renderer]);
}
''']]},
{'path': 'src/components/Inspector.tsx', 'sha256': '78b5a3b8fe361b2a11e77a7feeb1352d248c9c4e26cc7ece4cbbbaef30f1319f', 'edits': [[0, 0, "import { isApparatus, standaloneDescription, standaloneParameters } from '../core/entities';\nimport { ParameterControls } from './ParameterControls';\n"], [3029, 3701, '      <ParameterControls node={node} definitions={recipe.params}/>\n'], [3935, 3935, '/></button>}\n      {isApparatus(node) && <button className="button outline full" onClick={() => { if (state.lab === \'sandbox\') store.focus(node.id); else store.patch({ lab: \'sandbox\', activeId: null }); }}>{state.lab === \'sandbox\' ? \'Развернуть лабораторию\' : \'Вернуть на общий холст\'} <Icon name="arrow" size={16}'], [5789, 5943, '{standaloneDescription(node)}</p>\n      <ParameterControls node={node} definitions={standaloneParameters(node.parts)}/>\n      {standaloneParameters(node.parts).length > 0 && <button className="button outline full restart-experiment" onClick={() => store.restart(node.id)}><Icon name="play" size={16}/> Повторить с заданной скоростью</button>}\n      <h3 className="section-caption standalone-next">Что можно получить</h3><div className="suggestions">{']]},
{'path':'src/components/ParameterControls.tsx','sha256':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','edits':[[0,0,r'''import { useSession } from '../app/session';
import type { FormulaNode, Parameter } from '../core/types';
import { Formula } from './Formula';

export function ParameterControls({ node, definitions }: { node: FormulaNode; definitions: Parameter[] }) {
    const { store } = useSession();
    return <div className="parameter-list">{definitions.map(p => <div className="parameter" key={p.key}>
        <label htmlFor={`param-${p.key}`}><span><Formula tex={p.symbol}/> {p.name}</span><small>{p.unit}</small></label>
        <div className="range-row">
            <input id={`param-${p.key}`} type="range" min={p.min} max={p.max} step={p.step} value={node.params[p.key] ?? p.initial} onChange={e => store.setParam(node.id, p.key, e.currentTarget.valueAsNumber)}/>
            <input className="number-input" aria-label={`${p.name}, численно`} type="number" min={p.min} max={p.max} step={p.step} value={node.params[p.key] ?? p.initial} onChange={e => store.setParam(node.id, p.key, e.currentTarget.valueAsNumber)}/>
        </div>
    </div>)}</div>;
}
''']]},
{'path':'src/components/Stage.tsx','sha256':'dbd65f5889b5ba097292c5566460e43c62cdeaba0b2222eb75f89d1f59d5afae','edits':[[0,12566,r'''import { useEffect, useRef, useState } from 'react';
import { useGame, useRuntimeTick, useSession } from '../app/session';
import { usePointerCraft } from '../app/usePointerCraft';
import { RECIPE_MAP, RECIPES } from '../core/catalog';
import { MAX_BODIES } from '../core/types';
import { CanvasRenderer } from '../rendering/Renderer';
import { Icon } from './Icon';
function StatusBar() {
    const runtime = useRuntimeTick(), state = useGame();
    return <div className="stage-status"><span><span className={`live-indicator ${state.paused ? 'paused' : ''}`}/>{state.paused ? 'Пауза' : 'Симуляция'} <span className="status-time">{runtime.time.toFixed(1)} с</span></span><span className="status-center">{state.nodes.length} элементов · {runtime.world.bodies.size}/{MAX_BODIES} тел</span><span>{state.discoveries.length} / {RECIPES.length} открытий</span></div>;
}
export function Stage({ onReset, onHelp, onInspect }: { onReset: () => void; onHelp: () => void; onInspect: () => void }) {
    const { store, runtime } = useSession(), state = useGame();
    const board = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<CanvasRenderer | null>(null);
    const [renderError, setRenderError] = useState('');
    const active = state.nodes.find(n => n.id === state.activeId), recipe = active?.recipeId ? RECIPE_MAP[active.recipeId] : null;
    usePointerCraft(board, renderer, onInspect);
    useEffect(() => {
        if (!canvas.current || !board.current) return;
        let draw: CanvasRenderer;
        try { draw = new CanvasRenderer(canvas.current); } catch (e) { setRenderError((e as Error).message); return; }
        renderer.current = draw;
        const resize = () => { const r = board.current!.getBoundingClientRect(); if (r.width > 0 && r.height > 0) draw.resize(r.width, r.height); };
        const observer = new ResizeObserver(resize); observer.observe(board.current); resize();
        let request = 0, last = performance.now(), failed = false;
        const frame = (now: number) => {
            const elapsed = (now - last) / 1000; last = now;
            if (!document.hidden && !failed) {
                try { runtime.advance(elapsed); draw.render(store.getState(), runtime); }
                catch (e) { failed = true; setRenderError((e as Error).message); store.patch({ paused: true }); }
            }
            request = requestAnimationFrame(frame);
        };
        request = requestAnimationFrame(frame);
        // Opt-in, local test harness. Never used to substitute any engine or UI behavior.
        if (new URLSearchParams(location.search).has('qa') || (window as unknown as Record<string, unknown>).__ALCHEMY_QA__ === true) (window as unknown as Record<string, unknown>).__alchemyTest = { store, runtime, renderer: draw };
        return () => { cancelAnimationFrame(request); observer.disconnect(); renderer.current = null; delete (window as unknown as Record<string, unknown>).__alchemyTest; };
    }, [store, runtime]);
    return <main className="workspace" aria-label="Лаборатория Formula Alchemy">
        <div className="stage-top"><div className="stage-mode"><Icon name="flask" size={17}/><span>{state.lab === 'sandbox' ? 'Свободная песочница' : recipe?.title}</span>{state.lab !== 'sandbox' && <button className="text-button" onClick={() => store.patch({ lab: 'sandbox', activeId: null })}>На холст <Icon name="arrow" size={14}/></button>}</div><div className="stage-view-tools">
            <details className="view-menu"><summary aria-label="Настройки отображения"><Icon name="settings" size={17}/></summary><div className="view-options">{(['grid', 'vectors', 'trails'] as const).map((key, i) => <label key={key}><input type="checkbox" checked={state[key]} onChange={e => store.patch({ [key]: e.target.checked })}/>{['Координатная сетка', 'Векторы скорости', 'Следы движения'][i]}</label>)}</div></details>
            <button className="icon-button" aria-label="Справка" onClick={onHelp}><Icon name="help" size={17}/></button></div></div>
        <div className="board" ref={board}>
            <canvas ref={canvas} tabIndex={0} aria-label="Физическая песочница. Нажмите на объект для формулы справа. Перетаскивайте сам объект. Скобки выбирают объект, стрелки перемещают, пробел — пауза, Delete — удаление."/>
            {renderError && <div className="render-error" role="alert"><h2>Симуляция остановлена</h2><p>{renderError}</p><p>Сохранения и экспорт остаются доступны.</p></div>}
        </div>
        <div className="simulation-toolbar"><div className="playback"><button className="play-button" aria-label={state.paused ? 'Продолжить симуляцию' : 'Приостановить симуляцию'} onClick={() => store.patch({ paused: !state.paused })}><Icon name={state.paused ? 'play' : 'pause'} size={17}/></button><label className="sr-only" htmlFor="simulation-speed">Скорость симуляции</label><select id="simulation-speed" value={state.speed} onChange={e => store.patch({ speed: Number(e.target.value) })}><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></div>
            <span className="toolbar-separator"/><button className="toolbar-button" onClick={() => store.addToken('m')}><Icon name="plus" size={17}/><span>Тело</span></button><button className="toolbar-button parameters-trigger" onClick={onInspect}><Icon name="sliders" size={17}/><span>Параметры</span></button><span className="toolbar-spacer"/><button className="toolbar-button" data-trash onClick={onReset} aria-label="Очистить эксперимент"><Icon name="reset" size={17}/><span className="toolbar-reset-label">Сброс</span></button>
        </div><StatusBar/>
    </main>;
}
''']]},
{'path': 'src/core/catalog.ts', 'sha256': '979563aa7b2929f53e8f4d06260a467b4751cc397d60fdceeb3763cddcc22168', 'edits': [[0, 0, "import { EXTRA_RECIPES } from './extraRecipes';\n"], [1151, 1151, '    ...EXTRA_RECIPES,\n'], [6198, 6326, "        description: 'Одна и та же сила создаёт большее давление на меньшей площади.', effect: 'Поршень плавно опускается под нагрузкой; меняется площадь контакта;"], [9068, 9190, " уравнения ОТО и линзирование не решаются. Поглощаются также символы и области полей. Усиленное экранное притяжение — игровая условность.', params: [p('M', 'M', 'Масса', 'M☉', 1, 20, 0.5, 5)] }"], [15206, 15534, "        description: 'Одноимённые заряды отталкиваются, разноимённые притягиваются. Модуль силы убывает как 1/r².', effect: 'Два свободных заряда взаимодействуют силой Кулона; знак заряда меняет направление движения.', model: 'Заряды свободны; формула в инспекторе использует начальное заданное расстояние. Для повторного опыта нажмите перезапуск. Значение со знаком: плюс — отталкивание. q вводится в микрокулонах;"], [16251, 16381, " q в Кл, E в Н/Кл. На холсте это настоящее действующее поле; заряд можно переместить в другое поле.', params: [p('q', 'q', 'Заряд', 'Кл', -2, 2, 0.1, 1), p('E', 'E', 'Напряжённость', 'Н/Кл', 0, 8, 0.1, 2)] }"], [16670, 17003, " знак q меняет направление вращения.', model: 'Схематичная частица массой 1 кг, q в кулонах. Радиус mv/(|q|B) вычисляется отдельно. При q=0 или B=0 движение прямолинейное. Точки: B направлено к наблюдателю. В отдельной букве B доступна смена знака и направления поля.', params: [p('q', 'q', 'Заряд', 'Кл', -2, 2, 0.1, 1), velocity(), p('B', 'B', 'Магнитная индукция', 'Тл', 0, 3, 0.1, 1)] }"]]},
]
