import { describe, expect, it } from 'vitest';
import { defaults, RECIPES } from '../src/core/catalog';
import { calculate, C, E_CHARGE, G, H, gamma } from '../src/core/evaluate';
import { SYMBOL_MAP, TOPICS } from '../src/core/symbols';
import { EFFECTS } from '../src/rendering/effects';
import { candidates, exactRecipes } from '../src/core/crafting';
describe('complete recipe catalogue', () => {
    it('covers nine school topics with unique, fully implemented recipes', () => {
        expect(RECIPES.length).toBe(48);
        expect(new Set(RECIPES.map(r => r.id)).size).toBe(RECIPES.length);
        expect(new Set(RECIPES.map(r => r.topic)).size).toBe(TOPICS.length);
        expect(Object.keys(EFFECTS).sort()).toEqual(RECIPES.map(r => r.id).sort());
    });
    for (const r of RECIPES) {
        it(`${r.id}: notation, units, handler, finite defaults and admissible input bounds`, () => {
            expect(r.description.length).toBeGreaterThan(35);
            expect(r.model.length).toBeGreaterThan(30);
            expect(r.effect.length).toBeGreaterThan(20);
            expect(r.tex).toBeTruthy();
            expect(r.unit).toBeTruthy();
            expect(typeof EFFECTS[r.id]).toBe('function');
            r.inputs.forEach(id => expect(SYMBOL_MAP[id]).toBeDefined());
            expect(exactRecipes([...r.inputs].reverse()).map(x => x.id)).toContain(r.id);
            for (let i = 1; i < r.inputs.length; i++)
                expect(candidates(r.inputs.slice(0, i)).map(x => x.id)).toContain(r.id);
            const params = defaults(r);
            expect(Number.isFinite(calculate(r.id, params).value)).toBe(true);
            for (const p of r.params) {
                expect(p.step).toBeGreaterThan(0);
                expect(p.min).toBeLessThan(p.max);
                expect(p.initial).toBeGreaterThanOrEqual(p.min);
                expect(p.initial).toBeLessThanOrEqual(p.max);
                for (const v of [p.min, p.max]) {
                    const reading = calculate(r.id, { ...params, [p.key]: v });
                    expect(Number.isNaN(reading.value)).toBe(false);
                    if (!Number.isFinite(reading.value))
                        expect(['lens', 'crossedFields']).toContain(r.id);
                }
            }
        });
    }
});
describe('numerical laws and SI conversions', () => {
    it('weight, kinetic energy and momentum', () => {
        expect(calculate('weight', { m: 2, g: 9.81 }).value).toBeCloseTo(19.62, 10);
        expect(calculate('kinetic', { m: 2, v: 4 }).value).toBe(16);
        expect(calculate('momentum', { m: 2, v: 4 }).value).toBe(8);
    });
    it('density converts litres into cubic metres', () => expect(calculate('density', { m: 2, V: 2 }).value).toBe(1000));
    it('Archimedes force uses displaced volume', () => expect(calculate('buoyancy', { rho: 1000, g: 10, V: 2 }).value).toBe(20));
    it('gas pressure returns kPa, not Pa', () => expect(calculate('idealGas', { nu: 1, T: 300, V: 10 }).value).toBeCloseTo(249.43387854));
    it('series and parallel resistances differ', () => {
        expect(calculate('series', { R: 10, R2: 10 }).value).toBe(20);
        expect(calculate('parallel', { R: 10, R2: 10 }).value).toBe(5);
    });
    it('capacitance in mF produces mC', () => expect(calculate('capacitor', { C: 2, U: 12 }).value).toBe(24));
    it('Lorentz force changes sign with charge and vanishes with B', () => {
        expect(calculate('lorentz', { q: -2, v: 3, B: 4 }).value).toBe(-24);
        expect(calculate('lorentz', { q: 2, v: 3, B: 0 }).value).toBe(0);
    });
    it('Coulomb charges are microcoulombs', () => expect(calculate('coulomb', { q: 1, q2: -1, r: 1 }).value).toBeCloseTo(-0.0089875517923));
    it('photoemission has a real energy threshold', () => {
        expect(calculate('photoelectric', { f: 3, W0: 3 }).value).toBe(0);
        expect(calculate('photoelectric', { f: 10, W0: 2 }).value).toBeCloseTo(H * 1e15 / E_CHARGE - 2);
    });
    it('refraction handles total internal reflection and equal indices', () => {
        expect(calculate('snell', { n1: 1.5, n2: 1, theta: 60 }).note).toContain('Полное');
        expect(calculate('snell', { n1: 1, n2: 1, theta: 35 }).value).toBeCloseTo(35);
    });
    it('thin lens gives real, virtual and infinite images', () => {
        expect(calculate('lens', { focus: 20, d: 40 }).value).toBe(40);
        expect(calculate('lens', { focus: 20, d: 10 }).value).toBe(-20);
        expect(calculate('lens', { focus: 20, d: 20 }).value).toBe(Infinity);
    });
    it('half life is not a fixed loss per second', () => {
        expect(calculate('decay', { N0: 100, half: 2 }, 2).value).toBe(50);
        expect(calculate('decay', { N0: 100, half: 2 }, 4).value).toBe(25);
    });
    it('relativity uses beta < 1 and grams to kg', () => {
        expect(gamma(0)).toBe(1);
        expect(gamma(.8)).toBeCloseTo(5 / 3);
        expect(calculate('lengthContraction', { beta: .8, L: 10 }).value).toBeCloseTo(6);
        expect(calculate('massEnergy', { m: 1 }).value).toBeCloseTo(.001 * C * C);
    });
    it('gravitation has inverse square dependence', () => {
        expect(calculate('gravitation', { M: 1, m: 1, r: 1 }).value).toBeCloseTo(G * 1e12);
        expect(calculate('gravitation', { M: 1, m: 1, r: 2 }).value).toBeCloseTo(G * 1e12 / 4);
    });
    it('unknown laws fail rather than silently fabricating a result', () => expect(() => calculate('not-a-law', {})).toThrow());
});
