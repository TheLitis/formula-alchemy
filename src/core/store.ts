import { selectionIds } from '../editor/geometry';
import { defaults, RECIPE_MAP } from './catalog';
import { mergeNodes, exactRecipes } from './crafting';
import { isApparatus, standaloneDefaults, standaloneParameters } from './entities';
import { SYMBOL_MAP } from './symbols';
import { HEIGHT, MAX_NODES, WIDTH } from './types';
import type { FormulaNode, GameState } from './types';
export const uid = (): string => `fa-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
export const clamp = (x: number, min: number, max: number): number => Math.max(min, Math.min(max, x));
export function initialState(): GameState {
    return { nodes: [
        { id: 'seed-m', parts: ['m'], x: 350, y: 300, params: standaloneDefaults(['m']), revision: 0, closed: true },
        { id: 'seed-g', parts: ['g'], x: 690, y: 300, params: standaloneDefaults(['g']), revision: 0, closed: true },
    ], selectedId: null, discoveries: [], paused: false, speed: 1, grid: true, vectors: true, speeds: true, trails: true, music: false, sound: true, lab: 'sandbox', activeId: null };
}
export type Feedback = 'drop' | 'craft' | 'discovery' | 'remove' | 'switch' | 'blackhole';
export type NoticeKind = 'info' | 'success' | 'error';
export class GameStore {
    private state: GameState;
    private listeners = new Set<() => void>();
    onNotice: (text: string, kind: NoticeKind) => void = () => {};
    onFeedback: (event: Feedback) => void = () => {};
    onCraft: (sources: FormulaNode[], result: FormulaNode) => void = () => {};
    onBeforeEdit: (label: string, mergeKey?: string) => void = () => {};
    onAfterEdit: () => void = () => {};
    onCancelEdit: () => void = () => {};
    edit<T>(label: string, fn: () => T, mergeKey?: string): T {
        this.onBeforeEdit(label, mergeKey);
        try { const result = fn(); this.onAfterEdit(); return result; }
        catch (error) { this.onCancelEdit(); throw error; }
    }
    constructor(state: GameState = initialState()) { this.state = state; }
    getState = (): GameState => this.state;
    subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
    private emit(next: GameState) { this.state = next; for (const f of this.listeners) f(); }
    patch(partial: Partial<GameState>) {
        const next = { ...this.state, ...partial };
        if ('selectedId' in partial && !('selectedIds' in partial)) next.selectedIds = next.selectedId ? [next.selectedId] : [];
        next.selectedIds = selectionIds(next);
        if (!next.selectedId || !next.selectedIds.includes(next.selectedId)) next.selectedId = next.selectedIds.at(-1) ?? null;
        this.emit(next);
    }
    selectMany(ids: string[]) {
        const valid = [...new Set(ids)].filter(id => this.state.nodes.some(n => n.id === id));
        this.patch({ selectedIds: valid, selectedId: valid.at(-1) ?? null });
    }
    restoreEditState(saved: GameState) {
        const current = this.state, known = new Map(current.discoveries.map(d => [d.recipeId, d]));
        for (const d of saved.discoveries) known.set(d.recipeId, known.get(d.recipeId) ?? d);
        this.patch({ ...saved, discoveries: [...known.values()], paused: current.paused, speed: current.speed,
            sound: current.sound, music: current.music, grid: current.grid, vectors: current.vectors, speeds: current.speeds, trails: current.trails });
    }
    removeMany(ids: string[]) {
        this.edit('Удаление', () => {
            const chosen = new Set(ids), nodes = this.state.nodes.filter(n => !chosen.has(n.id));
            if (nodes.length === this.state.nodes.length) return;
            this.patch({ nodes, activeId: chosen.has(this.state.activeId ?? '') ? null : this.state.activeId,
                lab: chosen.has(this.state.activeId ?? '') ? 'sandbox' : this.state.lab });
            this.onFeedback('remove');
        });
    }
    notify(message: string, kind: NoticeKind = 'info') { this.onNotice(message, kind); }
    private recipeFeedback(recipeId: string | undefined, isNew: boolean) {
        this.onFeedback(recipeId === 'blackhole' ? 'blackhole' : isNew ? 'discovery' : 'craft');
    }
    private discover(recipeId: string, source: 'craft' | 'book') {
        if (this.state.discoveries.some(d => d.recipeId === recipeId)) return;
        this.state = { ...this.state, discoveries: [...this.state.discoveries, { recipeId, at: new Date().toISOString(), source }] };
        this.notify(`Открытие: ${RECIPE_MAP[recipeId].title}`, 'success');
    }
    /** Selection never hides or repositions the object being selected. */
    select(id: string | null) { this.patch({ selectedId: id && this.state.nodes.some(n => n.id === id) ? id : null }); }
    focus(id: string) {
        const n = this.state.nodes.find(n => n.id === id);
        if (!n?.recipeId) return;
        const lab = isApparatus(n) ? RECIPE_MAP[n.recipeId].lab : 'sandbox';
        this.patch({ selectedId: id, activeId: lab === 'sandbox' ? null : id, lab });
    }
    addToken(symbol: string, x = 220 + Math.random() * 550, y = 220 + Math.random() * 220): string | null {
        return this.edit('Добавление', () => {
        if (!Object.hasOwn(SYMBOL_MAP, symbol)) return null;
        if (this.state.nodes.length >= MAX_NODES) { this.notify(`На холсте не больше ${MAX_NODES} элементов. Удалите лишние.`, 'error'); return null; }
        const id = uid();
        const node: FormulaNode = { id, parts: [symbol], x: clamp(x, 25, WIDTH - 25), y: clamp(y, 30, HEIGHT - 65), params: standaloneDefaults([symbol]), revision: 0, closed: true };
        this.patch({ nodes: [...this.state.nodes, node], selectedId: null, lab: 'sandbox', activeId: null });
        this.onFeedback('drop');
        return id;
    
        });
    }
    move(id: string, x: number, y: number) {
        if (!Number.isFinite(x + y)) return;
        this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, x: clamp(x, 22, WIDTH - 22), y: clamp(y, 25, HEIGHT - 55) } : n) });
    }
    moveMany(positions: ReadonlyMap<string, { x: number; y: number }>) {
        if (!positions.size) return;
        this.patch({ nodes: this.state.nodes.map(n => { const p = positions.get(n.id); return p ? { ...n, x: clamp(p.x, 20, WIDTH - 20), y: clamp(p.y, 20, HEIGHT - 40) } : n; }) });
    }
    private complete(a: FormulaNode, b: FormulaNode, sourceOnBoard: boolean, point?: { x: number; y: number }): boolean {
        return this.edit('Соединение', () => {
        const merged = mergeNodes(a, b, uid());
        if (!merged) { this.notify('Не соединяются: выберите совместимые символы.'); return false; }
        if (point) { merged.x = point.x; merged.y = point.y; }
        if (!merged.recipeId) merged.params = standaloneDefaults(merged.parts);
        const isNew = !!merged.recipeId && !this.state.discoveries.some(d => d.recipeId === merged.recipeId);
        this.onCraft([a, b], merged);
        this.state = { ...this.state, nodes: [...this.state.nodes.filter(n => n.id !== b.id && (!sourceOnBoard || n.id !== a.id)), merged] };
        if (merged.recipeId) this.discover(merged.recipeId, 'craft');
        else this.notify('Промежуточная комбинация. Добавьте недостающий символ.');
        // The new phenomenon is visible; its formula appears only after explicitly selecting it.
        this.patch({ selectedId: null, activeId: null, lab: 'sandbox' });
        this.recipeFeedback(merged.recipeId, isNew);
        return true;
    
        });
    }
    combine(source: string, target: string, point?: { x: number; y: number }): boolean {
        const a = this.state.nodes.find(n => n.id === source), b = this.state.nodes.find(n => n.id === target);
        return !!a && !!b && a.id !== b.id && this.complete(a, b, true, point);
    }
    dropSymbol(symbol: string, target: string, point?: { x: number; y: number }): boolean {
        const b = this.state.nodes.find(n => n.id === target);
        if (!b || !Object.hasOwn(SYMBOL_MAP, symbol)) return false;
        return this.complete({ id: uid(), parts: [symbol], x: b.x - 55, y: b.y, params: standaloneDefaults([symbol]), revision: 0, closed: true }, b, false, point);
    }
    openRecipe(recipeId: string) {
        return this.edit('Открытие опыта', () => {
        const recipe = RECIPE_MAP[recipeId];
        if (!recipe) return;
        const existing = this.state.nodes.find(n => n.recipeId === recipeId);
        if (existing) { this.restart(existing.id); this.focus(existing.id); return; }
        if (this.state.nodes.length >= MAX_NODES) { this.notify('Холст заполнен.', 'error'); return; }
        const isNew = !this.state.discoveries.some(d => d.recipeId === recipeId);
        const node: FormulaNode = { id: uid(), parts: [...recipe.inputs], recipeId, x: 500, y: 340, params: defaults(recipe), revision: 0, closed: true };
        this.state = { ...this.state, nodes: [...this.state.nodes, node] };
        this.discover(recipeId, 'book');
        this.focus(node.id);
        this.recipeFeedback(recipeId, isNew);
    
        });
    }
    prepareRecipe(recipeId: string) {
        return this.edit('Ингредиенты', () => {
        const recipe = RECIPE_MAP[recipeId];
        if (!recipe) return;
        if (this.state.nodes.length + recipe.inputs.length > MAX_NODES) { this.notify('Недостаточно места на холсте.', 'error'); return; }
        const nodes = recipe.inputs.map((symbol, i): FormulaNode => ({ id: uid(), parts: [symbol], x: 180 + i * (640 / Math.max(1, recipe.inputs.length - 1)), y: 290, params: standaloneDefaults([symbol]), revision: 0, closed: true }));
        this.patch({ nodes: [...this.state.nodes, ...nodes], selectedId: null, lab: 'sandbox', activeId: null });
        this.notify('Символы на холсте. Соедините их перетаскиванием.');
        this.onFeedback('drop');
    
        });
    }
    variant(nodeId: string, recipeId: string) {
        return this.edit('Вариант формулы', () => {
        const node = this.state.nodes.find(n => n.id === nodeId), recipe = RECIPE_MAP[recipeId];
        if (!node || !recipe || !exactRecipes(node.parts).some(r => r.id === recipeId)) return;
        const isNew = !this.state.discoveries.some(d => d.recipeId === recipeId);
        this.state = { ...this.state, nodes: this.state.nodes.map(n => n.id === nodeId ? { ...n, recipeId, params: defaults(recipe), revision: n.revision + 1 } : n) };
        this.discover(recipeId, 'craft');
        this.focus(nodeId);
        this.recipeFeedback(recipeId, isNew);
    
        });
    }
    setParam(id: string, key: string, value: number) {
        return this.edit('Изменение параметра', () => {
        if (!Number.isFinite(value)) return;
        const node = this.state.nodes.find(n => n.id === id);
        if (!node) return;
        const def = (node.recipeId ? RECIPE_MAP[node.recipeId].params : standaloneParameters(node.parts)).find(p => p.key === key);
        if (!def) return;
        const clean = Number(clamp(Math.round((value - def.min) / def.step) * def.step + def.min, def.min, def.max).toFixed(8));
        if (node.params[key] === clean) return;
        // Parameter edits are not restarts: holes do not regenerate dust, bodies do not teleport.
        this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, params: { ...n.params, [key]: clean } } : n) });
    
        }, `param:${id}:${key}`);
    }
    restart(id: string) {
        return this.edit('Перезапуск', () => { this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, revision: n.revision + 1 } : n) }); 
        });
    }
    toggleCircuit(id: string) {
        return this.edit('Ключ цепи', () => { this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, closed: !n.closed } : n) }); this.onFeedback('switch'); 
        });
    }
    remove(id: string, silent = false) {
        if (silent) { const existed = this.state.nodes.some(n => n.id === id); const nodes = this.state.nodes.filter(n => n.id !== id); this.patch({ nodes, selectedId: this.state.selectedId === id ? null : this.state.selectedId, activeId: this.state.activeId === id ? null : this.state.activeId, lab: this.state.activeId === id ? 'sandbox' : this.state.lab }); if (existed && !silent) this.onFeedback('remove'); return; }
return this.edit('Удаление', () => { const existed = this.state.nodes.some(n => n.id === id); const nodes = this.state.nodes.filter(n => n.id !== id); this.patch({ nodes, selectedId: this.state.selectedId === id ? null : this.state.selectedId, activeId: this.state.activeId === id ? null : this.state.activeId, lab: this.state.activeId === id ? 'sandbox' : this.state.lab }); if (existed && !silent) this.onFeedback('remove'); 
        });
    }
    reset() {
        return this.edit('Очистка', () => { this.patch({ nodes: [], selectedId: null, activeId: null, lab: 'sandbox', paused: false }); this.onFeedback('remove'); 
        });
    }
    load(state: GameState) {
        const known = new Map(this.state.discoveries.map(d => [d.recipeId, d]));
        for (const d of state.discoveries) if (!known.has(d.recipeId)) known.set(d.recipeId, d);
        this.emit({ ...state, music: false, discoveries: [...known.values()] });
    }
}
