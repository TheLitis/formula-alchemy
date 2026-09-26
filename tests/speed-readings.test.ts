import Matter from 'matter-js';
import { describe, expect, it } from 'vitest';
import { defaults, RECIPES, RECIPE_MAP } from '../src/core/catalog';
import { GameStore, initialState } from '../src/core/store';
import { makeSave, validateSave } from '../src/core/persistence';
import type { FormulaNode } from '../src/core/types';
import { SimulationRuntime } from '../src/physics/Runtime';
import { apparatusSpeed, apparatusTransform, collectSpeedReadings, speedText } from '../src/physics/speedReadings';
import { drawSpeedLabels } from '../src/rendering/speedLabels';
import { getViewport } from '../src/rendering/Renderer';

const node = (id: string): FormulaNode => ({ id, recipeId: id, parts: RECIPE_MAP[id].inputs, params: defaults(RECIPE_MAP[id]), x: 500, y: 340, revision: 0, closed: true });
function experiment(id: string) {
    const store = new GameStore({ ...initialState(), nodes: [] });
    const runtime = new SimulationRuntime(store); store.openRecipe(id); store.patch({lab: 'sandbox', activeId: null});
    return { store, runtime, n: store.getState().nodes[0] };
}
function canvasRecorder() {
    const texts: string[] = [];
    const c = { save() {}, restore() {}, measureText(t: string) { return { width: t.length * 6 }; }, strokeText() {}, fillText(t: string) { texts.push(t); } } as unknown as CanvasRenderingContext2D;
    return { c, texts };
}
describe('speed belongs to the object, not UI movement', () => {
    it('uses both normalized Matter velocity components in physical m/s', () => {
        const {store,runtime,n}=experiment('kinetic'), b=runtime.world.bodies.get(`${n.id}/0`)!;
        Matter.Body.setVelocity(b.body,{x:3*32/60,y:4*32/60});
        expect(collectSpeedReadings(store.getState(),runtime.world,runtime.ages)[0].value).toBeCloseTo(5,8);
        runtime.dispose();
    });
    it('never multiplies readouts by the simulation playback speed', () => {
        const {store,runtime}=experiment('kinetic');
        const before=collectSpeedReadings(store.getState(),runtime.world,runtime.ages)[0];
        store.patch({speed:4});
        expect(collectSpeedReadings(store.getState(),runtime.world,runtime.ages)[0].value).toBe(before.value);
        runtime.dispose();
    });
    it('shows changing velocity, rather than the initial-velocity control', () => {
        const {store,runtime}=experiment('weight');
        store.setParam(store.getState().nodes[0].id,'g',10);
        for(let i=0;i<60;i++)runtime.advance(1/120);
        expect(collectSpeedReadings(store.getState(),runtime.world,runtime.ages)[0].value).toBeCloseTo(5,1);
        runtime.dispose();
    });
    it('includes both colliding bodies and labels stopped selections as 0', () => {
        const {store,runtime}=experiment('momentum');
        const readings=collectSpeedReadings(store.getState(),runtime.world,runtime.ages);
        expect(readings).toHaveLength(2);expect(readings[1].value).toBe(0);runtime.dispose();
    });
    it('reports zero while dragging instead of mistaking mouse movement for velocity', () => {
        const {store,runtime,n}=experiment('kinetic');runtime.world.hold(`${n.id}/0`);runtime.world.drag(650,400);
        expect(collectSpeedReadings(store.getState(),runtime.world,runtime.ages)[0].value).toBe(0);runtime.dispose();
    });
    it('does not attach readouts to fields, constants, black holes or their decorative dust', () => {
        const {store,runtime}=experiment('blackhole');
        for(const symbol of ['E','B','g','G','I','c'])store.addToken(symbol);
        expect(collectSpeedReadings(store.getState(),runtime.world,runtime.ages)).toEqual([]);runtime.dispose();
    });
    it('a magnetic-only field preserves the displayed speed', () => {
        const store=new GameStore({...initialState(),nodes:[]}),runtime=new SimulationRuntime(store);
        store.addToken('B',500,340);const q=store.addToken('q',500,340)!;store.setParam(q,'v',4);store.restart(q);
        const before=collectSpeedReadings(store.getState(),runtime.world,runtime.ages).find(r=>r.nodeId===q)!.value;
        for(let i=0;i<60;i++)runtime.advance(1/120);
        const after=collectSpeedReadings(store.getState(),runtime.world,runtime.ages).find(r=>r.nodeId===q)!.value;
        expect(after).toBeCloseTo(before,6);runtime.dispose();
    });
    it('satellite velocity is km/s without the ×200 animation factor', () => {
        const r=apparatusSpeed(node('gravitation'),0)!;
        expect(r.unit).toBe('км/с');expect(r.value).toBeCloseTo(7.544,2);
    });
    it('differentiates spring and pendulum displacement', () => {
        const s=node('springPeriod'),w=Math.sqrt(s.params.k/s.params.m);
        expect(apparatusSpeed(s,0)!.value).toBe(0);
        expect(apparatusSpeed(s,Math.PI/(2*w))!.value).toBeCloseTo(s.params.amplitude*w,8);
        const p=node('pendulum'),wp=Math.sqrt(p.params.g/p.params.L);
        expect(apparatusSpeed(p,Math.PI/(2*wp))!.value).toBeCloseTo(p.params.L*.20944*wp,8);
    });
    it('distinguishes wave propagation from material particle velocity', () => {
        const w=node('wave'),r=apparatusSpeed(w,2)!;
        expect(r.prefix).toBe('волна');expect(r.value).toBe(w.params.f*w.params.lambda);
    });
    it('relativistic rod shows its beta, not screen pixels per second', () => {
        expect(apparatusSpeed(node('lengthContraction'),2)).toMatchObject({value:.75,unit:'c'});
    });
    it('moving/scaling an analytic diagram affects label positions, not its physical speed', () => {
        const {store,runtime,n}=experiment('gravitation');
        const a=collectSpeedReadings(store.getState(),runtime.world,runtime.ages)[0];
        store.move(n.id,n.x+100,n.y+30);const b=collectSpeedReadings(store.getState(),runtime.world,runtime.ages)[0];
        expect(b.value).toBe(a.value);expect(b.x-a.x).toBeCloseTo(100);expect(b.y-a.y).toBeCloseTo(30);
        store.focus(n.id);expect(apparatusTransform(n,store.getState().lab).scale).toBe(.9);
        expect(apparatusTransform(node('springPeriod'),'waves').scale).toBe(.94);
        expect(collectSpeedReadings(store.getState(),runtime.world,runtime.ages)[0].value).toBe(a.value);runtime.dispose();
    });
    it('finite results for all supported parameter extrema', () => {
        for(const recipe of RECIPES)for(const mode of ['min','initial','max'] as const)for(const t of [0,.4,10]) {
            const n=node(recipe.id);n.params=Object.fromEntries(recipe.params.map(p=>[p.key,p[mode]]));
            const r=apparatusSpeed(n,t);if(r)expect(Number.isFinite(r.value+r.x+r.y),recipe.id).toBe(true);
        }
    });
    it('formats units without scientific/UI speed ambiguity or negative zero', () => {
        expect(speedText({value:-.00001,unit:'м/с'})).toBe('0,0 м/с');
        expect(speedText({value:.75,unit:'c'})).toBe('0,75 c');
    });
    it('migrates older saves and round-trips the independent visibility flag', () => {
        const {store,runtime}=experiment('kinetic');
        const old=makeSave(store.getState(),runtime.snapshot(),'old');delete (old.state as Partial<typeof old.state>).speeds;
        expect(validateSave(old).state.speeds).toBe(true);
        store.patch({speeds:false});expect(validateSave(makeSave(store.getState(),runtime.snapshot(),'new')).state.speeds).toBe(false);
        runtime.dispose();
    });
    it('puts small labels on moving bodies only, without creating Canvas hit targets', () => {
        const {store,runtime}=experiment('kinetic'),{c,texts}=canvasRecorder();
        store.select(null);
        const readings=collectSpeedReadings(store.getState(),runtime.world,runtime.ages);
        expect(drawSpeedLabels(c,readings,store.getState(),getViewport(1000,680))).toHaveLength(1);
        expect(texts[0]).toBe('4,0 м/с');
        store.patch({speeds:false});expect(drawSpeedLabels(c,readings,store.getState(),getViewport(1000,680))).toEqual([]);
        runtime.dispose();
    });
    it('clips safely and declutters dense scenes with a mobile label cap', () => {
        const {store,runtime}=experiment('kinetic'),{c}=canvasRecorder();
        store.select(null);
        const source=collectSpeedReadings(store.getState(),runtime.world,runtime.ages)[0];
        const readings=Array.from({length:30},(_,i)=>({...source,key:String(i),x:100+(i%6)*150,y:90+Math.floor(i/6)*110}));
        const labels=drawSpeedLabels(c,readings,store.getState(),getViewport(393,550));
        expect(labels.length).toBeLessThanOrEqual(7);
        for(const a of labels) {expect(a.x).toBeGreaterThanOrEqual(0);expect(a.x+a.w).toBeLessThanOrEqual(1000);expect(a.y+a.h).toBeLessThanOrEqual(636);}
        runtime.dispose();
    });
});
