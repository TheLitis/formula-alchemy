import { describe, expect, it } from 'vitest';
import { makeSave, parseSave, validateSave } from '../src/core/persistence';
import { GameStore } from '../src/core/store';
function sample() { const s = new GameStore(); s.openRecipe('ohm'); return makeSave(s.getState(), { time: 2, ages: {}, bodies: [], absorbed: [] }, 'Тест'); }
describe('versioned and validated experiments', () => {
    it('round trips JSON with state and runtime', () => { const x = sample(); expect(JSON.parse(JSON.stringify(parseSave(JSON.stringify(x))))).toEqual(JSON.parse(JSON.stringify(x))); });
    it('rejects unknown versions', () => expect(() => validateSave({ ...sample(), version: 2 })).toThrow());
    it('rejects malformed or oversized JSON', () => { expect(() => parseSave('{')).toThrow(); expect(() => parseSave(' '.repeat(500001))).toThrow(); });
    it('rejects arbitrary unknown symbols', () => { const x = sample(); x.state.nodes[0].parts = ['__proto__']; expect(() => validateSave(x)).toThrow(); });
    it('rejects invalid recipe-ingredient mappings', () => { const x = sample(); x.state.nodes.at(-1)!.parts = ['m', 'g']; expect(() => validateSave(x)).toThrow(); });
    it('rejects out-of-domain parameters', () => { const x = sample(); x.state.nodes.at(-1)!.params.R = 0; expect(() => validateSave(x)).toThrow(); });
    it('rejects NaN, duplicate ids and incorrect lab references', () => {
        const x = sample();
        x.runtime.time = NaN;
        expect(() => validateSave(x)).toThrow();
        const y = sample();
        y.state.nodes[0].id = y.state.nodes[1].id;
        expect(() => validateSave(y)).toThrow();
        const z = sample();
        z.state.lab = 'optics';
        expect(() => validateSave(z)).toThrow();
    });
    it('rejects fractional quantum numbers', () => { const s = new GameStore(); s.openRecipe('bohr'); const x = makeSave(s.getState(), { time: 0, ages: {}, bodies: [], absorbed: [] }, 'x'); x.state.nodes.at(-1)!.params.n = 1.5; expect(() => validateSave(x)).toThrow(); });
    it('merges discoveries and does not autoplay imported music', () => {
        const s = new GameStore();
        s.openRecipe('bohr');
        const x = sample();
        x.state.music = true;
        s.load(x.state);
        expect(s.getState().music).toBe(false);
        expect(s.getState().discoveries.map(d => d.recipeId).sort()).toEqual(['bohr', 'ohm']);
    });
    it('snapshots do not retain mutable references', () => { const s = new GameStore(), x = makeSave(s.getState(), { time: 0, ages: {}, bodies: [], absorbed: [] }, 'x'); x.state.nodes[0].x = 999; expect(s.getState().nodes[0].x).toBe(350); });
});

describe('standalone fields and unlabelled dust', () => {
    it('preserves signed fields and charge parameters including direction', () => {
        const store = new GameStore(); store.reset();const id=store.addToken('B',320,300)!;store.setParam(id,'B',-2);store.setParam(id,'extent',7);
        const charge=store.addToken('q',600,350)!;store.setParam(charge,'q',-1.5);store.setParam(charge,'v',5);
        const save=makeSave(store.getState(),{time:0,ages:{},bodies:[],absorbed:[]},'Поля');
        expect(parseSave(JSON.stringify(save)).state.nodes).toEqual(save.state.nodes);
    });
    it('accepts blank render labels on physical dust without allowing blank body keys',()=>{
        const s=new GameStore();const save=makeSave(s.getState(),{time:0,ages:{},bodies:[{key:'dust',owner:'free',x:400,y:300,vx:0,vy:0,angle:0,av:0,mass:.05,radius:5,label:''}],absorbed:[]},'Пыль');
        expect(parseSave(JSON.stringify(save)).runtime.bodies[0].label).toBe('');save.runtime.bodies[0].key='';expect(()=>parseSave(JSON.stringify(save))).toThrow();
    });
});
