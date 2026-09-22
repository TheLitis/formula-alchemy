import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useGame, useRuntimeTick, useSession } from '../app/session';
import { usePointerCraft } from '../app/usePointerCraft';
import { RECIPE_MAP, RECIPES } from '../core/catalog';
import { SYMBOL_MAP } from '../core/symbols';
import { MAX_BODIES } from '../core/types';
import { clamp } from '../core/store';
import { CanvasRenderer, getViewport, toWorld } from '../rendering/Renderer';
import { Formula } from './Formula';
import { Icon } from './Icon';
function StatusBar() {
    const runtime = useRuntimeTick(), state = useGame();
    return <div className="stage-status"><span><span className={`live-indicator ${state.paused ? 'paused' : ''}`}/>{state.paused ? 'Пауза' : 'Симуляция'} <span className="status-time">{runtime.time.toFixed(1)} с</span></span><span className="status-center">{state.nodes.length} элементов · {runtime.world.bodies.size}/{MAX_BODIES} тел</span><span>{state.discoveries.length} / {RECIPES.length} открытий</span></div>;
}
export function Stage({ onReset, onHelp, onInspect }: {
    onReset: () => void;
    onHelp: () => void;
    onInspect: () => void;
}) {
    const { store, runtime, audio } = useSession(), state = useGame();
    const board = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), renderer = useRef<CanvasRenderer | null>(null);
    const [viewport, setViewport] = useState(getViewport(1000, 680)), [renderError, setRenderError] = useState('');
    const apparatusDrag = useRef<'body' | 'gas' | 'snell' | null>(null);
    usePointerCraft(board, renderer);
    const selected = state.nodes.find(n => n.id === state.activeId), recipe = selected?.recipeId ? RECIPE_MAP[selected.recipeId] : null;
    const isWelcome = state.discoveries.length === 0 && state.nodes.length === 2 && state.nodes.every(n => n.id.startsWith('seed-')) && !state.selectedId;
    useEffect(() => {
        if (!canvas.current || !board.current)
            return;
        let draw: CanvasRenderer;
        try {
            draw = new CanvasRenderer(canvas.current);
        }
        catch (e) {
            setRenderError((e as Error).message);
            return;
        }
        renderer.current = draw;
        const resize = () => { const r = board.current!.getBoundingClientRect(); if (r.width < 1 || r.height < 1)
            return; draw.resize(r.width, r.height); setViewport(draw.viewport); };
        const observer = new ResizeObserver(resize);
        observer.observe(board.current);
        resize();
        let request = 0, last = performance.now(), failed = false;
        const frame = (now: number) => {
            const elapsed = (now - last) / 1000;
            last = now;
            if (!document.hidden && !failed) {
                try {
                    runtime.advance(elapsed);
                    draw.render(store.getState(), runtime);
                }
                catch (error) {
                    failed = true;
                    setRenderError((error as Error).message);
                    store.patch({ paused: true });
                }
            }
            request = requestAnimationFrame(frame);
        };
        request = requestAnimationFrame(frame);
        return () => { cancelAnimationFrame(request); observer.disconnect(); renderer.current = null; };
    }, [store, runtime]);
    const point = (event: ReactPointerEvent<HTMLCanvasElement>) => { const r = board.current!.getBoundingClientRect(); return toWorld(renderer.current!.viewport, event.clientX - r.left, event.clientY - r.top); };
    const updateApparatus = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!renderer.current)
            return;
        const p = point(event), active = store.getState().nodes.find(n => n.id === store.getState().activeId);
        if (apparatusDrag.current === 'body')
            runtime.world.drag(p.x, p.y);
        if (active && apparatusDrag.current === 'gas')
            store.setParam(active.id, 'V', clamp(5 + (490 - p.y) * 45 / 260, 5, 50));
        if (active && apparatusDrag.current === 'snell')
            store.setParam(active.id, 'theta', clamp(Math.atan2(Math.abs(500 - p.x), Math.max(1, 345 - p.y)) * 180 / Math.PI, 0, 85));
    };
    const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
        if (!renderer.current || event.button !== 0)
            return;
        const p = point(event);
        void audio.unlock().catch(() => { });
        if (state.lab === 'sandbox' && runtime.world.pick(p.x, p.y))
            apparatusDrag.current = 'body';
        else if (recipe?.id === 'idealGas' && p.x > 275 && p.x < 665)
            apparatusDrag.current = 'gas';
        else if (recipe?.id === 'snell' && p.y < 345)
            apparatusDrag.current = 'snell';
        if (apparatusDrag.current) {
            event.currentTarget.setPointerCapture(event.pointerId);
            event.preventDefault();
            updateApparatus(event);
        }
    };
    const pointerUp = () => { runtime.world.release(); apparatusDrag.current = null; };
    const addBody = () => { const result = runtime.world.spawn(150 + Math.random() * 650, 220 + Math.random() * 150); if (!result)
        store.notify(`Лимит ${MAX_BODIES} физических тел достигнут.`, 'error');
    else {
        store.patch({ lab: 'sandbox', activeId: null });
        audio.click();
    } };
    return <main className="workspace" aria-label="Лаборатория Formula Alchemy">
    <div className="stage-top"><div className="stage-mode"><Icon name="flask" size={17}/><span>{state.lab === 'sandbox' ? 'Свободная песочница' : recipe?.title}</span>{state.lab !== 'sandbox' && <button onClick={() => store.patch({ lab: 'sandbox', activeId: null, selectedId: null })} className="text-button">На холст <Icon name="arrow" size={14}/></button>}</div><div className="stage-view-tools">
      <details className="view-menu"><summary aria-label="Настройки отображения" title="Отображение"><Icon name="settings" size={17}/></summary><div className="view-options">{(['grid', 'vectors', 'trails'] as const).map((key, i) => <label key={key}><input type="checkbox" checked={state[key]} onChange={e => store.patch({ [key]: e.target.checked })}/>{['Координатная сетка', 'Векторы скорости', 'Следы движения'][i]}</label>)}</div></details>
      <button className="icon-button" title="Управление и ограничения" aria-label="Справка" onClick={onHelp}><Icon name="help" size={17}/></button></div></div>
    <div className="board" ref={board} tabIndex={0} aria-label="Холст. Пробел — пауза. Delete — удалить выбранное.">
      <canvas ref={canvas} onPointerDown={pointerDown} onPointerMove={updateApparatus} onPointerUp={pointerUp} onPointerCancel={pointerUp} onDoubleClick={e => { if (state.lab === 'sandbox' && renderer.current) {
        const r = e.currentTarget.getBoundingClientRect(), p = toWorld(renderer.current.viewport, e.clientX - r.left, e.clientY - r.top);
        if (!runtime.world.spawn(p.x, p.y))
            store.notify('Достигнут лимит тел.', 'error');
    } }} aria-label={recipe ? `${recipe.title}. ${recipe.effect}` : 'Физическая песочница. Перетащите символы друг на друга; тела можно перемещать мышью или касанием.'}/>
      {isWelcome && <div className="stage-welcome"><h1>Формулы оживают.</h1><p>Соедините переменные.<br className="mobile-only"/> Посмотрите, что произойдёт.</p></div>}
      {state.lab === 'sandbox' && state.nodes.map(node => {
            const r = node.recipeId ? RECIPE_MAP[node.recipeId] : null;
            return <button key={node.id} data-node={node.id} data-recipe={node.recipeId ?? ''} className={`canvas-node ${r ? 'node-formula' : node.parts.length > 1 ? 'node-mixture' : 'node-token'} ${state.selectedId === node.id ? 'node-selected' : ''}`} style={{ left: viewport.ox + node.x * viewport.scale, top: viewport.oy + node.y * viewport.scale }} aria-label={r ? r.title : node.parts.map(id => SYMBOL_MAP[id].name).join(' + ')} aria-pressed={state.selectedId === node.id} onClick={e => { if (e.detail === 0)
                store.select(node.id); }}>
          {r && <span className="node-formula-mark"><Icon name="check" size={11}/></span>}<Formula tex={r ? r.tex : node.parts.map(id => SYMBOL_MAP[id].tex).join('\\,')}/>{!r && node.parts.length > 1 && <span className="mixture-dots">···</span>}
        </button>;
        })}
      {isWelcome && <div className="seed-hint"><span>m</span><span>+</span><span>g</span><Icon name="arrow" size={18}/><span>?</span></div>}
      {!state.nodes.length && <div className="empty-canvas"><h2>Новая гипотеза?</h2><p>Выберите переменную или начните с примера.</p><button className="button outline" onClick={() => store.prepareRecipe('weight')}>Положить m и g на холст <Icon name="plus"/></button></div>}
      {state.lab !== 'sandbox' && recipe && selected && <div className="lab-heading"><Formula tex={recipe.tex}/>{recipe.lab === 'circuits' && <button className="button tiny outline" onClick={() => store.toggleCircuit(selected.id)}>{selected.closed ? 'Разомкнуть' : 'Замкнуть'} <span className={`circuit-dot ${selected.closed ? 'is-on' : ''}`}/></button>}</div>}
      {renderError && <div className="render-error" role="alert"><h2>Симуляция остановлена</h2><p>{renderError}</p><p>Сохраните эксперимент и перезагрузите страницу. Книга и экспорт остаются доступны.</p></div>}
    </div>
    <div className="simulation-toolbar"><div className="playback"><button className="play-button" aria-label={state.paused ? 'Продолжить симуляцию' : 'Приостановить симуляцию'} title="Пробел" onClick={() => store.patch({ paused: !state.paused })}><Icon name={state.paused ? 'play' : 'pause'} size={17}/></button><label className="sr-only" htmlFor="simulation-speed">Скорость симуляции</label><select id="simulation-speed" value={state.speed} onChange={e => store.patch({ speed: Number(e.target.value) })}><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></div>
      <span className="toolbar-separator"/><button className="toolbar-button" onClick={addBody}><Icon name="plus" size={17}/><span>Тело</span></button><button className="toolbar-button parameters-trigger" onClick={onInspect}><Icon name="sliders" size={17}/><span>Параметры</span></button><span className="toolbar-spacer"/><button className="toolbar-button" data-trash onClick={onReset} aria-label="Очистить эксперимент" title="Очистить холст"><Icon name="reset" size={17}/><span className="toolbar-reset-label">Сброс</span></button>
    </div>
    <StatusBar />
  </main>;
}
