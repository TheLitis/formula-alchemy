import { RECIPES, defaults } from './catalog';
import type { FormulaNode, Recipe } from './types';
export function multisetContains(whole: readonly string[], part: readonly string[]): boolean {
    const counts = new Map<string, number>();
    for (const x of whole)
        counts.set(x, (counts.get(x) ?? 0) + 1);
    for (const x of part) {
        const n = counts.get(x) ?? 0;
        if (n === 0)
            return false;
        counts.set(x, n - 1);
    }
    return true;
}
export const candidates = (parts: readonly string[]): Recipe[] => RECIPES.filter(r => multisetContains(r.inputs, parts));
export const exactRecipes = (parts: readonly string[]): Recipe[] => candidates(parts).filter(r => r.inputs.length === parts.length);
export const missingParts = (parts: readonly string[], recipe: Recipe): string[] => {
    const rest = [...recipe.inputs];
    for (const id of parts) {
        const i = rest.indexOf(id);
        if (i >= 0)
            rest.splice(i, 1);
    }
    return rest;
};
export function mergeNodes(a: FormulaNode, b: FormulaNode, id: string): FormulaNode | null {
    if (a.id === b.id)
        return null;
    const parts = [...a.parts, ...b.parts];
    if (!candidates(parts).length)
        return null;
    const recipe = exactRecipes(parts)[0];
    return { id, parts, x: b.x, y: b.y, recipeId: recipe?.id, params: recipe ? defaults(recipe) : {}, revision: 0, closed: true };
}
