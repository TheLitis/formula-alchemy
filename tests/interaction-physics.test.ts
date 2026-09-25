import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { GameStore } from '../src/core/store';
import { SimulationRuntime } from '../src/physics/Runtime';
import { FLOOR } from '../src/physics/World';
import { blackHoleAcceleration, rotateMagnetic, fieldsForNode, insideField } from '../src/physics/fieldModel';
import { blackHoleGeometry } from '../src/physics/geometry';
import { PX_PER_M } from '../src/core/types';
function session() { const s = new GameStore(); s.reset(); return { s, r: new SimulationRuntime(s) }; }
function advance(r: SimulationRuntime, seconds: number) { for (let i = 0; i < Math.round(seconds * 120); i++) r.advance(1 / 120); }
function body(r: SimulationRuntime, id: string) { return r.world.bodies.get(`${id}/0`)!.body; }

describe('standalone physical fields, real Matter.js', () => {
    for (const charge of [-1, 0, 1]) it(`E gives qE/m acceleration for charge ${charge}`, () => {
        const { s, r } = session(); s.addToken('E', 500, 330); const q = s.addToken('q', 430, 330)!;
        s.setParam(q, 'q', charge); advance(r, .5);
        expect(body(r, q).velocity.x * 60 / PX_PER_M).toBeCloseTo(charge * 3, 5);
        expect(body(r, q).velocity.y).toBeCloseTo(0, 8); r.dispose();
    });
    it('E does not accelerate neutral matter or an outside charge', () => {
        const { s, r } = session(); s.addToken('E', 500, 330);
        const m = s.addToken('m', 400, 320)!, q = s.addToken('q', 150, 150)!;
        advance(r, .8); expect(body(r, m).speed).toBe(0); expect(body(r, q).speed).toBe(0); r.dispose();
    });
    it('moving the field moves its actual force region', () => {
        const { s, r } = session(); const e = s.addToken('E', 800, 450)!, q = s.addToken('q', 300, 230)!;
        advance(r, .2); expect(body(r, q).speed).toBe(0);
        s.move(e, 310, 230); advance(r, .2); expect(body(r, q).velocity.x).toBeGreaterThan(.1); r.dispose();
    });
    for (const charge of [-1, 1]) for (const field of [-1, 1]) it(`B: q=${charge}, Bz=${field}, correct direction and constant speed`, () => {
        const { s, r } = session(); const B = s.addToken('B', 500, 340)!, q = s.addToken('q', 460, 300)!;
        s.setParam(B, 'B', field); s.setParam(q, 'q', charge); s.setParam(q, 'v', 4);
        const v = Matter.Body.getSpeed(body(r, q)); advance(r, 1);
        expect(Matter.Body.getSpeed(body(r, q))).toBeCloseTo(v, 7);
        expect(Math.sign(body(r, q).velocity.y)).toBe(charge * field); r.dispose();
    });
    it('B does not accelerate a stationary charge', () => {
        const { s, r } = session(); s.addToken('B', 500, 340); const q = s.addToken('q', 470, 340)!;
        advance(r, 2); expect(Matter.Body.getSpeed(body(r, q))).toBe(0); r.dispose();
    });
    it('magnetic rotation preserves energy even for large timesteps', () => {
        let v = { x: 2.4, y: -1.5 };
        for (let i = 0; i < 10000; i++) v = rotateMagnetic(v.x, v.y, 2, -4, .03);
        expect(Math.hypot(v.x, v.y)).toBeCloseTo(Math.hypot(2.4, 1.5), 9);
    });
    it('g standalone affects matter in its visible region', () => {
        const { s, r } = session(); const g = s.addToken('g', 500, 300)!, m = s.addToken('m', 420, 280)!;
        s.setParam(g, 'g', 10); advance(r, .4); expect(body(r, m).velocity.y * 60 / PX_PER_M).toBeCloseTo(4, 5); r.dispose();
    });
    it('zero E/B results in zero field, and a rotated E region is evaluated locally', () => {
        const { s, r } = session(); const id = s.addToken('E', 500, 340)!; s.setParam(id, 'angle', 90); s.setParam(id, 'E', 0);
        const f = fieldsForNode(s.getState().nodes[0])[0];
        expect(f.value).toBe(0); expect(insideField(f, 500, 490)).toBe(true); expect(insideField(f, 650, 340)).toBe(false); r.dispose();
    });
});

describe('capture, support contacts and direct movement', () => {
    it('black-hole acceleration is purely attractive in every direction', () => {
        for (let angle = 0; angle < 2 * Math.PI; angle += .1) {
            const dx = Math.cos(angle) * 350, dy = Math.sin(angle) * 350, a = blackHoleAcceleration(dx, dy, 20, 82);
            expect(a.x * dx + a.y * dy).toBeGreaterThan(0);
            expect(a.x * dy - a.y * dx).toBeCloseTo(0, 6);
        }
    });
    it('maximum mass captures bodies from the entire board; own dust is a sensor and is captured', () => {
        const { s, r } = session(); s.openRecipe('blackhole'); const hole = s.getState().nodes[0]; s.setParam(hole.id, 'M', 20);
        for (const dust of r.world.bodies.values()) expect(dust.body.isSensor).toBe(true);
        const keys = [[60,60],[940,60],[60,590],[940,590],[80,340],[920,340]].map(([x,y],i) => r.world.spawn(x,y,2,'free','m',18,`test-${i}`)!.key);
        advance(r, 7);
        for (const key of keys) expect(r.world.absorbed.has(key)).toBe(true);
        expect([...r.world.bodies.values()].filter(b => b.owner === hole.id)).toHaveLength(0);
        r.dispose();
    });
    it('fields and loose symbols are consumed, not left as invisible handles', () => {
        const { s, r } = session(); s.addToken('B',150,160);s.addToken('c',870,550);s.addToken('E',850,170);s.openRecipe('blackhole');
        const hole = s.getState().nodes.find(n => n.recipeId === 'blackhole')!;s.setParam(hole.id,'M',20); advance(r,7);
        expect(s.getState().nodes.map(n=>n.recipeId)).toEqual(['blackhole']);r.dispose();
    });
    it('fast inward motion cannot tunnel through the horizon', () => {
        const { s, r } = session();s.openRecipe('blackhole');const n=s.getState().nodes[0], h=blackHoleGeometry(n);
        const b=r.world.spawn(h.x-100,h.y,1,'free','m',18,'fast')!;Matter.Body.setVelocity(b.body,{x:500,y:0});
        advance(r,1/120);expect(r.world.absorbed.has('fast')).toBe(true);r.dispose();
    });
    for (const speed of [1,4]) it(`a falling body settles, does not sink or bounce indefinitely at ${speed}x`, () => {
        const { s, r }=session();s.openRecipe('weight');const n=s.getState().nodes[0];s.patch({speed});
        advance(r,12/speed); const b=body(r,n.id);expect(b.position.y).toBeLessThanOrEqual(FLOOR-20+.15);
        expect(b.position.y).toBeGreaterThan(FLOOR-21);expect(Math.abs(b.velocity.y)).toBeLessThan(.03);
        const y=b.position.y;advance(r,2/speed);expect(Math.abs(b.position.y-y)).toBeLessThan(.1);r.dispose();
    });
    it('mass and hole strength changes do not teleport or regenerate bodies', () => {
        const {s,r}=session();s.openRecipe('weight');const n=s.getState().nodes[0];advance(r,.3);const b=body(r,n.id), pos={...b.position};
        s.setParam(n.id,'m',5);expect(body(r,n.id)).toBe(b);expect(b.position).toEqual(pos);expect(b.mass).toBe(5);
        s.openRecipe('blackhole');const h=s.getState().nodes.find(n=>n.recipeId==='blackhole')!;
        const dust=[...r.world.bodies.values()].find(b=>b.owner===h.id)!.body;s.setParam(h.id,'M',20);
        expect([...r.world.bodies.values()].some(b=>b.body===dust)).toBe(true);r.dispose();
    });
    it('direct manipulation preserves the physical body identity and mass',()=>{
        const {s,r}=session();const id=s.addToken('m',320,230)!;s.setParam(id,'m',6);const b=body(r,id);
        r.world.hold(`${id}/0`);r.world.drag(540,350);expect(b.position.x).toBe(540);expect(b.position.y).toBe(350);
        r.world.release();expect(b.mass).toBe(6);expect(b.isStatic).toBe(false);r.dispose();
    });
});
