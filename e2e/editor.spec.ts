import { test, expect, type Page } from '@playwright/test';
import { SOUNDS } from '../src/audio/sounds';

async function screen(page:Page,x:number,y:number){return page.evaluate(({x,y})=>{const r=window.__alchemyTest.renderer,v=r.viewport,b=r.canvas.getBoundingClientRect();return{x:b.left+v.ox+x*v.scale,y:b.top+v.oy+y*v.scale};},{x,y});}
async function seed(page:Page,items:{symbol:string;x:number;y:number}[]){
    const ids=await page.evaluate(items=>{const {store:s,runtime:r,editor:e}=window.__alchemyTest;s.reset();r.reset();s.patch({paused:true,lab:'sandbox',selectedId:null,activeId:null});const ids=items.map(n=>s.addToken(n.symbol,n.x,n.y)!);e.history.clear();return ids;},items);
    await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.renderer.hits.targets().length)).toBeGreaterThan(0);await page.waitForTimeout(35);return ids;
}
async function click(page:Page,x:number,y:number){const p=await screen(page,x,y);await page.mouse.click(p.x,p.y);}
async function frame(page:Page,x:number,y:number,x2:number,y2:number,modifier?:'Shift'|'Control'){
    if(modifier)await page.keyboard.down(modifier);
    const a=await screen(page,x,y),b=await screen(page,x2,y2);
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();
    if(modifier)await page.keyboard.up(modifier);
}
async function selected(page:Page){return page.evaluate(()=>window.__alchemyTest.editor.ids);}
async function closeInspector(page:Page){const button=page.getByRole('button',{name:'Закрыть параметры',exact:true});if(await button.isVisible())await button.click();}
async function snapshot(page:Page){return page.evaluate(()=>({state:window.__alchemyTest.store.getState(),runtime:window.__alchemyTest.runtime.snapshot()}));}

let errors:string[]=[];
test.beforeEach(async({page})=>{
    errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto('./?qa=1');await expect(page.locator('.board canvas')).toBeVisible();
    await expect.poll(()=>page.evaluate(()=>!!window.__alchemyTest?.editor)).toBe(true);
    await page.evaluate(()=>window.__alchemyTest.store.patch({paused:true}));
});
test.afterEach(()=>{expect(errors).toEqual([]);});

test('marquee selects several actual glyphs; Shift adds an area and Ctrl toggles particular objects',async({page})=>{
    const ids=await seed(page,[{symbol:'c',x:220,y:220},{symbol:'v',x:380,y:250},{symbol:'a',x:720,y:380}]);
    await frame(page,150,150,460,300);expect(await selected(page)).toEqual(ids.slice(0,2));
    await frame(page,650,310,800,440,'Shift');expect(await selected(page)).toEqual(ids);
    await page.keyboard.down('Control');await click(page,380,250);await page.keyboard.up('Control');
    expect(await selected(page)).toEqual([ids[0],ids[2]]);await closeInspector(page);
    await page.keyboard.down('Control');await click(page,380,250);await page.keyboard.up('Control');
    expect((await selected(page)).sort()).toEqual([...ids].sort());await closeInspector(page);
    await page.screenshot({path:test.info().outputPath('multi-selection.png')});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('Shift can begin an additive marquee on top of an existing object without dragging it',async({page})=>{
    const ids=await seed(page,[{symbol:'c',x:300,y:260},{symbol:'v',x:430,y:290},{symbol:'a',x:700,y:450}]);
    await frame(page,660,410,750,490);
    await frame(page,300,260,490,340,'Shift');expect((await selected(page)).sort()).toEqual([...ids].sort());
    expect((await snapshot(page)).state.nodes.map(n=>[n.x,n.y])).toEqual([[300,260],[430,290],[700,450]]);
});

test('group drag and R while held update before release, preserve offsets, and undo as one edit',async({page})=>{
    const ids=await seed(page,[{symbol:'c',x:270,y:250},{symbol:'a',x:450,y:250}]);
    await frame(page,200,180,500,310);const before=await snapshot(page);
    const start=await screen(page,270,250),to=await screen(page,310,280),further=await screen(page,340,280);
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:6});await page.keyboard.press('KeyR');
    let current=await snapshot(page);expect(current.state.nodes.every(n=>n.rotation===15)).toBe(true);
    const rotated=current.state.nodes.map(n=>({x:n.x,y:n.y}));
    await page.mouse.move(further.x,further.y,{steps:4});current=await snapshot(page);
    for(let i=0;i<2;i++){expect(current.state.nodes[i].x-rotated[i].x).toBeCloseTo(30,0);expect(current.state.nodes[i].y).toBeCloseTo(rotated[i].y,0);}
    expect(Math.hypot(current.state.nodes[0].x-current.state.nodes[1].x,current.state.nodes[0].y-current.state.nodes[1].y)).toBeCloseTo(180,1);
    await page.mouse.up();expect(await page.evaluate(()=>window.__alchemyTest.editor.history.getState().count)).toBe(1);
    await page.keyboard.press('Control+KeyZ');expect((await snapshot(page)).state.nodes).toEqual(before.state.nodes);
    await page.keyboard.press('Control+Shift+KeyZ');expect((await snapshot(page)).state.nodes.map(n=>n.rotation)).toEqual([15,15]);expect(await selected(page)).toEqual(ids);
});

test('R works immediately after pointerdown, with a Russian key value and no jump',async({page})=>{
    const [id]=await seed(page,[{symbol:'E',x:500,y:300}]);const p=await screen(page,506,310);
    await page.mouse.move(p.x,p.y);await page.mouse.down();
    // Physical code is KeyR, even though a Russian layout supplies "к" as its text key.
    await page.locator('.board canvas').dispatchEvent('keydown',{key:'к',code:'KeyR',bubbles:true});
    const s=await snapshot(page);expect(s.state.nodes[0]).toMatchObject({id,x:500,y:300,rotation:15});
    await page.mouse.up();await page.screenshot({path:test.info().outputPath('rotated-field.png')});await page.keyboard.press('Shift+KeyR');expect((await snapshot(page)).state.nodes[0].rotation).toBe(0);
    await page.keyboard.press('Control+KeyZ');expect((await snapshot(page)).state.nodes[0].rotation).toBe(15);
});

test('Delete after toolbar button focus removes all selected objects; Ctrl-Z and Ctrl-Y restore/delete them',async({page})=>{
    const ids=await seed(page,[{symbol:'m',x:260,y:240},{symbol:'c',x:470,y:320}]);await frame(page,200,180,530,380);
    await page.getByRole('button',{name:'Повернуть выбранное',exact:true}).click();
    await page.keyboard.press('Delete');expect((await snapshot(page)).state.nodes).toHaveLength(0);
    await page.keyboard.press('Control+KeyZ');expect((await snapshot(page)).state.nodes.map(n=>n.id)).toEqual(ids);
    await page.keyboard.press('Control+KeyY');expect((await snapshot(page)).state.nodes).toHaveLength(0);
});

test('text inputs keep native Delete, Ctrl-A and Ctrl-Z; dialogs never delete scene objects',async({page})=>{
    const ids=await seed(page,[{symbol:'m',x:300,y:250}]);await click(page,300,250);
    const field=page.getByRole('spinbutton',{name:'Масса, численно',exact:true});await field.focus();await page.keyboard.press('Control+KeyA');await page.keyboard.press('Delete');
    expect((await snapshot(page)).state.nodes.map(n=>n.id)).toEqual(ids);await page.keyboard.press('Control+KeyZ');expect((await snapshot(page)).state.nodes.map(n=>n.id)).toEqual(ids);
    await closeInspector(page);await page.getByRole('button',{name:'Сохранить',exact:true}).click();
    await page.locator('#experiment-name').fill('abc');await page.keyboard.press('Backspace');expect((await snapshot(page)).state.nodes).toHaveLength(1);
    await page.locator('[role="dialog"]').click({position:{x:10,y:10}});await page.keyboard.press('Delete');expect((await snapshot(page)).state.nodes).toHaveLength(1);
});

test('returning a group to the palette deletes it with visible feedback; undo restores both items',async({page})=>{
    const ids=await seed(page,[{symbol:'c',x:260,y:230},{symbol:'v',x:430,y:280}]);await frame(page,200,160,500,340);
    const before=await snapshot(page),p=await screen(page,260,230),palette=await page.locator('[data-palette-return]').boundingBox();
    await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(palette!.x+palette!.width/2,palette!.y+palette!.height/2,{steps:12});
    await expect(page.locator('.palette-return-active')).toHaveCount(1);await page.mouse.up();expect((await snapshot(page)).state.nodes).toHaveLength(0);
    await page.keyboard.press('Control+KeyZ');expect((await snapshot(page)).state.nodes).toEqual(before.state.nodes);expect(await selected(page)).toEqual(ids);
});

test('Escape, pointercancel and Ctrl-Z during a drag restore the original state without a phantom release edit',async({page})=>{
    const [id]=await seed(page,[{symbol:'c',x:400,y:300}]);
    for(const mode of ['Escape','Control+KeyZ','pointercancel']){
        const p=await screen(page,400,300),q=await screen(page,510,350);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:6});await page.keyboard.press('KeyR');
        if(mode==='pointercancel')await page.locator('.board canvas').dispatchEvent('pointercancel',{pointerId:1,isPrimary:true});else await page.keyboard.press(mode);
        await page.mouse.up();expect((await snapshot(page)).state.nodes[0]).toMatchObject({id,x:400,y:300});expect((await snapshot(page)).state.nodes[0].rotation??0).toBe(0);
        expect(await page.evaluate(()=>window.__alchemyTest.editor.history.active)).toBe(false);
    }
});

test('Ctrl-A, duplicate, fine/slower nudge, and Delete/Backspace share the editor commands',async({page})=>{
    const ids=await seed(page,[{symbol:'m',x:260,y:230},{symbol:'c',x:460,y:320}]);await page.locator('.board canvas').focus();await page.keyboard.press('Control+KeyA');expect(await selected(page)).toEqual(ids);
    await page.keyboard.press('Control+KeyD');expect((await snapshot(page)).state.nodes).toHaveLength(4);const copies=await selected(page);expect(copies).toHaveLength(2);
    const x=(await snapshot(page)).state.nodes.at(-1)!.x;await page.keyboard.press('Alt+ArrowRight');await page.keyboard.press('Shift+ArrowRight');expect((await snapshot(page)).state.nodes.at(-1)!.x).toBeCloseTo(x+3,3);
    await page.keyboard.press('Backspace');expect((await snapshot(page)).state.nodes.map(n=>n.id)).toEqual(ids);
});

test('touch selection mode and toolbar rotation/undo work without a hardware keyboard',async({page})=>{
    const ids=await seed(page,[{symbol:'c',x:300,y:240},{symbol:'a',x:420,y:300}]);await page.getByRole('button',{name:'Выделение рамкой',exact:true}).click();
    const p=await screen(page,230,180),q=await screen(page,500,360),canvas=page.locator('.board canvas');
    await canvas.dispatchEvent('pointerdown',{pointerId:82,pointerType:'touch',isPrimary:true,button:0,clientX:p.x,clientY:p.y});
    await canvas.dispatchEvent('pointermove',{pointerId:82,pointerType:'touch',isPrimary:true,clientX:q.x,clientY:q.y});
    await canvas.dispatchEvent('pointerup',{pointerId:82,pointerType:'touch',isPrimary:true,clientX:q.x,clientY:q.y});expect(await selected(page)).toEqual(ids);
    await page.getByRole('button',{name:'Повернуть выбранное',exact:true}).click();expect((await snapshot(page)).state.nodes.map(n=>n.rotation)).toEqual([15,15]);
    await page.getByRole('button',{name:'Отменить действие',exact:true}).click();expect((await snapshot(page)).state.nodes.map(n=>n.rotation??0)).toEqual([0,0]);
});

test('rotated scene persists and remains directly pickable after reload; shortcuts help is discoverable',async({page})=>{
    const [id]=await seed(page,[{symbol:'E',x:460,y:300}]);const p=await screen(page,460,300);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.keyboard.press('KeyR');await page.mouse.up();
    await page.keyboard.press('Control+KeyS');await page.locator('#experiment-name').fill('rotated editor');await page.locator('.save-new').getByRole('button',{name:'Сохранить',exact:true}).click();
    await page.reload();await expect.poll(()=>page.evaluate(()=>!!window.__alchemyTest)).toBe(true);expect((await snapshot(page)).state.nodes[0]).toMatchObject({id,rotation:15});
    await click(page,460,300);await closeInspector(page);await page.getByRole('button',{name:'Справка',exact:true}).click();await expect(page.getByText('Ctrl / ⌘ + Z', {exact:true})).toBeVisible();
});

test('mellow click is a real, short wood waveform; approved audio and music are still present',async({page})=>{
    await page.getByRole('button',{name:'Книга формул',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__alchemyTest.audio.status().loaded.length)).toBe(10);
    const response=await page.request.get('./audio/credits.json'),m=await response.json();
    expect(m.files.find((f:any)=>f.file===SOUNDS.click.file).originalFile).toContain('impactWood');
    expect(m.music.sha256).toBe('38b7b571b93b0df53b4f3f6832f9432c0a32906383a5de1c0e9db33b22ed3156');
    const data=await page.evaluate(()=>{const a=Reflect.get(window.__alchemyTest.audio,'buffers') as Map<string,AudioBuffer>;const b=a.get('click')!,x=b.getChannelData(0);return{duration:b.duration,peak:Math.max(...x.map(Math.abs))};});
    expect(data.duration).toBeGreaterThan(.06);expect(data.duration).toBeLessThan(.22);expect(data.peak).toBeLessThan(.41);expect(data.peak).toBeGreaterThan(.1);
});
