import { useEffect, useRef } from 'react';
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
