import Matter from 'matter-js';
import { afterEach, describe, expect, it } from 'vitest';
import { GameStore } from '../src/core/store';
import { SimulationRuntime } from '../src/physics/Runtime';
import { EditorController } from '../src/editor/EditorController';
import { HitRegistry, recordCircle, recordFor, recordRect } from '../src/rendering/interaction';
import { fieldsForNode, insideField } from '../src/physics/fieldModel';
import { apparatusTransform, collectSpeedReadings } from '../src/physics/speedReadings';
import { makeSave, parseSave } from '../src/core/persistence';
import { rotateVector } from '../src/editor/geometry';
import { PX_PER_M } from '../src/core/types';
const sessions: { e: EditorController; r: SimulationRuntime }[] = [];
function session() { const s = new GameStore(); s.reset(); s.patch({paused:true}); const r=new SimulationRuntime(s),e=new EditorController(s,r);sessions.push({e,r});return {s,r,e}; }
function advance(s:GameStore,r:SimulationRuntime,sec:number){s.patch({paused:false});for(let i=0;i<sec*120;i++)r.advance(1/120);s.patch({paused:true});}
function b(r:SimulationRuntime,id:string){return r.world.bodies.get(`${id}/0`)!.body;}
afterEach(()=>{for(const {e,r} of sessions){e.dispose();r.dispose();}sessions.length=0;recordFor(null);});

describe('undoable scene commands',()=>{
    it('creation, deletion and redo restore bodies with mass and velocity, not just node records',()=>{
        const {s,r,e}=session();const id=s.addToken('m',300,230)!;s.setParam(id,'m',5);s.setParam(id,'v',4);advance(s,r,.3);
        const snapshot=r.snapshot();e.select([id]);e.deleteSelection();expect(s.getState().nodes).toHaveLength(0);
        e.undo();expect(r.snapshot()).toEqual(snapshot);expect(b(r,id).mass).toBe(5);expect(s.getState().selectedId).toBe(id);
        e.redo();expect(r.world.bodies.size).toBe(0);expect(s.getState().nodes).toHaveLength(0);
    });
    it('a drag with rotations and 100 pointer updates is one history entry; velocities are preserved',()=>{
        const {s,r,e}=session();const a=s.addToken('m',250,250)!,q=s.addToken('q',440,250)!;s.setParam(a,'v',3);s.setParam(q,'v',5);
        e.select([a,q]);e.history.clear();const before=r.snapshot();e.beginMove();for(let i=0;i<100;i++)e.move(.2,.1);e.rotate(90);e.endMove();
        expect(e.history.getState().count).toBe(1);expect(Matter.Body.getSpeed(b(r,a))).toBeCloseTo(3*PX_PER_M/60,8);
        expect(b(r,a).velocity.x).toBeCloseTo(0,8);expect(b(r,a).velocity.y).toBeGreaterThan(0);
        const after=r.snapshot();e.undo();expect(r.snapshot()).toEqual(before);e.redo();expect(r.snapshot()).toEqual(after);
        expect([...r.world.bodies.values()].every(v=>!v.body.isStatic)).toBe(true);
    });
    it('cancel returns pose, velocities and anchors exactly, and creates no extra history entry',()=>{
        const {s,r,e}=session();s.openRecipe('hooke');const id=s.getState().nodes[0].id;advance(s,r,.3);e.select([id]);e.history.clear();
        const saved=makeSave(s.getState(),r.snapshot(),'before');e.beginMove();e.move(90,70);e.rotate(135);e.cancelMove();
        expect(r.snapshot()).toEqual(saved.runtime);expect(s.getState().nodes).toEqual(saved.state.nodes);expect(e.history.getState().canUndo).toBe(false);
    });
    it('craft undo restores both ingredients and their physical state; journal discovery stays unlocked',()=>{
        const {s,r,e}=session();const m=s.addToken('m',300,300)!,g=s.addToken('g',600,300)!;s.setParam(m,'v',2);
        const before=r.snapshot();e.history.clear();s.combine(g,m,{x:350,y:330});expect(s.getState().nodes[0].recipeId).toBe('weight');
        e.undo();expect(s.getState().nodes.map(n=>n.id)).toEqual([m,g]);expect(r.snapshot()).toEqual(before);expect(s.getState().discoveries).toHaveLength(1);
        e.redo();expect(s.getState().nodes).toHaveLength(1);expect(r.world.bodies.size).toBe(1);
    });
    it('selection and simulation ticks do not create edits; new edit after undo clears redo',()=>{
        const {s,r,e}=session();const a=s.addToken('m')!,c=s.addToken('c')!;e.history.clear();e.select([a,c]);e.select([a],'toggle');advance(s,r,1);
        expect(e.history.getState().count).toBe(0);e.select([c]);e.move(10,0);e.undo();expect(e.history.getState().canRedo).toBe(true);e.rotate();expect(e.history.getState().canRedo).toBe(false);
    });
    it('history is bounded; snapshots do not retain growing physics-frame recordings',()=>{
        const {s,e}=session();const a=s.addToken('c',500,300)!;e.select([a]);e.history.clear();for(let i=0;i<90;i++)e.move(i%2?1:-1,0);
        expect(e.history.getState().count).toBe(60);for(let i=0;i<60;i++)e.undo();expect(e.history.getState().canUndo).toBe(false);
    });
    it('coalesces rapid slider changes and nudge repeats; one undo goes back to the initial value',()=>{
        const {s,e}=session();const a=s.addToken('m')!;e.select([a]);e.history.clear();for(let i=21;i<50;i++)s.setParam(a,'m',i/10);
        expect(e.history.getState().count).toBe(1);e.undo();expect(s.getState().nodes[0].params.m).toBe(2);
        e.history.clear();for(let i=0;i<8;i++)e.move(1,0,'nudge');expect(e.history.getState().count).toBe(1);
    });
    it('undo does not toggle music, sound, playback speed or user display preferences',()=>{
        const {s,e}=session();s.addToken('m');s.patch({sound:false,music:true,speeds:false,grid:false,speed:4});e.undo();
        expect(s.getState()).toMatchObject({sound:false,music:true,speeds:false,grid:false,speed:4});
    });
    it('group duplicate has independent IDs, copied speeds and separate physical bodies; undo removes just the copies',()=>{
        const {s,r,e}=session();const a=s.addToken('m',200,230)!,f=s.addToken('E',600,300)!;s.setParam(a,'v',3);e.select([a,f]);e.history.clear();e.duplicate();
        expect(e.ids).toHaveLength(2);expect(e.ids).not.toContain(a);expect(s.getState().nodes).toHaveLength(4);expect(r.world.bodies.size).toBe(2);
        const copy=s.getState().nodes.find(n=>n.parts[0]==='m'&&n.id!==a)!;expect(b(r,copy.id).position.x-b(r,a).position.x).toBe(32);expect(b(r,copy.id).velocity).toEqual(b(r,a).velocity);
        e.undo();expect(s.getState().nodes.map(n=>n.id)).toEqual([a,f]);e.redo();expect(s.getState().nodes).toHaveLength(4);
    });
    it('duplicates near the edge without invalid persisted positions',()=>{
        const {s,r,e}=session();const a=s.addToken('c',975,300)!,m=s.addToken('m',30,500)!;e.select([a,m]);e.duplicate();
        expect(()=>parseSave(JSON.stringify(makeSave(s.getState(),r.snapshot(),'edge')))).not.toThrow();
    });
    it('group deletion removes all owned bodies (including the second collision body) atomically',()=>{
        const {s,r,e}=session();s.openRecipe('momentum');const a=s.getState().nodes[0].id;const f=s.addToken('B',500,300)!;e.select([a,f]);e.history.clear();e.deleteSelection();
        expect(r.world.bodies.size).toBe(0);expect(e.ids).toEqual([]);expect(e.history.getState().count).toBe(1);e.undo();expect(r.world.bodies.size).toBe(2);expect(e.ids).toEqual([a,f]);
    });
    it('clear and load are atomic edits restoring the correct runtime times',()=>{
        const {s,r,e}=session();s.addToken('m');advance(s,r,.8);const snapshot=makeSave(s.getState(),r.snapshot(),'one');e.clear();expect(r.time).toBe(0);e.undo();expect(r.time).toBeCloseTo(.8);
        e.load(snapshot);e.clear();e.undo();expect(r.time).toBeCloseTo(.8);expect(r.world.bodies.size).toBe(1);
    });
});

describe('rotation changes the actual physics and render transforms together',()=>{
    for(const kind of ['E','g'])it(`${kind} rotates its real region and direction by R, not only the letter`,()=>{
        const {s,r,e}=session();const f=s.addToken(kind,500,300)!,id=s.addToken(kind==='E'?'q':'m',450,300)!;
        e.select([f]);e.rotate(90);const field=fieldsForNode(s.getState().nodes[0])[0];expect(field.angle).toBeCloseTo(Math.PI/2);expect(insideField(field,500,440)).toBe(true);
        advance(s,r,.2);if(kind==='E'){expect(b(r,id).velocity.y).toBeGreaterThan(.1);expect(b(r,id).velocity.x).toBeCloseTo(0,8);}else{expect(b(r,id).velocity.x).toBeLessThan(-.1);expect(b(r,id).velocity.y).toBeCloseTo(0,8);}
    });
    it('newton and impulse acceleration follows the rotated object orientation',()=>{
        const {s,r,e}=session();s.openRecipe('newton');const n=s.getState().nodes[0];e.select([n.id]);e.rotate(90);advance(s,r,.2);
        expect(b(r,n.id).velocity.y).toBeGreaterThan(.1);expect(b(r,n.id).velocity.x).toBeCloseTo(0,8);
    });
    it('rotated spring remains on its axis after release, and does not teleport to its old y',()=>{
        const {s,r,e}=session();s.openRecipe('hooke');const n=s.getState().nodes[0];e.select([n.id]);e.rotate(90);const anchor=r.world.snapshotAnchors()[n.id];advance(s,r,.2);
        expect(b(r,n.id).position.x).toBeCloseTo(anchor.x,5);expect(Math.abs(b(r,n.id).position.y-anchor.y)).toBeGreaterThan(1);
    });
    it('two selected bodies rotate rigidly with speed magnitudes unchanged',()=>{
        const {s,r,e}=session();const a=s.addToken('m',300,300)!,z=s.addToken('q',600,300)!;s.setParam(a,'v',4);e.select([a,z]);e.rotate(90);
        expect(b(r,a).position.x).toBeCloseTo(450);expect(b(r,z).position.x).toBeCloseTo(450);
        expect(b(r,z).position.y-b(r,a).position.y).toBeCloseTo(300);expect(Matter.Body.getSpeed(b(r,a))).toBeCloseTo(4*PX_PER_M/60);
    });
    it('group boundary clamp applies one common delta and preserves separation',()=>{
        const {s,r,e}=session();const a=s.addToken('m',100,150)!,z=s.addToken('q',700,150)!;e.select([a,z]);e.move(1000,0);
        expect(b(r,z).position.x-b(r,a).position.x).toBeCloseTo(600);expect(b(r,z).position.x).toBeLessThan(980);
    });
    it('rotated apparatus hit recording and speed label share the same affine transform',()=>{
        const {s,r,e}=session();s.openRecipe('gravitation');const id=s.getState().nodes[0].id;e.select([id]);e.rotate(90);
        const n=s.getState().nodes[0],t=apparatusTransform(n,'sandbox');const center=rotateVector({x:500*t.scale,y:360*t.scale},t.angle);
        expect(t.tx+center.x).toBeCloseTo(n.x);expect(t.ty+center.y).toBeCloseTo(n.y);
        const labels=collectSpeedReadings({...s.getState(),lab:'sandbox'},r.world,r.ages);expect(labels.length).toBeGreaterThan(0);expect(labels[0].value).not.toBeNaN();
        const hits=new HitRegistry();recordFor({registry:hits,target:{nodeId:id,kind:'apparatus',x:n.x,y:n.y},...t});recordCircle(500,360,20,true);recordFor(null);expect(hits.pick(n.x,n.y)?.nodeId).toBe(id);
    });
    it('rotation and multiple selection survive saving, including old v1 compatibility',()=>{
        const {s,r,e}=session();const a=s.addToken('E',350,300)!,c=s.addToken('c',600,300)!;e.select([a,c]);e.rotate(135);
        const data=parseSave(JSON.stringify(makeSave(s.getState(),r.snapshot(),'rotated')));expect(data.state.selectedIds).toEqual([a,c]);expect(data.state.nodes.map(n=>n.rotation)).toEqual([135,135]);
        const old=structuredClone(data);delete old.state.selectedIds;for(const n of old.state.nodes)delete n.rotation;delete old.runtime.anchors;delete old.runtime.motions;
        expect(()=>parseSave(JSON.stringify(old))).not.toThrow();
        (data.state.nodes[0] as any).rotation='bad';expect(()=>parseSave(JSON.stringify(data))).toThrow();
    });
    it('snapshot while held preserves finite mass and pre-drag velocity for autosave',()=>{
        const {s,r,e}=session();const id=s.addToken('m',250,250)!;s.setParam(id,'v',6);e.select([id]);e.beginMove();e.rotate(90);
        const save=parseSave(JSON.stringify(makeSave(s.getState(),r.snapshot(),'held')));expect(save.runtime.bodies[0].vy).toBeCloseTo(6*PX_PER_M/60);expect(save.runtime.bodies[0].mass).toBe(2);e.endMove();
    });
});

describe('marquee uses drawn shape intersections, not hidden handle positions',()=>{
    it('circle intersection and line intersection include touched objects and exclude empty corner',()=>{
        const h=new HitRegistry();h.add({nodeId:'a',kind:'node',x:100,y:100},{type:'circle',x:100,y:100,r:20,filled:true});h.add({nodeId:'b',kind:'node',x:500,y:100},{type:'line',x:200,y:100,x2:300,y2:200});
        expect(h.inBox({x:114,y:96,w:20,h:8})).toEqual(['a']);expect(h.inBox({x:118,y:118,w:8,h:8})).toEqual([]);expect(h.inBox({x:245,y:145,w:10,h:10})).toEqual(['b']);
    });
    it('an empty center of an orbit is not the orbital line',()=>{
        const h=new HitRegistry();h.add({nodeId:'a',kind:'node',x:100,y:100},{type:'circle',x:100,y:100,r:70,filled:false});
        expect(h.inBox({x:90,y:90,w:20,h:20})).toEqual([]);expect(h.inBox({x:165,y:90,w:10,h:20})).toEqual(['a']);
    });
    it('rotated rectangle SAT rejects AABB corners outside the actual geometry',()=>{
        const h=new HitRegistry();recordFor({registry:h,target:{nodeId:'a',kind:'apparatus',x:0,y:0},tx:200,ty:200,scale:1,angle:Math.PI/4});recordRect(-50,-5,100,10);recordFor(null);
        expect(h.inBox({x:196,y:196,w:8,h:8})).toEqual(['a']);expect(h.inBox({x:165,y:230,w:3,h:3})).toEqual([]);
    });
});
