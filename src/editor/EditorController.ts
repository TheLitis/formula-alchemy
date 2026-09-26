import { GameStore, clamp, uid } from '../core/store';
import { hasBodies, isField } from '../core/entities';
import { HEIGHT, MAX_BODIES, MAX_NODES, WIDTH } from '../core/types';
import type { FormulaNode, SavedExperiment } from '../core/types';
import type { SimulationRuntime } from '../physics/Runtime';
import { FLOOR } from '../physics/World';
import { EditHistory } from './History';
import { normalizeAngle, radians, rotatePoint, selectionIds } from './geometry';
import type { Point } from './geometry';

/** Non-React command layer, shared by mouse, keyboard, touch and toolbar. */
export class EditorController {
    readonly history: EditHistory;
    cancelPointer: (() => boolean) | null = null;
    preparePointerTransform: (() => boolean) | null = null;
    rotatePointer: ((degrees: number) => boolean) | null = null;
    selectionMode = false;
    private listeners = new Set<() => void>();
    private status = { selectionMode: false };
    constructor(readonly store: GameStore, readonly runtime: SimulationRuntime) {
        this.history = new EditHistory(() => ({ state: store.getState(), runtime: runtime.snapshot() }), saved => {
            runtime.world.release(); runtime.heldNodes.clear(); runtime.heldNode = null;
            store.restoreEditState(saved.state); runtime.restore(saved.runtime);
        });
        store.onBeforeEdit = (label, key) => this.history.begin(label, key);
        store.onAfterEdit = () => this.history.end();
        store.onCancelEdit = () => this.history.cancel();
    }
    getState = () => this.status;
    subscribe = (f: () => void) => { this.listeners.add(f); return () => { this.listeners.delete(f); }; };
    toggleSelectionMode() { this.selectionMode = !this.selectionMode; this.status = { selectionMode: this.selectionMode }; for (const f of this.listeners) f(); }
    get ids() { return selectionIds(this.store.getState()); }
    visibleIds() { const s = this.store.getState(); return s.nodes.filter(n => s.lab === 'sandbox' || n.id === s.activeId).map(n => n.id); }
    select(ids: string[], mode: 'replace' | 'add' | 'toggle' = 'replace') {
        if (mode === 'replace') { this.store.selectMany(ids); return; }
        const set = new Set(this.ids);
        for (const id of ids) { if (mode === 'toggle' && set.has(id)) set.delete(id); else set.add(id); }
        this.store.selectMany([...set]);
    }
    selectAll() { this.select(this.visibleIds()); }
    private positions(ids: ReadonlySet<string>) {
        const values: { x: number; y: number; radius: number }[] = [];
        for (const n of this.store.getState().nodes) if (ids.has(n.id)) {
            if (!hasBodies(n) || isField(n) || n.recipeId === 'hooke') values.push({ x: n.x, y: n.y, radius: 25 });
        }
        for (const b of this.runtime.world.bodies.values()) if (ids.has(b.owner) && b.label) values.push({ ...b.body.position, radius: b.radius + 1 });
        return values;
    }
    center(): Point {
        const p = this.positions(new Set(this.ids));
        if (!p.length) return { x: WIDTH / 2, y: HEIGHT / 2 };
        return { x: (Math.min(...p.map(v => v.x)) + Math.max(...p.map(v => v.x))) / 2,
            y: (Math.min(...p.map(v => v.y)) + Math.max(...p.map(v => v.y))) / 2 };
    }
    private transform(dx: number, dy: number, degrees = 0) {
        const ids = new Set(this.ids); if (!ids.size || !Number.isFinite(dx + dy + degrees)) return;
        const pivot = this.center(), angle = radians(degrees), points = this.positions(ids).map(p => ({ ...rotatePoint(p, pivot, angle), radius: p.radius }));
        // A single common translation keeps a group rigid at the viewport boundaries.
        if (points.length) {
            const minX = Math.min(...points.map(p => p.x - p.radius)), maxX = Math.max(...points.map(p => p.x + p.radius));
            const minY = Math.min(...points.map(p => p.y - p.radius)), maxY = Math.max(...points.map(p => p.y + p.radius));
            const lowX = 1 - minX, highX = WIDTH - 1 - maxX, lowY = 1 - minY, highY = FLOOR - maxY;
            dx = lowX <= highX ? clamp(dx, lowX, highX) : (lowX + highX) / 2;
            dy = lowY <= highY ? clamp(dy, lowY, highY) : (lowY + highY) / 2;
        }
        this.runtime.world.transformOwners(ids, dx, dy, angle, pivot);
        this.runtime.clearMotions(ids);
        this.store.patch({ nodes: this.store.getState().nodes.map(n => {
            if (!ids.has(n.id)) return n;
            const origin = degrees && hasBodies(n) && !isField(n) && n.recipeId !== 'hooke' ? this.runtime.world.positionFor(n) : n;
            const p = origin === n ? rotatePoint(n, pivot, angle) : origin;
            return { ...n, x: clamp(p.x + (origin === n ? dx : 0), 0, WIDTH), y: clamp(p.y + (origin === n ? dy : 0), 0, HEIGHT), rotation: normalizeAngle((n.rotation ?? 0) + degrees) };
        }) });
    }
    move(dx: number, dy: number, mergeKey?: string) { this.history.run('Перемещение', () => this.transform(dx, dy), mergeKey); }
    rotate(degrees = 15, mergeKey?: string) {
        if (this.rotatePointer?.(degrees)) return;
        this.preparePointerTransform?.();
        this.history.run('Поворот', () => this.transform(0, 0, degrees), mergeKey);
    }
    beginMove() {
        this.history.begin('Перенос / поворот');
        this.runtime.heldNodes = new Set(this.ids); this.runtime.world.holdOwners(this.runtime.heldNodes);
    }
    endMove() { this.runtime.world.release(true); this.runtime.heldNodes.clear(); this.runtime.heldNode = null; this.history.end(); }
    cancelMove() { this.runtime.world.release(); this.runtime.heldNodes.clear(); this.runtime.heldNode = null; this.history.cancel(); }
    undo() { if (this.cancelPointer?.()) return; this.history.undo(); }
    redo() { if (this.cancelPointer?.()) return; this.history.redo(); }
    deleteSelection() {
        this.cancelPointer?.();
        const ids = this.ids; if (!ids.length) return;
        this.store.removeMany(ids);
    }
    duplicate() {
        this.cancelPointer?.();
        const chosen = new Set(this.ids), nodes = this.store.getState().nodes.filter(n => chosen.has(n.id));
        if (!nodes.length) return;
        const snapshot = this.runtime.snapshot(), bodies = snapshot.bodies.filter(b => chosen.has(b.owner));
        if (this.store.getState().nodes.length + nodes.length > MAX_NODES || snapshot.bodies.length + bodies.length > MAX_BODIES) {
            this.store.notify('Недостаточно места для копии выделения.', 'error'); return;
        }
        this.history.run('Дублирование', () => {
            const idMap = new Map(nodes.map(n => [n.id, uid()]));
            const points = [...nodes.map(n => ({ x: n.x, radius: 1 })), ...bodies.map(b => ({ x: b.x, radius: b.radius }))];
            const minX = Math.min(...points.map(p => p.x - p.radius)), maxX = Math.max(...points.map(p => p.x + p.radius));
            const offset = maxX < WIDTH - 33 ? 32 : minX > 33 ? -32 : Math.max(0, WIDTH - maxX - 1);
            const copies: FormulaNode[] = nodes.map(n => ({ ...structuredClone(n), id: idMap.get(n.id)!, x: n.x + offset, y: n.y }));
            this.store.patch({ nodes: [...this.store.getState().nodes, ...copies], selectedIds: copies.map(n => n.id), selectedId: copies.at(-1)!.id });
            const next = structuredClone(snapshot);
            next.bodies.push(...bodies.map(b => ({ ...b, owner: idMap.get(b.owner)!, key: `${idMap.get(b.owner)}/${b.key.split('/').at(-1)}`, x: b.x + offset })));
            for (const n of nodes) {
                next.ages[idMap.get(n.id)!] = snapshot.ages[n.id] ?? 0;
                if (next.anchors?.[n.id]) next.anchors[idMap.get(n.id)!] = { ...next.anchors[n.id], x: next.anchors[n.id].x + offset };
            }
            this.runtime.restore(next); this.store.onFeedback('drop');
        });
    }
    clear() { this.cancelPointer?.(); this.history.run('Очистка', () => { this.store.reset(); this.runtime.reset(); }); }
    load(save: SavedExperiment) { this.cancelPointer?.(); this.history.run('Загрузка опыта', () => { this.store.load(save.state); this.runtime.restore(save.runtime); }); }
    dispose() { this.store.onBeforeEdit = () => {}; this.store.onAfterEdit = () => {}; this.store.onCancelEdit = () => {}; this.listeners.clear(); this.history.clear(); }
}
