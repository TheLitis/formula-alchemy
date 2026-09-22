import { defaults, RECIPE_MAP } from './catalog';
import { mergeNodes, exactRecipes } from './crafting';
import { SYMBOL_MAP } from './symbols';
import { HEIGHT, MAX_NODES, WIDTH } from './types';
import type { FormulaNode, GameState } from './types';
export const uid = (): string => `fa-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
export const clamp = (x: number, min: number, max: number): number => Math.max(min, Math.min(max, x));
export function initialState(): GameState {
    return { nodes: [
            { id: 'seed-m', parts: ['m'], x: 380, y: 300, params: {}, revision: 0, closed: true },
            { id: 'seed-g', parts: ['g'], x: 620, y: 300, params: {}, revision: 0, closed: true },
        ], selectedId: null, discoveries: [], paused: false, speed: 1, grid: true, vectors: true, trails: true, music: false, sound: true, lab: 'sandbox', activeId: null };
}
export type NoticeKind = 'info' | 'success' | 'error';
export class GameStore {
    private state: GameState;
    private listeners = new Set<() => void>();
    onNotice: (text: string, kind: NoticeKind) => void = () => { };
    constructor(state: GameState = initialState()) { this.state = state; }
    getState = (): GameState => this.state;
    subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
    private emit(next: GameState) { this.state = next; for (const f of this.listeners)
        f(); }
    patch(partial: Partial<GameState>) { this.emit({ ...this.state, ...partial }); }
    notify(message: string, kind: NoticeKind = 'info') { this.onNotice(message, kind); }
    private discover(recipeId: string, source: 'craft' | 'book') {
        if (this.state.discoveries.some(d => d.recipeId === recipeId))
            return;
        this.state = { ...this.state, discoveries: [...this.state.discoveries, { recipeId, at: new Date().toISOString(), source }] };
        this.notify(`Открытие: ${RECIPE_MAP[recipeId].title}`, 'success');
    }
    select(id: string | null) {
        const node = this.state.nodes.find(n => n.id === id);
        const recipe = node?.recipeId ? RECIPE_MAP[node.recipeId] : null;
        this.patch({ selectedId: id, lab: recipe?.lab ?? 'sandbox', activeId: recipe ? node!.id : null });
    }
    addToken(symbol: string, x = 250 + Math.random() * 500, y = 220 + Math.random() * 220): string | null {
        if (!SYMBOL_MAP[symbol])
            return null;
        if (this.state.nodes.length >= MAX_NODES) {
            this.notify(`На холсте не больше ${MAX_NODES} элементов. Удалите лишние.`, 'error');
            return null;
        }
        const id = uid();
        const node: FormulaNode = { id, parts: [symbol], x: clamp(x, 50, WIDTH - 50), y: clamp(y, 85, HEIGHT - 90), params: {}, revision: 0, closed: true };
        this.patch({ nodes: [...this.state.nodes, node], selectedId: id, lab: 'sandbox', activeId: null });
        return id;
    }
    move(id: string, x: number, y: number) { this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, x: clamp(x, 65, WIDTH - 65), y: clamp(y, 85, HEIGHT - 90) } : n) }); }
    combine(source: string, target: string): boolean {
        if (source === target)
            return false;
        const a = this.state.nodes.find(n => n.id === source), b = this.state.nodes.find(n => n.id === target);
        if (!a || !b)
            return false;
        const merged = mergeNodes(a, b, uid());
        if (!merged) {
            this.notify('Эти символы не образуют рецепт. Совместимые сочетания есть в книге.');
            return false;
        }
        this.state = { ...this.state, nodes: [...this.state.nodes.filter(n => n.id !== source && n.id !== target), merged] };
        if (merged.recipeId)
            this.discover(merged.recipeId, 'craft');
        else
            this.notify('Промежуточная комбинация. Добавьте недостающий символ.');
        this.select(merged.id);
        return true;
    }
    dropSymbol(symbol: string, target: string): boolean {
        const b = this.state.nodes.find(n => n.id === target);
        if (!b)
            return false;
        const a: FormulaNode = { id: uid(), parts: [symbol], x: b.x, y: b.y, params: {}, revision: 0, closed: true };
        const merged = mergeNodes(a, b, uid());
        if (!merged) {
            this.notify('Не соединяются: попробуйте другой символ.');
            return false;
        }
        this.state = { ...this.state, nodes: [...this.state.nodes.filter(n => n.id !== target), merged] };
        if (merged.recipeId)
            this.discover(merged.recipeId, 'craft');
        else
            this.notify('Комбинация собрана частично. Посмотрите подсказку справа.');
        this.select(merged.id);
        return true;
    }
    openRecipe(recipeId: string) {
        const recipe = RECIPE_MAP[recipeId];
        if (!recipe)
            return;
        const existing = this.state.nodes.find(n => n.recipeId === recipeId);
        if (existing) {
            this.restart(existing.id);
            this.select(existing.id);
            return;
        }
        if (this.state.nodes.length >= MAX_NODES) {
            this.notify('Холст заполнен. Удалите несколько элементов.', 'error');
            return;
        }
        const node: FormulaNode = { id: uid(), parts: [...recipe.inputs], recipeId, x: 480, y: 160, params: defaults(recipe), revision: 0, closed: true };
        this.state = { ...this.state, nodes: [...this.state.nodes, node] };
        this.discover(recipeId, 'book');
        this.select(node.id);
    }
    prepareRecipe(recipeId: string) {
        const recipe = RECIPE_MAP[recipeId];
        if (!recipe)
            return;
        if (this.state.nodes.length + recipe.inputs.length > MAX_NODES) {
            this.notify('Недостаточно места на холсте.', 'error');
            return;
        }
        const nodes = recipe.inputs.map((symbol, i): FormulaNode => ({ id: uid(), parts: [symbol], x: 180 + i * (640 / Math.max(1, recipe.inputs.length - 1)), y: 290, params: {}, revision: 0, closed: true }));
        this.patch({ nodes: [...this.state.nodes, ...nodes], selectedId: nodes[0]?.id ?? null, lab: 'sandbox', activeId: null });
        this.notify('Символы на холсте. Перетащите один на другой.');
    }
    variant(nodeId: string, recipeId: string) {
        const node = this.state.nodes.find(n => n.id === nodeId), recipe = RECIPE_MAP[recipeId];
        if (!node || !recipe || !exactRecipes(node.parts).some(r => r.id === recipeId))
            return;
        this.state = { ...this.state, nodes: this.state.nodes.map(n => n.id === nodeId ? { ...n, recipeId, params: defaults(recipe), revision: n.revision + 1 } : n) };
        this.discover(recipeId, 'craft');
        this.select(nodeId);
    }
    setParam(id: string, key: string, value: number) {
        if (!Number.isFinite(value))
            return;
        const node = this.state.nodes.find(n => n.id === id);
        if (!node?.recipeId)
            return;
        const def = RECIPE_MAP[node.recipeId].params.find(p => p.key === key);
        if (!def)
            return;
        const clean = clamp(Math.round((value - def.min) / def.step) * def.step + def.min, def.min, def.max);
        this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, params: { ...n.params, [key]: Number(clean.toFixed(8)) }, revision: n.revision + 1 } : n) });
    }
    restart(id: string) { this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, revision: n.revision + 1 } : n) }); }
    toggleCircuit(id: string) { this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, closed: !n.closed } : n) }); }
    remove(id: string) { const nodes = this.state.nodes.filter(n => n.id !== id); this.patch({ nodes, selectedId: this.state.selectedId === id ? null : this.state.selectedId, activeId: this.state.activeId === id ? null : this.state.activeId, lab: this.state.activeId === id ? 'sandbox' : this.state.lab }); }
    reset() { this.patch({ nodes: [], selectedId: null, activeId: null, lab: 'sandbox', paused: false }); }
    load(state: GameState) {
        // Preserve existing discoveries when opening an older experiment.
        const known = new Map(this.state.discoveries.map(d => [d.recipeId, d]));
        for (const d of state.discoveries)
            if (!known.has(d.recipeId))
                known.set(d.recipeId, d);
        this.emit({ ...state, music: false, discoveries: [...known.values()] });
    }
}
