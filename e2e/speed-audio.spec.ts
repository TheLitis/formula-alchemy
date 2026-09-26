import { test, expect, type Page } from '@playwright/test';
import { SOUND_IDS } from '../src/audio/sounds';
// The global QA hook's type is declared once in game.spec.ts; production has no hook.
async function ready(page: Page) {
    await page.goto('./?qa=1');
    await expect(page.locator('.board canvas')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>!!window.__alchemyTest)).toBe(true);
    await page.evaluate(()=>window.__alchemyTest.store.patch({paused:true}));
}
async function stateStep(page: Page,seconds=.4) {
    await page.evaluate(seconds=>{const {store,runtime}=window.__alchemyTest;store.patch({paused:false});for(let i=0;i<Math.round(seconds*120);i++)runtime.advance(1/120);store.patch({paused:true});},seconds);
    await page.waitForTimeout(70);
}
async function specimen(page: Page,recipe='kinetic') {
    const id=await page.evaluate(recipe=>{const {store,runtime}=window.__alchemyTest;store.reset();runtime.reset();store.openRecipe(recipe);store.patch({lab:'sandbox',activeId:null,selectedId:null,paused:true});return store.getState().nodes[0].id;},recipe);
    await page.waitForTimeout(80);return id;
}
async function canvasPoint(page:Page,x:number,y:number){return page.evaluate(({x,y})=>{const {renderer:r}=window.__alchemyTest,b=r.canvas.getBoundingClientRect(),v=r.viewport;return{x:b.left+v.ox+x*v.scale,y:b.top+v.oy+y*v.scale};},{x,y});}
async function unlock(page:Page){
    await page.getByRole('button',{name:'Книга формул',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.audio.status().loaded.length)).toBe(SOUND_IDS.length);
    await page.getByRole('button',{name:'Закрыть окно'}).click();
}
const errors=new WeakMap<Page,string[]>();
test.beforeEach(async({page})=>{const e:string[]=[];errors.set(page,e);page.on('pageerror',x=>e.push(x.message));await ready(page);});
test.afterEach(async({page})=>{expect(errors.get(page)??[]).toEqual([]);});

test('current body speed on Canvas/inspector; changing time scale does not relabel physical velocity',async({page},info)=>{
    const id=await specimen(page);
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.renderer.speedLabels.map(v=>v.text))).toEqual(['4,0 м/с']);
    await page.evaluate(()=>window.__alchemyTest.store.patch({speed:4}));await page.waitForTimeout(60);
    expect(await page.evaluate(()=>window.__alchemyTest.renderer.speedLabels[0].text)).toBe('4,0 м/с');
    const pos=await page.evaluate(id=>window.__alchemyTest.runtime.world.bodies.get(`${id}/0`)!.body.position,id),p=await canvasPoint(page,pos.x,pos.y);
    await page.mouse.click(p.x,p.y);
    await expect(page.getByTestId('speed-readout')).toBeVisible();
    await expect(page.getByTestId('speed-readout')).toContainText('4,0 м/с');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('.board .formula,.effect-card,.node-anchor,.canvas-node')).toHaveCount(0);
    if(await page.locator('.inspector-close').isVisible())await page.locator('.inspector-close').click();
    await page.screenshot({path:info.outputPath('speed-body.png'),fullPage:true});
});

test('a falling body gets an increasing live label; pause freezes label and pixels',async({page})=>{
    await specimen(page,'weight');await stateStep(page,.25);
    const v1=await page.evaluate(()=>window.__alchemyTest.renderer.speedLabels[0].value);
    await stateStep(page,.25);const v2=await page.evaluate(()=>window.__alchemyTest.renderer.speedLabels[0].value);
    expect(v2).toBeGreaterThan(v1);
    const pixels=await page.locator('.board canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL());
    await page.waitForTimeout(180);
    expect(await page.locator('.board canvas').evaluate((c:HTMLCanvasElement)=>c.toDataURL())).toBe(pixels);
});

test('no field/dust speeds; calibrated satellite and wave units; independent persistent speed visibility',async({page},info)=>{
    await specimen(page,'blackhole');
    await page.evaluate(()=>{const{store}=window.__alchemyTest;store.addToken('E',250,300);store.addToken('B',700,300);});await page.waitForTimeout(80);
    expect(await page.evaluate(()=>window.__alchemyTest.renderer.speedLabels.length)).toBe(0);
    await specimen(page,'gravitation');
    expect(await page.evaluate(()=>window.__alchemyTest.renderer.speedLabels[0].unit)).toBe('км/с');
    await page.screenshot({path:info.outputPath('speed-orbit.png'),fullPage:true});
    await specimen(page,'wave');
    expect(await page.evaluate(()=>window.__alchemyTest.renderer.speedLabels[0].text)).toMatch(/^волна .* м\/с$/);
    await page.getByLabel('Настройки отображения').click();
    await page.getByLabel('Скорости тел',{exact:true}).uncheck();
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.renderer.speedLabels.length)).toBe(0);
    expect(await page.evaluate(()=>window.__alchemyTest.store.getState().vectors)).toBe(true);
    await page.getByLabel('Настройки отображения').click();
    await page.getByRole('button',{name:'Сохранить',exact:true}).click();
    await page.getByLabel('Название эксперимента').fill('Без подписей скорости');
    await page.getByRole('dialog').getByRole('button',{name:'Сохранить',exact:true}).click();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('formula-alchemy:slots:v1')!)[0].state.speeds)).toBe(false);
});

test('all bundled samples load once via the Pages subpath and decode to real waveforms',async({page})=>{
    const requests:string[]=[];page.on('request',r=>{if(r.url().endsWith('.wav'))requests.push(r.url());});
    expect(await page.evaluate(()=>window.__alchemyTest.audio.status().state)).toBe('locked');
    await unlock(page);
    expect(requests.length).toBe(SOUND_IDS.length);
    expect(new Set(requests).size).toBe(SOUND_IDS.length);
    for(const url of requests)expect(new URL(url).pathname).toMatch(/^\/formula-alchemy\/audio\/[a-z-]+\.wav$/);
    const result=await page.evaluate(()=>{
        const bank=Reflect.get(window.__alchemyTest.audio,'buffers') as Map<string,AudioBuffer>;
        return [...bank].map(([id,b])=>{const data=b.getChannelData(0);let max=0,sum=0;for(const v of data){max=Math.max(max,Math.abs(v));sum+=v*v;}return{id,duration:b.duration,max,rms:Math.sqrt(sum/data.length)};});
    });
    for(const sample of result){expect(sample.duration).toBeGreaterThan(.04);expect(sample.max).toBeGreaterThan(.01);expect(sample.max).toBeLessThan(.72);expect(sample.rms).toBeGreaterThan(.001);}
    await page.evaluate(()=>window.__alchemyTest.audio.unlock());
    expect(requests.length).toBe(SOUND_IDS.length);
});

test('real Web Audio produces a signal, mute silences it immediately, music toggle stays independent',async({page})=>{
    await unlock(page);
    const before=await page.evaluate(()=>{
        const audio=window.__alchemyTest.audio,ctx=Reflect.get(audio,'ctx') as AudioContext;
        const analyser=ctx.createAnalyser();analyser.fftSize=1024;
        (Reflect.get(audio,'compressor') as DynamicsCompressorNode).connect(analyser);
        Reflect.set(window,'__soundAnalyser',analyser);
        audio.blackhole();return audio.status().played.blackhole??0;
    });
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.audio.status().played.blackhole??0)).toBeGreaterThan(before);
    await expect.poll(()=>page.evaluate(()=>{const a=Reflect.get(window,'__soundAnalyser') as AnalyserNode;const x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);return Math.max(...x.map(Math.abs));}),{timeout:3000}).toBeGreaterThan(.001);
    await page.getByRole('button',{name:'Выключить звуки',exact:true}).click();
    expect(await page.evaluate(()=>window.__alchemyTest.audio.status().activeEffects)).toBe(0);
    await page.waitForTimeout(160);
    expect(await page.evaluate(()=>{const a=Reflect.get(window,'__soundAnalyser') as AnalyserNode;const x=new Float32Array(a.fftSize);a.getFloatTimeDomainData(x);return Math.max(...x.map(Math.abs));})).toBeLessThan(.0001);
    await page.getByRole('button',{name:'Включить музыку',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.audio.status().music)).toBe(true);
    expect(await page.evaluate(()=>window.__alchemyTest.audio.status().sound)).toBe(false);
    await page.getByRole('button',{name:'Выключить музыку',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.audio.status().activeNotes)).toBe(0);
});

test('successful in-game craft uses the downloaded discovery sample, without synthesized SFX',async({page})=>{
    await unlock(page);
    const before=await page.evaluate(()=>window.__alchemyTest.audio.status().played.discovery??0);
    const from=await canvasPoint(page,690,300),to=await canvasPoint(page,350,300);
    await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:8});await page.mouse.up();
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.store.getState().nodes[0].recipeId)).toBe('weight');
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.audio.status().played.discovery??0)).toBe(before+1);
    expect(await page.evaluate(()=>window.__alchemyTest.audio.status().activeNotes)).toBe(0);
});

test('mute during a delayed sample load never resurrects the queued click',async({page})=>{
    let release!:()=>void;const delay=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/audio/*.wav',async route=>{await delay;await route.continue();});
    await page.getByRole('button',{name:'Книга формул',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.audio.status().state)).toBe('running');
    // Modal overlay hides the header; state command exercises the same synchronous mute setter.
    await page.evaluate(()=>window.__alchemyTest.store.patch({sound:false}));
    release();
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.audio.status().loaded.length)).toBe(SOUND_IDS.length);
    expect(await page.evaluate(()=>window.__alchemyTest.audio.status().activeEffects)).toBe(0);
    expect(await page.evaluate(()=>window.__alchemyTest.audio.status().played)).toEqual({});
});
