import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { useSession } from './session';
import { candidates } from '../core/crafting';
import { SYMBOL_MAP } from '../core/symbols';
import { tokenGlyph } from '../core/entities';
import { WIDTH, HEIGHT } from '../core/types';
import { clamp } from '../core/store';
import { boxFromPoints, normalizeAngle } from '../editor/geometry';
import { PartGesture } from '../editor/Parts';
import { toWorld } from '../rendering/Renderer';
import type { CanvasRenderer } from '../rendering/Renderer';
import type { SceneTarget } from '../rendering/interaction';

interface Drag {
    pointer: number; source: HTMLElement; symbol?: string; hit?: SceneTarget;
    sx: number; sy: number; wx: number; wy: number; lastX: number; lastY: number; lastInside: {x:number;y:number};
    moved: boolean; transforming: boolean; mode: 'object' | 'symbol' | 'marquee';
    selectMode: 'replace' | 'add' | 'toggle'; beforeSelection: string[]; angle: number; part?: PartGesture;
}

/** Real geometry + native pointer capture; a part/assembly gesture is exactly one history edit. */
export function usePointerCraft(board: RefObject<HTMLDivElement | null>, renderer: RefObject<CanvasRenderer | null>, onInspect: () => void) {
    const { store, runtime, audio, editor } = useSession(), inspect = useRef(onInspect);
    inspect.current = onInspect;
    useEffect(() => {
        let drag: Drag | null = null, ghost: HTMLDivElement | null = null;
        const point = (x: number, y: number) => { const b = board.current!.getBoundingClientRect(); return toWorld(renderer.current!.viewport, x - b.left, y - b.top); };
        const highlightReturn = (enabled: boolean) => document.querySelectorAll('[data-palette-return]').forEach(el => el.classList.toggle('palette-return-active', enabled));
        const over = (selector: string, x: number, y: number) => [...document.querySelectorAll<HTMLElement>(selector)].some(el => {
            const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
        });
        const clean = () => {
            const d = drag; drag = null;
            if (d) { try { if (d.source.hasPointerCapture(d.pointer)) d.source.releasePointerCapture(d.pointer); } catch { /* Source may have been deleted. */ } }
            ghost?.remove(); ghost = null; highlightReturn(false);
            if (renderer.current) { renderer.current.setFloating(null); renderer.current.craftTarget = null; renderer.current.marquee = null; renderer.current.canvas.style.cursor = 'grab'; }
        };
        const cancel = (): boolean => {
            if (!drag) return false;
            if (drag.part?.active) drag.part.cancel();
            else if (drag.transforming) editor.cancelMove();
            else if (drag.mode === 'marquee') editor.select(drag.beforeSelection);
            clean(); return true;
        };
        const beginTransform = () => {
            if (!drag || drag.mode !== 'object' || !drag.hit || !editor.ids.includes(drag.hit.nodeId)) return false;
            if (!drag.transforming) { if(drag.part)drag.part.begin();else editor.beginMove(); drag.transforming = true; }
            return true;
        };
        editor.cancelPointer = cancel;
        editor.preparePointerTransform = beginTransform;
        editor.rotatePointer = (degrees: number) => {
            if (drag?.symbol) {
                drag.angle = normalizeAngle(drag.angle + degrees);
                if (ghost) ghost.style.rotate = `${drag.angle}deg`;
                return true;
            }
            if(drag?.part){beginTransform();drag.part.rotate(degrees);return true;}
            return false;
        };
        const down = (event: PointerEvent) => {
            if (drag || event.button !== 0 || !event.isPrimary || !renderer.current || !board.current || document.querySelector('[aria-modal="true"]')) return;
            const target = event.target as Element, palette = target.closest<HTMLElement>('[data-symbol]');
            const onCanvas = target === renderer.current.canvas;
            if (!palette && !onCanvas) return;
            event.preventDefault(); window.getSelection()?.removeAllRanges();
            renderer.current.canvas.focus({ preventScroll: true });
            const p = point(event.clientX, event.clientY);
            const hit = onCanvas ? renderer.current.hits.pick(p.x, p.y, undefined, false, 9 / renderer.current.viewport.scale) : null;
            const source = palette ?? renderer.current.canvas;
            const mode = palette ? 'symbol' : !hit || event.shiftKey || editor.selectionMode ? 'marquee' : 'object';
            const selectMode = event.ctrlKey || event.metaKey ? 'toggle' : event.shiftKey ? 'add' : 'replace';
            drag = { pointer: event.pointerId, source, symbol: palette?.dataset.symbol, hit: hit ?? undefined,
                sx: event.clientX, sy: event.clientY, wx: p.x, wy: p.y, lastX: p.x, lastY: p.y, lastInside:p,
                moved: false, transforming: false, mode, selectMode, beforeSelection: [...editor.ids], angle: 0 };
            if (mode === 'object' && hit) {
                if (selectMode === 'toggle') editor.select([hit.nodeId], 'toggle');
                else if (!editor.ids.includes(hit.nodeId)) editor.select([hit.nodeId]);
                if(hit.partId && !event.altKey && !editor.assemblyMode && selectMode==='replace' && editor.ids.length===1)drag.part=new PartGesture(editor,hit,p);
            }
            try { source.setPointerCapture(event.pointerId); } catch { /* Window listeners also handle touch emulation. */ }
            void audio.unlock().catch(() => {});
            if (mode !== 'marquee') audio.click();
        };
        const updateMarquee = (x: number, y: number) => {
            if (!drag || !renderer.current) return;
            const box = boxFromPoints({ x: clamp(drag.wx, 0, WIDTH), y: clamp(drag.wy, 0, HEIGHT) }, { x: clamp(x, 0, WIDTH), y: clamp(y, 0, HEIGHT) });
            renderer.current.marquee = { box, additive: drag.selectMode !== 'replace' };
            const hits = renderer.current.hits.inBox(box);
            const chosen = new Set(drag.selectMode === 'replace' ? [] : drag.beforeSelection);
            for (const id of hits) { if (drag.selectMode === 'toggle' && chosen.has(id)) chosen.delete(id); else chosen.add(id); }
            editor.select([...chosen]);
        };
        const move = (event: PointerEvent) => {
            const draw = renderer.current;
            if (!draw || !board.current) return;
            if (!drag) {
                if (event.target === draw.canvas) {
                    const p = point(event.clientX, event.clientY),hit=draw.hits.pick(p.x,p.y);
                    draw.canvas.style.cursor = event.shiftKey || editor.selectionMode ? 'crosshair' : hit?.partClick?'pointer':hit?'grab':'crosshair';
                    draw.canvas.title=hit?.partLabel??'Потяните объект. Alt — вся установка. Пустое место — рамка.';
                }
                return;
            }
            if (event.pointerId !== drag.pointer) return;
            const p = point(event.clientX, event.clientY);
            const outside=p.x<0||p.y<0||p.x>WIDTH||p.y>HEIGHT;
            if (!drag.moved && Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) > 4) {
                drag.moved = true;
                if (drag.mode === 'object') beginTransform();
                if (drag.symbol) {
                    ghost = document.createElement('div'); ghost.className = 'drag-ghost';
                    ghost.textContent = tokenGlyph({ id: 'ghost', parts: [drag.symbol], x: 0, y: 0, params: {}, revision: 0, closed: true });
                    ghost.style.rotate = `${drag.angle}deg`; document.body.appendChild(ghost);
                }
            }
            if (!drag.moved && !drag.transforming) return;
            if (drag.mode === 'marquee') { draw.canvas.style.cursor = 'crosshair'; updateMarquee(p.x, p.y); return; }
            draw.canvas.style.cursor = 'grabbing';
            if (ghost) { ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`; }
            if (drag.transforming) {
                if(drag.part)drag.part.update(p,outside);else editor.movePointer(p.x-drag.lastX,p.y-drag.lastY);
                if(outside){draw.setFloating({ids:editor.ids,bodyKey:drag.part?.target.bodyKey,
                    offset:drag.part&&!drag.part.target.bodyKey?{x:p.x-drag.lastInside.x,y:p.y-drag.lastInside.y}:undefined});}
                else draw.setFloating(null);
            }
            drag.lastX = p.x; drag.lastY = p.y;if(!outside)drag.lastInside=p;
            highlightReturn(!!drag.hit && over('[data-palette-return]', event.clientX, event.clientY));
            if(drag.part){draw.craftTarget=null;return;}
            const target = draw.hits.pick(p.x, p.y, drag.hit?.nodeId, true, 6 / draw.viewport.scale);
            const a = drag.symbol ? [drag.symbol] : store.getState().nodes.find(n => n.id === drag!.hit?.nodeId)?.parts ?? [];
            const b = target && store.getState().nodes.find(n => n.id === target.nodeId);
            draw.craftTarget = (drag.symbol || editor.ids.length === 1) && b && candidates([...a, ...b.parts]).length ? b.id : null;
        };
        const addSymbol = (d: Drag, x?: number, y?: number) => editor.history.run('Добавление', () => {
            const id = d.symbol && store.addToken(d.symbol, x, y);
            if (id && d.angle) { editor.select([id]); editor.rotate(d.angle); editor.select([]); }
        });
        const finish=()=>{if(drag?.part)drag.part.end();else if(drag?.transforming)editor.endMove();};
        const up = (event: PointerEvent) => {
            if (!drag || event.pointerId !== drag.pointer || !renderer.current || !board.current) return;
            const d = drag, p = point(event.clientX, event.clientY), r = board.current.getBoundingClientRect();
            const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom;
            if (d.mode === 'marquee') {
                if (d.moved) updateMarquee(p.x, p.y);
                else if (d.hit) editor.select([d.hit.nodeId], d.selectMode);
                else if (d.selectMode === 'replace') editor.select([]);
                clean(); return;
            }
            if (!d.moved && !d.transforming) {
                // A direct switch/level is an actuator: do not cover it with the mobile inspector.
                if(d.part&&d.hit?.partClick){d.part.click();clean();return;}
                clean();
                if (d.symbol && SYMBOL_MAP[d.symbol]) addSymbol(d);
                else if (d.hit && editor.ids.includes(d.hit.nodeId) && window.matchMedia('(max-width:1020px)').matches) inspect.current();
                return;
            }
            const returning = over('[data-trash],[data-palette-return]', event.clientX, event.clientY);
            if (returning && d.hit) { store.removeMany(editor.ids); finish();clean();return; }
            if (!inside) { cancel(); return; }
            if(d.part){finish();clean();return;}
            const hit = renderer.current.hits.pick(p.x, p.y, d.hit?.nodeId, true, 6 / renderer.current.viewport.scale);
            const a = d.symbol ? [d.symbol] : store.getState().nodes.find(n => n.id === d.hit?.nodeId)?.parts ?? [];
            const b = hit && store.getState().nodes.find(n => n.id === hit.nodeId);
            if (hit && b && (d.symbol || editor.ids.length === 1) && candidates([...a, ...b.parts]).length) {
                if (d.symbol) store.dropSymbol(d.symbol, b.id, { x: hit.x, y: hit.y });
                else if (d.hit) store.combine(d.hit.nodeId, b.id, { x: hit.x, y: hit.y });
            } else if (d.symbol) { clean(); addSymbol(d, p.x, p.y); return; }
            finish();clean();
        };
        const pointerCancel = (e: PointerEvent) => { if (drag?.pointer === e.pointerId) cancel(); };
        const hidden = () => { if (document.hidden) cancel(); };
        const blur = () => { cancel(); };
        document.addEventListener('pointerdown', down);
        window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', pointerCancel); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', hidden);
        return () => {
            cancel(); editor.cancelPointer = null; editor.preparePointerTransform = null; editor.rotatePointer = null;
            document.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
            window.removeEventListener('pointercancel', pointerCancel); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', hidden);
        };
    }, [store, runtime, audio, editor, board, renderer]);
}
