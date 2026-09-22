import { useEffect } from 'react';
import type { RefObject } from 'react';
import katex from 'katex';
import { useSession } from './session';
import { RECIPE_MAP } from '../core/catalog';
import { candidates } from '../core/crafting';
import { SYMBOL_MAP } from '../core/symbols';
import { toWorld } from '../rendering/Renderer';
import type { CanvasRenderer } from '../rendering/Renderer';
interface Drag {
    kind: 'symbol' | 'node';
    id: string;
    pointer: number;
    sx: number;
    sy: number;
    moved: boolean;
    source: HTMLElement;
}
export function usePointerCraft(board: RefObject<HTMLDivElement | null>, renderer: RefObject<CanvasRenderer | null>) {
    const { store, audio } = useSession();
    useEffect(() => {
        let drag: Drag | null = null, ghost: HTMLDivElement | null = null;
        const clearHighlights = () => document.querySelectorAll('.drop-good,.drop-bad').forEach(el => el.classList.remove('drop-good', 'drop-bad'));
        const clean = () => { if (drag)
            drag.source.style.opacity = ''; ghost?.remove(); ghost = null; drag = null; clearHighlights(); };
        const down = (event: PointerEvent) => {
            if (event.button !== 0 || event.isPrimary === false || document.querySelector('[aria-modal="true"]'))
                return;
            const source = (event.target as Element).closest<HTMLElement>('[data-symbol],[data-node]');
            if (!source)
                return;
            const kind = source.dataset.symbol ? 'symbol' : 'node', id = source.dataset.symbol ?? source.dataset.node!;
            drag = { kind, id, pointer: event.pointerId, sx: event.clientX, sy: event.clientY, moved: false, source };
            event.preventDefault();
            try {
                source.setPointerCapture(event.pointerId);
            }
            catch { /* detached target */ }
            void audio.unlock().catch(() => { });
            audio.click();
        };
        const hoverTarget = (x: number, y: number) => [...document.querySelectorAll<HTMLElement>('[data-node]')].find(el => {
            if (drag?.kind === 'node' && el.dataset.node === drag.id)
                return false;
            const rect = el.getBoundingClientRect();
            return x >= rect.left - 5 && x <= rect.right + 5 && y >= rect.top - 5 && y <= rect.bottom + 5;
        });
        const move = (event: PointerEvent) => {
            if (!drag || event.pointerId !== drag.pointer)
                return;
            if (!drag.moved && Math.hypot(event.clientX - drag.sx, event.clientY - drag.sy) > 5) {
                drag.moved = true;
                drag.source.style.opacity = '.35';
                ghost = document.createElement('div');
                ghost.className = 'drag-ghost';
                const node = store.getState().nodes.find(n => n.id === drag!.id);
                const tex = drag.kind === 'symbol' ? SYMBOL_MAP[drag.id].tex : node?.recipeId ? RECIPE_MAP[node.recipeId].tex : node?.parts.map(id => SYMBOL_MAP[id].tex).join('\\,') ?? '';
                ghost.innerHTML = katex.renderToString(tex, { throwOnError: false, trust: false });
                document.body.appendChild(ghost);
            }
            if (ghost) {
                ghost.style.left = `${event.clientX}px`;
                ghost.style.top = `${event.clientY}px`;
            }
            clearHighlights();
            const target = hoverTarget(event.clientX, event.clientY);
            if (target && drag.moved) {
                const b = store.getState().nodes.find(n => n.id === target.dataset.node), a = drag.kind === 'symbol' ? [drag.id] : store.getState().nodes.find(n => n.id === drag!.id)?.parts ?? [];
                if (b)
                    target.classList.add(candidates([...a, ...b.parts]).length ? 'drop-good' : 'drop-bad');
            }
        };
        const up = (event: PointerEvent) => {
            if (!drag || event.pointerId !== drag.pointer)
                return;
            const current = drag;
            if (!current.moved) {
                if (current.kind === 'symbol')
                    store.addToken(current.id);
                else
                    store.select(current.id);
                clean();
                return;
            }
            const bounds = board.current?.getBoundingClientRect(), target = hoverTarget(event.clientX, event.clientY);
            const trash = [...document.querySelectorAll<HTMLElement>('[data-trash]')].some(el => { const r = el.getBoundingClientRect(); return event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom; });
            if (trash && current.kind === 'node') {
                store.remove(current.id);
                clean();
                return;
            }
            if (bounds && renderer.current && event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
                const point = toWorld(renderer.current.viewport, event.clientX - bounds.left, event.clientY - bounds.top);
                if (target) {
                    if (current.kind === 'symbol')
                        store.dropSymbol(current.id, target.dataset.node!);
                    else
                        store.combine(current.id, target.dataset.node!);
                }
                else if (current.kind === 'symbol')
                    store.addToken(current.id, point.x, point.y);
                else {
                    store.move(current.id, point.x, point.y);
                    store.select(current.id);
                }
            }
            clean();
        };
        const cancel = () => clean();
        document.addEventListener('pointerdown', down);
        window.addEventListener('pointermove', move, { passive: true });
        window.addEventListener('pointerup', up);
        window.addEventListener('pointercancel', cancel);
        window.addEventListener('blur', cancel);
        return () => { document.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); window.removeEventListener('blur', cancel); clean(); };
    }, [store, audio, board, renderer]);
}
