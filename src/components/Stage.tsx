import { useEffect, useRef, useState } from 'react';
import { useGame, useRuntimeTick, useSession } from '../app/session';
import { usePointerCraft } from '../app/usePointerCraft';
import { RECIPE_MAP, RECIPES } from '../core/catalog';
import { MAX_BODIES } from '../core/types';
import { CanvasRenderer } from '../rendering/Renderer';
import { EditorToolbar } from './EditorToolbar';
import { Icon } from './Icon';
function StatusBar() {
    const runtime = useRuntimeTick(), state = useGame();
    return <div className="stage-status"><span><span className={`live-indicator ${state.paused ? 'paused' : ''}`}/>{state.paused ? 'Пауза' : 'Симуляция'} <span className="status-time">{runtime.time.toFixed(1)} с</span></span><span className="status-center">{state.nodes.length} элементов · {runtime.world.bodies.size}/{MAX_BODIES} тел</span><span>{state.discoveries.length} / {RECIPES.length} открытий</span></div>;
}
export function Stage({ onReset, onHelp, onInspect }: { onReset: () => void; onHelp: () => void; onInspect: () => void }) {
    const { store, runtime, audio, editor } = useSession(), state = useGame();
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
        if (new URLSearchParams(location.search).has('qa') || (window as unknown as Record<string, unknown>).__ALCHEMY_QA__ === true) (window as unknown as Record<string, unknown>).__alchemyTest = { store, runtime, renderer: draw, audio, editor };
        return () => { cancelAnimationFrame(request); observer.disconnect(); draw.dispose(); renderer.current = null; delete (window as unknown as Record<string, unknown>).__alchemyTest; };
    }, [store, runtime, audio, editor]);
    return <main className="workspace" aria-label="Лаборатория Formula Alchemy">
        <div className="stage-top"><div className="stage-mode"><Icon name="flask" size={17}/><span>{state.lab === 'sandbox' ? 'Свободная песочница' : recipe?.title}</span>{state.lab !== 'sandbox' && <button className="text-button" onClick={() => store.patch({ lab: 'sandbox', activeId: null })}>На холст <Icon name="arrow" size={14}/></button>}</div><div className="stage-view-tools">
            <details className="view-menu"><summary aria-label="Настройки отображения"><Icon name="settings" size={17}/></summary><div className="view-options">{(['grid', 'vectors', 'speeds', 'trails'] as const).map((key, i) => <label key={key}><input type="checkbox" checked={state[key]} onChange={e => store.patch({ [key]: e.target.checked })}/>{['Координатная сетка', 'Векторы скорости', 'Скорости тел', 'Следы движения'][i]}</label>)}</div></details>
            <button className="icon-button" aria-label="Справка" onClick={onHelp}><Icon name="help" size={17}/></button></div></div>
        <EditorToolbar/>
        <div className="board" ref={board}>
            <canvas ref={canvas} tabIndex={0} aria-label="Физическая песочница. Нажмите на объект для формулы справа. Тяните подвижную деталь. Alt — перенос всей установки. Рамка выделяет группу. Ctrl-клик выбирает отдельные объекты. R/Q — поворот, Ctrl-Z — отмена, Ctrl-C/X/V — буфер, WASD/стрелки — перенос, Shift — медленно, пробел — пауза, Delete — удаление."/>
            {renderError && <div className="render-error" role="alert"><h2>Симуляция остановлена</h2><p>{renderError}</p><p>Сохранения и экспорт остаются доступны.</p></div>}
        </div>
        <div className="simulation-toolbar"><div className="playback"><button className="play-button" aria-label={state.paused ? 'Продолжить симуляцию' : 'Приостановить симуляцию'} onClick={() => store.patch({ paused: !state.paused })}><Icon name={state.paused ? 'play' : 'pause'} size={17}/></button><label className="sr-only" htmlFor="simulation-speed">Скорость симуляции</label><select id="simulation-speed" value={state.speed} onChange={e => store.patch({ speed: Number(e.target.value) })}><option value="0.25">¼×</option><option value="0.5">½×</option><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></div>
            <span className="toolbar-separator"/><button className="toolbar-button" onClick={() => store.addToken('m')}><Icon name="plus" size={17}/><span>Тело</span></button><button className="toolbar-button parameters-trigger" onClick={onInspect}><Icon name="sliders" size={17}/><span>Параметры</span></button><span className="toolbar-spacer"/><button className="toolbar-button" data-trash onClick={onReset} aria-label="Очистить эксперимент"><Icon name="reset" size={17}/><span className="toolbar-reset-label">Сброс</span></button>
        </div><StatusBar/>
    </main>;
}
