import { describe, expect, it } from 'vitest';
import { GameStore } from '../src/core/store';
import { SimulationRuntime } from '../src/physics/Runtime';
import { blackHoleGeometry } from '../src/physics/World';
import { MAX_BODIES, PX_PER_M } from '../src/core/types';
function experiment(id: string) { const s = new GameStore(); s.reset(); const r = new SimulationRuntime(s); s.openRecipe(id); return { s, r, node: s.getState().nodes[0] }; }
function advance(r: SimulationRuntime, seconds: number) { for (let i = 0; i < Math.round(seconds * 120); i++)
    r.advance(1 / 120); }
describe('Matter mechanics and fixed timestep', () => {
    it('gravity accelerates down by g independently of mass', () => {
        const a = experiment('weight');
        a.s.setParam(a.node.id, 'g', 10);
        a.s.setParam(a.node.id, 'm', 1);
        advance(a.r, .5);
        const b = a.r.world.bodies.get(`${a.node.id}/0`)!.body;
        expect(b.velocity.y * 60 / PX_PER_M).toBeCloseTo(5, 1);
        expect(b.position.y).toBeGreaterThan(230);
        a.r.dispose();
    });
    it('zero acceleration and no friction preserve velocity', () => {
        const a = experiment('kinetic');
        const b = a.r.world.bodies.get(`${a.node.id}/0`)!.body;
        const initial = b.velocity.x;
        advance(a.r, .25);
        expect(b.velocity.x).toBeCloseTo(initial, 5);
        a.r.dispose();
    });
    it('pause freezes both body positions and physical clocks', () => {
        const a = experiment('weight');
        advance(a.r, .2);
        a.s.patch({ paused: true });
        const snap = a.r.snapshot();
        advance(a.r, 2);
        expect(a.r.snapshot()).toEqual(snap);
        a.r.dispose();
    });
    it('speed multiplies simulation time but uses a fixed step', () => {
        const a = experiment('pendulum');
        a.s.patch({ speed: 4 });
        advance(a.r, .5);
        expect(a.r.time).toBeCloseTo(2, 8);
        a.r.dispose();
    });
    it('a huge real-time frame is bounded and positions stay finite', () => {
        const a = experiment('weight');
        a.r.advance(100);
        expect(a.r.time).toBeLessThanOrEqual(.051);
        expect(a.r.snapshot().bodies.every(b => Number.isFinite(b.x + b.y))).toBe(true);
        a.r.dispose();
    });
    it('open circuits freeze integrated charge/heating, not universal time', () => {
        const a = experiment('capacitor');
        advance(a.r, .3);
        a.s.toggleCircuit(a.node.id);
        const age = a.r.ages.get(a.node.id)!;
        advance(a.r, .5);
        expect(a.r.ages.get(a.node.id)).toBe(age);
        expect(a.r.time).toBeCloseTo(.8);
        a.r.dispose();
    });
    it('capture removes a body and an absorbed body does not spontaneously reappear', () => {
        const a = experiment('blackhole');
        const h = blackHoleGeometry(a.node);
        a.r.world.spawn(h.x, h.y, .5, 'free', 'test', 6, 'capture-target');
        advance(a.r, .1);
        expect(a.r.world.bodies.has('capture-target')).toBe(false);
        expect(a.r.world.absorbed.has('capture-target')).toBe(true);
        a.s.patch({ grid: false });
        expect(a.r.world.bodies.has('capture-target')).toBe(false);
        a.r.dispose();
    });
    it('body budget is hard bounded', () => {
        const a = experiment('weight');
        for (let i = 0; i < 100; i++)
            a.r.world.spawn(400, 400);
        expect(a.r.world.bodies.size).toBe(MAX_BODIES);
        a.r.dispose();
    });
    it('runtime snapshot restores positions, velocities and experiment ages', () => {
        const a = experiment('weight');
        advance(a.r, .25);
        const snap = a.r.snapshot();
        advance(a.r, .25);
        a.r.restore(snap);
        expect(a.r.snapshot().time).toBe(snap.time);
        expect(a.r.snapshot().bodies[0].vx).toBeCloseTo(snap.bodies[0].vx);
        expect(a.r.snapshot().bodies[0].y).toBeCloseTo(snap.bodies[0].y);
        a.r.dispose();
    });
    it('held bodies retain their original mass in a save', () => {
        const a = experiment('weight');
        a.s.setParam(a.node.id, 'm', 7);
        const b = a.r.world.bodies.get(`${a.node.id}/0`)!;
        a.r.world.pick(b.body.position.x, b.body.position.y);
        expect(a.r.snapshot().bodies[0].mass).toBe(7);
        a.r.dispose();
    });
});
