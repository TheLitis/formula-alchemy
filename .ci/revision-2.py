changes = [
{'path':'src/core/entities.ts','sha256':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','edits':[[0,0,r'''import type { FormulaNode, Parameter } from './types';

/** A recipe is a visible object, not a second hidden handle above that object. */
export const BODY_RECIPES = new Set(['weight', 'newton', 'kinetic', 'momentum', 'potential', 'impulse', 'work', 'hooke', 'friction', 'electricField', 'lorentz', 'coulomb']);
export const FIELD_RECIPES = new Set(['crossedFields', 'magneticCoil', 'gravitySource', 'inverseGravity']);
export const isBareBody = (n: FormulaNode) => !n.recipeId && (n.parts.includes('m') || n.parts.includes('q') || n.parts.includes('q2') || (n.parts.length === 1 && n.parts[0] === 'M')) && !n.parts.includes('G');
export const hasBodies = (n: FormulaNode) => !!n.recipeId && BODY_RECIPES.has(n.recipeId) || isBareBody(n);
export const isField = (n: FormulaNode) => !!n.recipeId && FIELD_RECIPES.has(n.recipeId) || !n.recipeId && n.parts.length === 1 && ['E', 'B', 'g', 'I'].includes(n.parts[0]);
export const isApparatus = (n: FormulaNode) => !!n.recipeId && !hasBodies(n) && !isField(n) && n.recipeId !== 'blackhole';

const p = (key: string, symbol: string, name: string, unit: string, min: number, max: number, step: number, initial: number): Parameter => ({ key, symbol, name, unit, min, max, step, initial });
const extent = () => p('extent', 'R', 'Размер области', 'м', 2, 8, .5, 5);
const direction = () => p('angle', '\\theta', 'Направление', '°', 0, 360, 15, 0);
export function standaloneParameters(parts: string[]): Parameter[] {
    if (parts.length === 1) {
        if (parts[0] === 'E') return [p('E', 'E', 'Напряжённость', 'Н/Кл', -20, 20, .5, 6), direction(), extent()];
        if (parts[0] === 'B') return [p('B', 'B_z', 'Индукция: + из экрана', 'Тл', -4, 4, .1, 1), extent()];
        if (parts[0] === 'g') return [p('g', 'g', 'Ускорение вниз', 'м/с²', 0, 20, .1, 9.8), extent()];
        if (parts[0] === 'I') return [p('I', 'I', 'Ток: + из экрана', 'А', -10, 10, .5, 3), extent()];
    }
    if (parts.includes('q') || parts.includes('q2')) return [p('q', 'q', 'Заряд', 'Кл', -4, 4, .1, parts.includes('q2') ? -1 : 1), p('m', 'm', 'Масса', 'кг', .2, 8, .1, 1), p('v', 'v', 'Начальная скорость', 'м/с', 0, 12, .5, parts.includes('v') ? 4 : 0), direction()];
    if (parts.includes('m') || (parts.length === 1 && parts[0] === 'M')) return [p('m', 'm', 'Масса', 'кг', .2, 8, .1, parts[0] === 'M' ? 6 : 2), p('v', 'v', 'Начальная скорость', 'м/с', 0, 12, .5, 0), direction()];
    return [];
}
export const standaloneDefaults = (parts: string[]) => Object.fromEntries(standaloneParameters(parts).map(p => [p.key, p.initial]));
export const tokenGlyph = (n: FormulaNode): string => {
    if (n.parts.length === 1) return ({ mu: 'μ', mu_m: 'μₘ', rho: 'ρ', q2: 'q₂', c_heat: 'cᵤ', dT: 'ΔT', lambda: 'λ', lambda_heat: 'λₘ', nu: 'ν', Phi: 'ΔΦ', dt: 'Δt', n1: 'n₁', n2: 'n₂', theta: 'θ', focus: 'Fₗ', hP: 'hₚ', W0: 'Aₒ', N0: 'N₀', half: 'T½', dm: 'Δm' } as Record<string, string>)[n.parts[0]] ?? n.parts[0];
    return n.parts.map(s => tokenGlyph({ ...n, parts: [s] })).join('');
};
export const standaloneDescription = (n: FormulaNode) => {
    const symbol = n.parts[0];
    if (symbol === 'E') return 'Область однородного электрического поля. Стрелки задают направление силы на положительный заряд. Поместите q в область; отрицательный заряд ускоряется против стрелок. Движущиеся метки показывают направление, а не течение поля.';
    if (symbol === 'B') return 'Область однородного поля поперёк экрана: точки — к наблюдателю, крестики — от него. Магнитная сила поворачивает движущийся заряд без изменения модуля скорости; покоящийся заряд не разгоняется. Это область поля, не магнитный монополь.';
    if (symbol === 'g') return 'Локальная область постоянного ускорения вниз. Действует на физические тела, пока они находятся внутри области. Граница области — условность песочницы.';
    if (symbol === 'I') return 'Сечение длинного прямого провода с током. Поле направлено по касательным к окружностям и убывает как 1/r. B лежит в плоскости экрана: возникающее движение заряда из плоскости не моделируется в 2D. Для отклонения заряда в плоскости используйте B.';
    if (symbol === 'G') return 'G — постоянная, а не источник поля. Соедините G и M, чтобы создать гравитационный источник.';
    return 'Перетащите букву за сам символ. Масса и заряд участвуют в столкновениях; поля действуют в показанных областях. Добавьте совместимые символы для нового опыта.';
};
''']]},
{'path': 'src/core/evaluate.ts', 'sha256': '555d6f686a5bafe33583665b17495462077811c9b04aed82f92bbb2c52997a11', 'edits': [[757, 757, "        case 'gravitySource':\n        case 'inverseGravity':\n            value = G * p.M * 1e12 / p.r ** 2;\n            break;\n        case 'crossedFields':\n            value = p.B === 0 ? Infinity : Math.abs(p.E / p.B);\n            if (p.B === 0) note = 'Магнитное поле отсутствует';\n            break;\n        case 'magneticCoil':\n            value = 4 * Math.PI * 1e-7 * p.mu_m * p.I / (2 * p.r);\n            break;\n"]]},
{'path':'src/core/extraRecipes.ts','sha256':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','edits':[[0,0,r'''import type { Parameter, Recipe } from './types';
const p = (key: string, symbol: string, name: string, unit: string, min: number, max: number, step: number, initial: number): Parameter => ({ key, symbol, name, unit, min, max, step, initial });
const extent = () => p('extent', 'R', 'Размер области', 'м', 2, 8, .5, 5);
const grav = (id: string, inputs: string[], title: string): Recipe => ({ id, inputs, title, tex: 'g(r)=\\frac{GM}{r^2}', topic: 'mechanics', lab: 'sandbox', grade: '9–11', unit: 'м/с²', description: 'Ускорение тяготения направлено к источнику и не зависит от массы пробного тела. Изменяется как 1/r².', effect: 'Источник действует на все физические тела на холсте; направление и спад поля видны по стрелкам.', model: '32 пикселя = 1 м. M в 10¹² кг. Внутри 0,7 м расстояние сглаживается, чтобы избежать сингулярности. Радиус справа — расстояние для показания, не граница действия поля.', params: [p('M', 'M', 'Масса источника', '10¹² кг', .5, 12, .5, 3), p('r', 'r', 'Расстояние измерения', 'м', 1, 10, .5, 5)] });
export const EXTRA_RECIPES: Recipe[] = [
    grav('gravitySource', ['G', 'M'], 'Гравитационный источник'),
    grav('inverseGravity', ['G', 'M', 'r'], 'Поле обратных квадратов'),
    { id: 'crossedFields', inputs: ['E', 'B'], title: 'Скрещённые поля', tex: '\\vec F=q(\\vec E+\\vec v\\times\\vec B)', topic: 'magnetism', lab: 'sandbox', grade: '11', unit: 'м/с', description: 'Электрическая и магнитная силы действуют одновременно. При подходящих знаке и направлении скорости силы могут компенсироваться. Показание — модуль скорости компенсации |E/B|.', effect: 'Область электрических стрелок и магнитных точек. Добавьте q и задайте ему скорость.', model: 'Однородные области с условной резкой границей. +B направлено из экрана; движение заряда вычисляется в плоскости. Магнитный шаг точно сохраняет модуль скорости.', params: [p('E', 'E', 'Напряжённость', 'Н/Кл', -20, 20, .5, 4), p('B', 'B_z', 'Индукция: + из экрана', 'Тл', -4, 4, .1, 1), p('angle', '\\theta', 'Направление E', '°', 0, 360, 15, 0), extent()] },
    { id: 'magneticCoil', inputs: ['mu_m', 'I'], title: 'Поле круглого витка', tex: 'B_0=\\frac{\\mu_0\\mu_r I}{2r}', topic: 'magnetism', lab: 'sandbox', grade: '11', unit: 'Тл', description: 'Индукция в центре круглого витка пропорциональна току и обратно пропорциональна радиусу.', effect: 'Виток с обозначенным направлением тока; его поле отклоняет движущиеся заряды.', model: 'Центральное значение B₀ условно распространено на диск. Это не расчёт полного неоднородного поля катушки или ферромагнетика. Большая μr — учебный множитель без модели насыщения.', params: [p('mu_m', '\\mu_r', 'Относительная проницаемость', '1', 1, 1000000, 1, 1000000), p('I', 'I', 'Ток', 'А', -10, 10, .5, 4), p('r', 'r', 'Радиус', 'м', 2, 8, .5, 4)] },
];
''']]},
{'path': 'src/core/persistence.ts', 'sha256': '24c5725d74d280c65e6218f0f310259f3cb5598d32b8ef12cdd66cbb5a425ee1', 'edits': [[0, 0, "import { standaloneParameters } from './entities';\n"], [2795, 2900, ' else {\n      if (!RECIPES.some(rec => multisetContains(rec.inputs, n.parts as string[]))) return fail();\n      for (const p of standaloneParameters(n.parts as string[])) {\n        const value = n.params[p.key] ?? p.initial; // v1 saves had no standalone parameters\n        if (!num(value, p.min, p.max)) return fail();\n        const ticks = (value - p.min) / p.step;\n        if (Math.abs(ticks - Math.round(ticks)) > 1e-5) return fail();\n        params[p.key] = value;\n      }'], [6602, 6618, "    throw new Error('Автосохранение повреждено; исходный JSON сохранён.');"], [6677, 6742, '  const clean = validateSave(save);\n  const old = localStorage.getItem(AUTO);\n  if (old) { try { parseSave(old); } catch { localStorage.setItem(`${AUTO}:recovery`, old); } }\n  localStorage.setItem(AUTO, JSON.stringify(clean));'], [6930, 6966, ''], [7014, 7050, ''], [7401, 7401, '\n  const previous = localStorage.getItem(SLOTS);\n  if (previous) localStorage.setItem(`${SLOTS}:recovery`, previous);']]},
{'path':'src/core/store.ts','sha256':'15162e1f0901a8e6733846792a2cf4936d1b850c0df16c188a1143e9391b934e','edits':[[0,8543,r'''import { defaults, RECIPE_MAP } from './catalog';
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
    ], selectedId: null, discoveries: [], paused: false, speed: 1, grid: true, vectors: true, trails: true, music: false, sound: true, lab: 'sandbox', activeId: null };
}
export type NoticeKind = 'info' | 'success' | 'error';
export class GameStore {
    private state: GameState;
    private listeners = new Set<() => void>();
    onNotice: (text: string, kind: NoticeKind) => void = () => {};
    onCraft: (sources: FormulaNode[], result: FormulaNode) => void = () => {};
    constructor(state: GameState = initialState()) { this.state = state; }
    getState = (): GameState => this.state;
    subscribe = (fn: () => void): (() => void) => { this.listeners.add(fn); return () => this.listeners.delete(fn); };
    private emit(next: GameState) { this.state = next; for (const f of this.listeners) f(); }
    patch(partial: Partial<GameState>) { this.emit({ ...this.state, ...partial }); }
    notify(message: string, kind: NoticeKind = 'info') { this.onNotice(message, kind); }
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
        if (!Object.hasOwn(SYMBOL_MAP, symbol)) return null;
        if (this.state.nodes.length >= MAX_NODES) { this.notify(`На холсте не больше ${MAX_NODES} элементов. Удалите лишние.`, 'error'); return null; }
        const id = uid();
        const node: FormulaNode = { id, parts: [symbol], x: clamp(x, 25, WIDTH - 25), y: clamp(y, 30, HEIGHT - 65), params: standaloneDefaults([symbol]), revision: 0, closed: true };
        this.patch({ nodes: [...this.state.nodes, node], selectedId: null, lab: 'sandbox', activeId: null });
        return id;
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
        const merged = mergeNodes(a, b, uid());
        if (!merged) { this.notify('Не соединяются: выберите совместимые символы.'); return false; }
        if (point) { merged.x = point.x; merged.y = point.y; }
        if (!merged.recipeId) merged.params = standaloneDefaults(merged.parts);
        this.onCraft([a, b], merged);
        this.state = { ...this.state, nodes: [...this.state.nodes.filter(n => n.id !== b.id && (!sourceOnBoard || n.id !== a.id)), merged] };
        if (merged.recipeId) this.discover(merged.recipeId, 'craft');
        else this.notify('Промежуточная комбинация. Добавьте недостающий символ.');
        // The new phenomenon is visible; its formula appears only after explicitly selecting it.
        this.patch({ selectedId: null, activeId: null, lab: 'sandbox' });
        return true;
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
        const recipe = RECIPE_MAP[recipeId];
        if (!recipe) return;
        const existing = this.state.nodes.find(n => n.recipeId === recipeId);
        if (existing) { this.restart(existing.id); this.focus(existing.id); return; }
        if (this.state.nodes.length >= MAX_NODES) { this.notify('Холст заполнен.', 'error'); return; }
        const node: FormulaNode = { id: uid(), parts: [...recipe.inputs], recipeId, x: 500, y: 340, params: defaults(recipe), revision: 0, closed: true };
        this.state = { ...this.state, nodes: [...this.state.nodes, node] };
        this.discover(recipeId, 'book');
        this.focus(node.id);
    }
    prepareRecipe(recipeId: string) {
        const recipe = RECIPE_MAP[recipeId];
        if (!recipe) return;
        if (this.state.nodes.length + recipe.inputs.length > MAX_NODES) { this.notify('Недостаточно места на холсте.', 'error'); return; }
        const nodes = recipe.inputs.map((symbol, i): FormulaNode => ({ id: uid(), parts: [symbol], x: 180 + i * (640 / Math.max(1, recipe.inputs.length - 1)), y: 290, params: standaloneDefaults([symbol]), revision: 0, closed: true }));
        this.patch({ nodes: [...this.state.nodes, ...nodes], selectedId: null, lab: 'sandbox', activeId: null });
        this.notify('Символы на холсте. Соедините их перетаскиванием.');
    }
    variant(nodeId: string, recipeId: string) {
        const node = this.state.nodes.find(n => n.id === nodeId), recipe = RECIPE_MAP[recipeId];
        if (!node || !recipe || !exactRecipes(node.parts).some(r => r.id === recipeId)) return;
        this.state = { ...this.state, nodes: this.state.nodes.map(n => n.id === nodeId ? { ...n, recipeId, params: defaults(recipe), revision: n.revision + 1 } : n) };
        this.discover(recipeId, 'craft');
        this.focus(nodeId);
    }
    setParam(id: string, key: string, value: number) {
        if (!Number.isFinite(value)) return;
        const node = this.state.nodes.find(n => n.id === id);
        if (!node) return;
        const def = (node.recipeId ? RECIPE_MAP[node.recipeId].params : standaloneParameters(node.parts)).find(p => p.key === key);
        if (!def) return;
        const clean = Number(clamp(Math.round((value - def.min) / def.step) * def.step + def.min, def.min, def.max).toFixed(8));
        if (node.params[key] === clean) return;
        // Parameter edits are not restarts: holes do not regenerate dust, bodies do not teleport.
        this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, params: { ...n.params, [key]: clean } } : n) });
    }
    restart(id: string) { this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, revision: n.revision + 1 } : n) }); }
    toggleCircuit(id: string) { this.patch({ nodes: this.state.nodes.map(n => n.id === id ? { ...n, closed: !n.closed } : n) }); }
    remove(id: string) { const nodes = this.state.nodes.filter(n => n.id !== id); this.patch({ nodes, selectedId: this.state.selectedId === id ? null : this.state.selectedId, activeId: this.state.activeId === id ? null : this.state.activeId, lab: this.state.activeId === id ? 'sandbox' : this.state.lab }); }
    reset() { this.patch({ nodes: [], selectedId: null, activeId: null, lab: 'sandbox', paused: false }); }
    load(state: GameState) {
        const known = new Map(this.state.discoveries.map(d => [d.recipeId, d]));
        for (const d of state.discoveries) if (!known.has(d.recipeId)) known.set(d.recipeId, d);
        this.emit({ ...state, music: false, discoveries: [...known.values()] });
    }
}
''']]},
{'path': 'src/core/symbols.ts', 'sha256': 'f121d58d26ad3a590ad63dac296f8f3c572a6d91ae86cc1b3bcb4df8815bd3f1', 'edits': [[2906, 2906, "    s('mu_m', '\\\\mu_r', 'Магнитная проницаемость', '1', 'magnetism'),\n"]]},
{'path':'src/physics/Runtime.ts','sha256':'c5966dfb702ef1628fe3b41be27e67cd0b596bad6f050f8bad7299964db0c1d2','edits':[[0,2699,r'''import { RECIPE_MAP } from '../core/catalog';
import { hasBodies } from '../core/entities';
import type { GameStore } from '../core/store';
import type { GameState, RuntimeSnapshot } from '../core/types';
import { MAX_BODIES, PX_PER_M } from '../core/types';
import { FxSystem } from '../rendering/FxSystem';
import { blackHoleAcceleration } from './fieldModel';
import { blackHoleGeometry } from './geometry';
import { PhysicsWorld } from './World';
export class SimulationRuntime {
    world = new PhysicsWorld();
    fx = new FxSystem();
    time = 0;
    ages = new Map<string, number>();
    heldNode: string | null = null;
    private revisions = new Map<string, number>();
    private accumulator = 0;
    private unsubscribe: () => void;
    private state: GameState;
    private motions = new Map<string, { vx: number; vy: number }>();
    private capturedOwners = new Set<string>();
    constructor(private store: GameStore) {
        this.state = store.getState(); this.sync(this.state);
        this.unsubscribe = store.subscribe(() => this.sync(store.getState()));
        store.onCraft = (sources, result) => this.fx.craft(sources.map(n => ({ ...n, ...this.world.positionFor(n) })), result);
        this.world.onAbsorb = (item, hole) => {
            this.fx.capture(item.body.position.x, item.body.position.y, hole.x, hole.y, item.label);
            if (item.label && item.owner !== 'free' && item.owner !== hole.id) this.capturedOwners.add(item.owner);
        };
    }
    private sync(state: GameState) {
        this.state = state;
        const ids = new Set(state.nodes.map(n => n.id));
        for (const id of this.ages.keys()) if (!ids.has(id)) { this.ages.delete(id); this.revisions.delete(id); this.motions.delete(id); }
        for (const node of state.nodes) if (this.revisions.get(node.id) !== node.revision) { this.ages.set(node.id, 0); this.revisions.set(node.id, node.revision); }
        this.world.sync(state.nodes);
    }
    advance(realSeconds: number) {
        if (this.state.paused) { this.accumulator = 0; return; }
        this.accumulator += Math.min(Math.max(realSeconds, 0), .05) * this.state.speed;
        const dt = 1 / 120, positions = new Map<string, { x: number; y: number }>();
        let steps = 0;
        while (this.accumulator + 1e-10 >= dt && steps < 24) {
            this.time += dt; this.fx.step(dt);
            for (const node of this.state.nodes) {
                const circuit = node.recipeId && RECIPE_MAP[node.recipeId].lab === 'circuits';
                if (!circuit || node.closed) this.ages.set(node.id, (this.ages.get(node.id) ?? 0) + dt);
            }
            this.world.step(dt, this.ages, this.state.trails);
            const holes = this.state.nodes.filter(n => n.recipeId === 'blackhole');
            if (holes.length) for (const node of this.state.nodes) {
                if (node.id === this.heldNode || node.recipeId === 'blackhole' || hasBodies(node) || this.capturedOwners.has(node.id)) continue;
                const p = positions.get(node.id) ?? { x: node.x, y: node.y }, v = this.motions.get(node.id) ?? { vx: 0, vy: 0 };
                for (const hole of holes) {
                    const h = blackHoleGeometry(hole), dx = h.x - p.x, dy = h.y - p.y;
                    if (Math.hypot(dx, dy) < h.radius + 6) {
                        this.capturedOwners.add(node.id); this.world.absorbed.add(`node/${node.id}`);
                        if (this.world.absorbed.size > MAX_BODIES * 2) this.world.absorbed.delete(this.world.absorbed.values().next().value!);
                        this.fx.capture(p.x, p.y, h.x, h.y, node.recipeId ? '' : node.parts.join('')); break;
                    }
                    const a = blackHoleAcceleration(dx, dy, hole.params.M, h.radius), damping = Math.exp(-.6 * dt);
                    v.vx = (v.vx + a.x * PX_PER_M * dt) * damping; v.vy = (v.vy + a.y * PX_PER_M * dt) * damping;
                }
                p.x += v.vx * dt; p.y += v.vy * dt;
                positions.set(node.id, p); this.motions.set(node.id, v);
            }
            this.accumulator -= dt; steps++;
        }
        if (steps === 24) this.accumulator = Math.min(this.accumulator, dt);
        if (positions.size) this.store.moveMany(positions);
        for (const id of this.capturedOwners) if (![...this.world.bodies.values()].some(b => b.owner === id)) this.store.remove(id);
        this.capturedOwners.clear();
    }
    snapshot(): RuntimeSnapshot { return { time: this.time, ages: Object.fromEntries(this.ages), bodies: this.world.snapshot(), absorbed: [...this.world.absorbed] }; }
    restore(data: RuntimeSnapshot) { this.time = data.time; this.accumulator = 0; this.ages = new Map(Object.entries(data.ages)); this.motions.clear(); this.fx.clear(); this.world.restore(data.bodies, data.absorbed); }
    reset() { this.time = 0; this.accumulator = 0; this.ages.clear(); this.motions.clear(); this.fx.clear(); this.world.clearFreeBodies(); this.world.absorbed.clear(); }
    dispose() { this.unsubscribe(); this.store.onCraft = () => {}; this.world.dispose(); }
}
''']]},
{'path':'src/physics/World.ts','sha256':'342ac91eb68d0b64f5846633deb207c3b7f426ad68302ee5a16b4fcf7fb16d09','edits':[[0,11692,r'''import Matter from 'matter-js';
import { clamp, uid } from '../core/store';
import { hasBodies, isBareBody, tokenGlyph } from '../core/entities';
import { HEIGHT, MAX_BODIES, PX_PER_M, WIDTH } from '../core/types';
import type { BodySnapshot, FormulaNode } from '../core/types';
import { blackHoleAcceleration, fieldsForNode, insideField, rotateMagnetic, segmentDistance } from './fieldModel';
import { blackHoleGeometry } from './geometry';
export { blackHoleGeometry } from './geometry';

export const FLOOR = HEIGHT - 40;
export interface PhysicalBody {
    key: string; owner: string; body: Matter.Body; radius: number; label: string;
    trail: { x: number; y: number }[];
}
export class PhysicsWorld {
    engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 }, positionIterations: 10, velocityIterations: 10, enableSleeping: false });
    bodies = new Map<string, PhysicalBody>();
    absorbed = new Set<string>();
    private previous = new Map<string, FormulaNode>();
    private nodes: FormulaNode[] = [];
    private anchors = new Map<string, { x: number; y: number }>();
    private held: PhysicalBody | null = null;
    private heldMass = 2;
    private trailTick = 0;
    
    onCollision: () => void = () => {};
    onAbsorb: (item: PhysicalBody, hole: FormulaNode) => void = () => {};

    constructor() {
        const boundary = { isStatic: true, restitution: .25, friction: .1 };
        Matter.Composite.add(this.engine.world, [
            Matter.Bodies.rectangle(WIDTH / 2, FLOOR + 30, WIDTH + 100, 60, boundary),
            Matter.Bodies.rectangle(-30, HEIGHT / 2, 60, HEIGHT + 100, boundary),
            Matter.Bodies.rectangle(WIDTH + 30, HEIGHT / 2, 60, HEIGHT + 100, boundary),
            Matter.Bodies.rectangle(WIDTH / 2, -30, WIDTH + 100, 60, boundary),
        ]);
        Matter.Events.on(this.engine, 'collisionStart', (e: Matter.IEventCollision<Matter.Engine>) => {
            if (e.pairs.some(pair => !pair.isSensor && pair.bodyA.speed + pair.bodyB.speed > 1.5)) this.onCollision();
        });
    }
    spawn(x: number, y: number, mass = 2, owner = 'free', label = 'm', radius = 18, key = uid()): PhysicalBody | null {
        if (this.bodies.size >= MAX_BODIES) return null;
        const body = Matter.Bodies.circle(clamp(x, radius + 1, WIDTH - radius - 1), clamp(y, radius + 1, FLOOR - radius), radius, {
            friction: 0, frictionStatic: 0, frictionAir: 0, restitution: .38, slop: .01,
            isSensor: label === '',
            // Dust is light, non-colliding artwork. It must never shove matter away from the hole.
        });
        Matter.Body.setMass(body, mass);
        Matter.Body.setInertia(body, Infinity);
        const item: PhysicalBody = { key, owner, body, radius, label, trail: [] };
        this.bodies.set(key, item);
        Matter.Composite.add(this.engine.world, body);
        return item;
    }
    remove(key: string) {
        const item = this.bodies.get(key);
        if (!item) return;
        Matter.Composite.remove(this.engine.world, item.body);
        this.bodies.delete(key);
        if (this.held === item) this.held = null;
    }
    private capture(item: PhysicalBody, hole: FormulaNode) {
        this.absorbed.add(item.key);
        if (this.absorbed.size > MAX_BODIES * 2) this.absorbed.delete(this.absorbed.values().next().value!);
        this.onAbsorb(item, hole);
        this.remove(item.key);
    }
    positionFor(n: FormulaNode) {
        return this.bodies.get(`${n.id}/0`)?.body.position ?? { x: n.x, y: n.y };
    }
    sync(nodes: FormulaNode[]) {
        const valid = new Set(nodes.map(n => n.id));
        for (const item of [...this.bodies.values()]) if (item.owner !== 'free' && !valid.has(item.owner)) this.remove(item.key);
        for (const id of this.previous.keys()) if (!valid.has(id)) { this.previous.delete(id); this.anchors.delete(id); }
        this.nodes = nodes;
        for (const node of nodes) {
            const old = this.previous.get(node.id);
            if (hasBodies(node) || node.recipeId === 'blackhole') {
                if (!old || old.revision !== node.revision || old.recipeId !== node.recipeId) {
                    for (const item of [...this.bodies.values()]) if (item.owner === node.id) this.remove(item.key);
                    this.setup(node);
                } else {
                    for (const item of this.bodies.values()) if (item.owner === node.id && item.label) {
                        const mass = node.recipeId === 'momentum' && item.key.endsWith('/1') ? 2 : node.params.m ?? (isBareBody(node) ? 2 : 1);
                        if (node.params.m !== old.params.m) {
                            if (this.held === item) this.heldMass = mass;
                            else { Matter.Body.setMass(item.body, mass); Matter.Body.setInertia(item.body, Infinity); }
                        }
                        if ((node.params.v !== old.params.v || node.params.angle !== old.params.angle) && node.params.v !== undefined) this.launch(item, node.params.v, node.params.angle ?? 0);
                    }
                }
            }
            this.previous.set(node.id, node);
        }
    }
    private launch(item: PhysicalBody, speed: number, angle: number) {
        const a = angle * Math.PI / 180;
        Matter.Body.setVelocity(item.body, { x: speed * PX_PER_M / 60 * Math.cos(a), y: speed * PX_PER_M / 60 * Math.sin(a) });
    }
    private setup(n: FormulaNode) {
        const p = n.params, id = n.recipeId;
        const make = (x: number, y: number, mass = p.m ?? 2, index = 0, label = 'm', radius = 20) => this.spawn(x, y, mass, n.id, label, radius, `${n.id}/${index}`);
        if (id === 'blackhole') {
            const h = blackHoleGeometry(n);
            for (let i = 0; i < 10; i++) {
                const a = i * Math.PI / 5, distance = h.radius + 70 + i * 10;
                const b = make(h.x + Math.cos(a) * distance, h.y + Math.sin(a) * distance, .05, i, '', 5);
                if (b) Matter.Body.setVelocity(b.body, { x: -Math.sin(a) * 1.1, y: Math.cos(a) * 1.1 });
            }
            return;
        }
        if (isBareBody(n)) {
            const body = make(n.x, n.y, p.m ?? 2, 0, n.parts.includes('q') || n.parts.includes('q2') ? 'q' : tokenGlyph(n));
            if (body && p.v) this.launch(body, p.v, p.angle ?? 0);
            return;
        }
        if (!hasBodies(n)) return;
        let x = n.x, y = n.y;
        if (id === 'potential') y = FLOOR - 20 - p.h * PX_PER_M;
        if (id === 'friction') { x = 110; y = FLOOR - 20; }
        if (id === 'hooke') { x = n.x + p.x * PX_PER_M; y = n.y; }
        if (id === 'electricField') x = n.x - 90;
        if (id === 'lorentz') y = n.y - Math.min(120, (p.v / Math.max(.1, Math.abs(p.q * p.B))) * PX_PER_M);
        if (id === 'coulomb') x = n.x - p.r * PX_PER_M / 2;
        const charged = ['electricField', 'lorentz', 'coulomb'].includes(id ?? '');
        const body = make(x, y, p.m ?? (charged ? 1 : 2), 0, charged ? 'q' : 'm');
        this.anchors.set(n.id, { x: id === 'hooke' ? n.x : x, y });
        if (!body) return;
        if (id === 'kinetic' || id === 'momentum' || id === 'lorentz') this.launch(body, p.v, 0);
        if (id === 'electricField') this.launch(body, 2, 0);
        if (id === 'friction') this.launch(body, 6, 0);
        if (id === 'momentum') make(clamp(x + 190, 70, 900), y, 2, 1, 'm₂');
        if (id === 'coulomb') make(n.x + p.r * PX_PER_M / 2, y, 1, 1, 'q₂');
    }
    chargeOf(item: PhysicalBody): number {
        const n = this.nodes.find(n => n.id === item.owner);
        if (!n || !item.label.startsWith('q')) return 0;
        if (n.recipeId === 'coulomb') return (item.key.endsWith('/1') ? n.params.q2 : n.params.q) * 1e-6;
        return n.params.q ?? (n.parts.includes('q2') ? -1 : 1);
    }
    private accelerate(b: Matter.Body, ax: number, ay: number) {
        if (ax === 0 && ay === 0) return;
        Matter.Body.applyForce(b, b.position, { x: b.mass * ax * PX_PER_M / 1e6, y: b.mass * ay * PX_PER_M / 1e6 });
    }
    step(dt: number, ages: ReadonlyMap<string, number>, trails = true) {
        const fields = this.nodes.flatMap(fieldsForNode), holes = this.nodes.filter(n => n.recipeId === 'blackhole');
        const before = new Map<string, { x: number; y: number }>();
        for (const item of [...this.bodies.values()]) {
            if (item === this.held) continue;
            const b = item.body, n = this.nodes.find(n => n.id === item.owner), p = n?.params ?? {}, id = n?.recipeId;
            before.set(item.key, { ...b.position });
            let ax = 0, ay = 0, bz = 0;
            if (item.label) {
                if (id === 'weight' || id === 'potential') ay += p.g;
                if (id === 'newton') ax += p.a;
                if (id === 'impulse' && (ages.get(item.owner) ?? 0) < p.t) ax += p.F / b.mass;
                if (id === 'work') { const dx = b.position.x - (this.anchors.get(item.owner)?.x ?? n!.x); if (dx >= 0 && dx < p.d * PX_PER_M) ax += p.F / b.mass; }
                if (id === 'hooke') {
                    const anchor = this.anchors.get(item.owner)!;
                    ax += -p.k * (b.position.x - anchor.x) / PX_PER_M / b.mass - .12 * b.velocity.x * 60 / PX_PER_M;
                    if (!holes.length) { Matter.Body.setPosition(b, { x: b.position.x, y: anchor.y }); Matter.Body.setVelocity(b, { x: b.velocity.x, y: 0 }); }
                }
                if (id === 'friction') {
                    const dv = p.mu * p.g * PX_PER_M / 60 * dt;
                    Matter.Body.setVelocity(b, { x: Math.sign(b.velocity.x) * Math.max(0, Math.abs(b.velocity.x) - dv), y: b.velocity.y });
                }
                const q = this.chargeOf(item);
                for (const f of fields) {
                    if (!insideField(f, b.position.x, b.position.y)) continue;
                    if (f.kind === 'gravity') ay += f.value;
                    if (f.kind === 'electric') { ax += q / b.mass * f.value * Math.cos(f.angle); ay += q / b.mass * f.value * Math.sin(f.angle); }
                    if (f.kind === 'magnetic') bz += f.value;
                    if (f.kind === 'source') {
                        const dx = (f.x - b.position.x) / PX_PER_M, dy = (f.y - b.position.y) / PX_PER_M, dist = Math.hypot(dx, dy), denom = (dist * dist + .49) ** 1.5;
                        ax += f.value * dx / denom; ay += f.value * dy / denom;
                    }
                }
                if (bz && q) Matter.Body.setVelocity(b, rotateMagnetic(b.velocity.x, b.velocity.y, q / b.mass, bz, dt));
                if (id === 'coulomb') {
                    const other = this.bodies.get(`${n!.id}/${item.key.endsWith('/0') ? '1' : '0'}`);
                    if (other) {
                        const dx = (b.position.x - other.body.position.x) / PX_PER_M, dy = (b.position.y - other.body.position.y) / PX_PER_M, distance = Math.max(.4, Math.hypot(dx, dy));
                        const a = 8.9875517923e9 * q * this.chargeOf(other) / distance ** 2 / b.mass;
                        ax += a * dx / distance; ay += a * dy / distance;
                    }
                }
            }
            let captured = false;
            for (const hole of holes) {
                const h = blackHoleGeometry(hole), dx = h.x - b.position.x, dy = h.y - b.position.y;
                if (Math.hypot(dx, dy) < h.radius + item.radius * .22) { this.capture(item, hole); captured = true; break; }
                const a = blackHoleAcceleration(dx, dy, hole.params.M, h.radius);
                ax += a.x; ay += a.y;
                // Dissipation removes angular/outward energy; it never applies a repulsive force.
                const damping = Math.exp(-(.12 + .035 * hole.params.M) * dt);
                Matter.Body.setVelocity(b, { x: b.velocity.x * damping, y: b.velocity.y * damping });
            }
            if (captured) continue;
            const onFloor = b.position.y >= FLOOR - item.radius - .08 && Math.abs(b.velocity.y) < .16 && ay >= 0;
            if (onFloor && !b.isSensor) {
                Matter.Body.setPosition(b, { x: b.position.x, y: FLOOR - item.radius });
                Matter.Body.setVelocity(b, { x: b.velocity.x, y: 0 });
                ay = 0; // Contact reaction cancels gravity at rest, not a perpetual kick upward.
            }
            this.accelerate(b, ax, ay);
        }
        Matter.Engine.update(this.engine, dt * 1000);
        this.trailTick++;
        for (const item of [...this.bodies.values()]) {
            const b = item.body, prev = before.get(item.key);
            if (prev && item !== this.held) {
                const h = holes.find(n => { const g = blackHoleGeometry(n); return segmentDistance(prev.x, prev.y, b.position.x, b.position.y, g.x, g.y) < g.radius + item.radius * .22; });
                if (h) { this.capture(item, h); continue; }
            }
            if (!Number.isFinite(b.position.x + b.position.y + b.velocity.x + b.velocity.y)) { this.remove(item.key); continue; }
            const speed = Matter.Body.getSpeed(b);
            if (speed > 30) { const v = Matter.Body.getVelocity(b); Matter.Body.setVelocity(b, { x: v.x * 30 / speed, y: v.y * 30 / speed }); }
            if (!b.isSensor && b.position.y + item.radius > FLOOR + .1 && Math.abs(b.velocity.y) < .18) {
                Matter.Body.setPosition(b, { x: b.position.x, y: FLOOR - item.radius });
                Matter.Body.setVelocity(b, { x: b.velocity.x, y: 0 });
            }
            if (b.position.x < -50 || b.position.x > WIDTH + 50 || b.position.y < -50 || b.position.y > HEIGHT + 50) {
                if (b.isSensor) { this.remove(item.key); continue; }
                Matter.Body.setPosition(b, { x: clamp(b.position.x, item.radius, WIDTH - item.radius), y: clamp(b.position.y, item.radius, FLOOR - item.radius) });
                Matter.Body.setVelocity(b, { x: 0, y: 0 });
            }
            if (trails && this.trailTick % 3 === 0 && speed > .08) { item.trail.push({ ...b.position }); if (item.trail.length > 60) item.trail.shift(); }
            if (!trails) item.trail = [];
        }
    }
    pickBody(x: number, y: number): PhysicalBody | null {
        return [...this.bodies.values()].reverse().find(i => !!i.label && Math.hypot(x - i.body.position.x, y - i.body.position.y) <= i.radius + 10) ?? null;
    }
    pick(x: number, y: number): boolean { const i = this.pickBody(x, y); return i ? this.hold(i.key) : false; }
    hold(key: string): boolean {
        this.release();
        const item = this.bodies.get(key);
        if (!item) return false;
        this.held = item; this.heldMass = item.body.mass;
        Matter.Body.setStatic(item.body, true); return true;
    }
    drag(x: number, y: number) {
        if (!this.held) return;
        const r = this.held.radius;
        Matter.Body.setPosition(this.held.body, { x: clamp(x, r + 1, WIDTH - r - 1), y: clamp(y, r + 1, FLOOR - r) });
        this.held.trail = [];
    }
    release() {
        if (!this.held) return;
        Matter.Body.setStatic(this.held.body, false); Matter.Body.setMass(this.held.body, this.heldMass); Matter.Body.setInertia(this.held.body, Infinity);
        Matter.Body.setVelocity(this.held.body, { x: 0, y: 0 }); this.held = null;
    }
    snapshot(): BodySnapshot[] {
        return [...this.bodies.values()].map(({ body: b, key, owner, label, radius }) => ({ key, owner, x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y, angle: b.angle, av: b.angularVelocity, mass: b.isStatic ? this.heldMass : b.mass, radius, label }));
    }
    restore(bodies: BodySnapshot[], absorbed: string[]) {
        for (const key of [...this.bodies.keys()]) this.remove(key);
        this.absorbed = new Set(absorbed);
        for (const s of bodies) {
            const item = this.spawn(s.x, s.y, s.mass, s.owner, s.label, s.radius, s.key);
            if (item) { Matter.Body.setVelocity(item.body, { x: s.vx, y: s.vy }); Matter.Body.setAngle(item.body, s.angle); Matter.Body.setAngularVelocity(item.body, s.av); }
        }
    }
    clearFreeBodies() { for (const i of [...this.bodies.values()]) if (i.owner === 'free') this.remove(i.key); }
    dispose() { this.release(); Matter.Events.off(this.engine, 'collisionStart'); Matter.Composite.clear(this.engine.world, false); Matter.Engine.clear(this.engine); this.bodies.clear(); }
    getPhysicalRecipeCount() { return this.nodes.filter(hasBodies).length; }
}
''']]},
]
