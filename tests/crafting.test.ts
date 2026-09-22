import { describe, expect, it } from 'vitest';
import { GameStore } from '../src/core/store';
import { MAX_NODES } from '../src/core/types';
import { candidates, exactRecipes, multisetContains } from '../src/core/crafting';
describe('crafting as a multiset, not string concatenation', () => {
    it('m + g combines and creates a discovery exactly once', () => {
        const s = new GameStore();
        expect(s.combine('seed-g', 'seed-m')).toBe(true);
        expect(s.getState().nodes).toHaveLength(1);
        expect(s.getState().nodes[0].recipeId).toBe('weight');
        expect(s.getState().discoveries).toHaveLength(1);
        s.openRecipe('weight');
        expect(s.getState().discoveries).toHaveLength(1);
    });
    it('g + h remains an intermediate and then m gives potential energy', () => {
        const s = new GameStore();
        s.reset();
        const g = s.addToken('g')!, h = s.addToken('h')!;
        expect(s.combine(g, h)).toBe(true);
        let node = s.getState().nodes[0];
        expect(node.recipeId).toBeUndefined();
        expect(node.parts).toHaveLength(2);
        expect(s.dropSymbol('m', node.id)).toBe(true);
        node = s.getState().nodes[0];
        expect(node.recipeId).toBe('potential');
    });
    it('m + v selects kinetic energy and allows momentum explicitly', () => {
        const s = new GameStore();
        s.reset();
        const m = s.addToken('m')!;
        s.dropSymbol('v', m);
        const n = s.getState().nodes[0];
        expect(n.recipeId).toBe('kinetic');
        expect(exactRecipes(n.parts).map(r => r.id)).toEqual(['kinetic', 'momentum']);
        s.variant(n.id, 'momentum');
        expect(s.getState().nodes[0].recipeId).toBe('momentum');
        s.variant(n.id, 'weight');
        expect(s.getState().nodes[0].recipeId).toBe('momentum');
    });
    it('invalid combinations do not consume ingredients', () => {
        const s = new GameStore();
        const a = s.addToken('Z')!, b = s.addToken('mu')!;
        const n = s.getState().nodes.length;
        expect(s.combine(a, b)).toBe(false);
        expect(s.getState().nodes.length).toBe(n);
    });
    it('an element cannot combine with itself', () => {
        const s = new GameStore();
        expect(s.combine('seed-m', 'seed-m')).toBe(false);
    });
    it('duplicates are counted and arbitrary algebra is not evaluated', () => {
        expect(multisetContains(['m', 'v'], ['m', 'm'])).toBe(false);
        expect(candidates(['<script>'])).toHaveLength(0);
    });
    it('preparing from the book does not count as discovery', () => {
        const s = new GameStore();
        s.reset();
        s.prepareRecipe('bohr');
        expect(s.getState().discoveries).toHaveLength(0);
        expect(s.getState().nodes.map(n => n.parts[0])).toEqual(['Z', 'n']);
    });
    it('values are finite, bounded and quantized; editing restarts only this node', () => {
        const s = new GameStore();
        s.openRecipe('bohr');
        const id = s.getState().selectedId!;
        s.setParam(id, 'n', 3.4);
        expect(s.getState().nodes.find(n => n.id === id)!.params.n).toBe(3);
        s.setParam(id, 'n', Infinity);
        expect(s.getState().nodes.find(n => n.id === id)!.params.n).toBe(3);
        s.setParam(id, 'n', 1e9);
        expect(s.getState().nodes.find(n => n.id === id)!.params.n).toBeLessThan(20);
    });
    it('node budget is enforced', () => {
        const s = new GameStore();
        for (let i = 0; i < MAX_NODES + 3; i++)
            s.addToken('m');
        expect(s.getState().nodes).toHaveLength(MAX_NODES);
    });
    it('reset retains discoveries and deletion removes selected lab', () => {
        const s = new GameStore();
        s.openRecipe('ohm');
        expect(s.getState().lab).toBe('circuits');
        s.remove(s.getState().selectedId!);
        expect(s.getState().lab).toBe('sandbox');
        s.reset();
        expect(s.getState().nodes).toHaveLength(0);
        expect(s.getState().discoveries).toHaveLength(1);
    });
});
