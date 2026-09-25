import type { FormulaNode, Parameter } from './types';

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
