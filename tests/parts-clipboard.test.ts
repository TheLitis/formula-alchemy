import Matter from 'matter-js';
import { afterEach, describe, expect, it } from 'vitest';
import { GameStore } from '../src/core/store';
import { SimulationRuntime } from '../src/physics/Runtime';
import { EditorController } from '../src/editor/EditorController';
import { PartGesture, registerParts, partToWorld } from '../src/editor/Parts';
import { decodeSelection, CLIPBOARD_KIND } from '../src/editor/Clipboard';
import { HitRegistry } from '../src/rendering/interaction';
import type { SceneTarget } from '../src/rendering/interaction';
import { oscillatorMotion, satelliteMotion, floatingMotion, inductionMotion } from '../src/physics/interactiveModels';
import { collectSpeedReadings } from '../src/physics/speedReadings';
import { makeSave, parseSave } from '../src/core/persistence';
import { MAX_NODES } from '../src/core/types';
const active:{r:SimulationRuntime;e:EditorController}[]=[];
function setup(recipe?:string){const s=new GameStore();s.reset();s.patch({paused:true});const r=new SimulationRuntime(s),e=new EditorController(s,r);active.push({r,e});if(recipe)s.openRecipe(recipe);const id=s.getState().nodes[0]?.id;return{s,r,e,id};}
type Session=ReturnType<typeof setup>;
const node=(a:Session)=>a.s.getState().nodes.find(n=>n.id===a.id)!;
const body=(a:Session,index=0)=>a.r.world.bodies.get(`${a.id}/${index}`)!.body;
function ticks(a:Session,count=60){a.s.patch({paused:false});for(let i=0;i<count;i++)a.r.advance(1/120);a.s.patch({paused:true});}
function target(a:Session,part:string,index=0):SceneTarget{
    if(part==='body')return{nodeId:a.id,kind:'body',partId:'body',bodyKey:`${a.id}/${index}`,...body(a,index).position};
    const h=new HitRegistry();registerParts(h,node(a),a.s.getState().lab,a.r.ages.get(a.id)??0,a.r.labStates.get(a.id));
    return h.targets().filter(t=>t.partId===part)[index]!;
}
function pull(a:Session,kind:string,x:number,y:number){const t=target(a,kind);expect(t).toBeTruthy();const p=new PartGesture(a.e,t,t);p.begin();p.update(partToWorld(node(a),a.s.getState().lab,{x,y}));return p;}
afterEach(()=>{for(const a of active){a.e.dispose();a.r.dispose();}active.length=0;});

describe('selection clipboard, exact states and bounded history',()=>{
    it('copies a group without editing or deleting it; paste creates distinct owners and preserves velocities',()=>{
        const a=setup(),m=a.s.addToken('m',260,230)!,q=a.s.addToken('q',450,300)!;a.s.setParam(m,'v',4);a.s.setParam(q,'q',-2);a.e.select([m,q]);a.e.history.clear();
        const before=a.r.snapshot(),text=a.e.copy()!;expect(JSON.parse(text).kind).toBe(CLIPBOARD_KIND);expect(a.e.history.getState().count).toBe(0);expect(a.r.snapshot()).toEqual(before);
        expect(a.e.paste()).toBe(true);expect(a.s.getState().nodes).toHaveLength(4);const ids=a.e.ids;expect(ids).toHaveLength(2);expect(ids.every(id=>![m,q].includes(id))).toBe(true);
        expect(a.r.world.bodies.get(`${ids[0]}/0`)!.body.velocity).toEqual(before.bodies[0].vx===0?{x:0,y:0}:{x:before.bodies[0].vx,y:before.bodies[0].vy});
        expect(a.s.getState().nodes.find(n=>n.id===ids[1])!.params.q).toBe(-2);expect(a.e.history.getState().count).toBe(1);
        a.e.undo();expect(a.r.snapshot()).toEqual(before);a.e.redo();expect(a.s.getState().nodes).toHaveLength(4);
    });
    it('cut is one undoable deletion and never destroys the reusable clipboard',()=>{
        const a=setup('hooke');a.e.select([a.id]);a.e.history.clear();const before=a.r.snapshot();const text=a.e.cut();expect(text).toBeTruthy();expect(a.s.getState().nodes).toHaveLength(0);expect(a.e.history.getState().count).toBe(1);
        a.e.undo();expect(a.r.snapshot()).toEqual(before);expect(a.e.canPaste).toBe(true);a.e.paste();a.e.paste();expect(a.s.getState().nodes).toHaveLength(3);
    });
    it('moves a copied spring anchor with the spring and keeps its current displacement',()=>{
        const a=setup('hooke'),t=target(a,'body'),p=new PartGesture(a.e,t,t);p.update({x:t.x+35,y:t.y});p.end();a.e.select([a.id]);const x=body(a).position.x-a.r.world.anchorFor(a.id)!.x;a.e.copy();a.e.paste();const n=a.e.ids[0];
        expect(a.r.world.bodies.get(`${n}/0`)!.body.position.x-a.r.world.anchorFor(n)!.x).toBeCloseTo(x,9);
        expect(parseSave(JSON.stringify(makeSave(a.s.getState(),a.r.snapshot(),'copy'))).runtime.bodies).toHaveLength(2);
    });
    it('paste in another session preserves manipulated oscillator initial conditions and phase',()=>{
        const a=setup('pendulum');pull(a,'oscillator',510,380).end();ticks(a,20);a.e.select([a.id]);const text=a.e.copy()!,expected=oscillatorMotion(node(a),a.r.ages.get(a.id)!,a.r.labStates.get(a.id));
        const b=setup();expect(b.e.paste(text)).toBe(true);b.id=b.e.ids[0];const actual=oscillatorMotion(node(b),b.r.ages.get(b.id)!,b.r.labStates.get(b.id));expect(actual).toEqual(expected);
    });
    it('paste rejects arbitrary, malicious or incomplete clipboard text without editing',()=>{
        const a=setup('hooke');const before=a.s.getState();for(const text of ['hello','<img onerror=alert(1)>','{}','{"kind":"formula-alchemy/selection","version":1}', 'x'.repeat(500001)]){expect(a.e.paste(text)).toBe(false);expect(decodeSelection(text)).toBeNull();}expect(a.s.getState()).toBe(before);
    });
    it('enforces object limits before paste and leaves existing history untouched',()=>{
        const a=setup();const id=a.s.addToken('c',450,300)!;a.e.select([id]);a.e.copy();for(let i=1;i<MAX_NODES;i++)a.s.addToken('c');a.e.history.clear();expect(a.e.paste()).toBe(false);expect(a.s.getState().nodes).toHaveLength(MAX_NODES);expect(a.e.history.getState().count).toBe(0);
    });
});

describe('independent physical components',()=>{
    it('pulling the Hooke mass leaves the wall and anchor fixed, then releases from rest and oscillates',()=>{
        const a=setup('hooke'),before={...node(a)},anchor={...a.r.world.anchorFor(a.id)!},t=target(a,'body'),p=new PartGesture(a.e,t,t);a.e.history.clear();
        p.update({x:t.x+35,y:t.y+20});expect(node(a)).toEqual(before);expect(a.r.world.anchorFor(a.id)).toEqual(anchor);expect(body(a).position.x).toBeCloseTo(t.x+35,8);expect(body(a).position.y).toBe(t.y);
        p.end();const initial=body(a).position.x;expect(Matter.Body.getSpeed(body(a))).toBe(0);ticks(a,40);expect(body(a).position.x).toBeLessThan(initial);expect(a.r.world.anchorFor(a.id)).toEqual(anchor);expect(a.e.history.getState().count).toBe(1);
    });
    it('a rotated spring constrains the pulled mass along its real axis',()=>{
        const a=setup('hooke');a.e.select([a.id]);a.e.rotate(90);const t=target(a,'body'),p=new PartGesture(a.e,t,t);p.update({x:t.x+80,y:t.y+24});expect(body(a).position.x).toBeCloseTo(a.r.world.anchorFor(a.id)!.x,7);expect(body(a).position.y).toBeCloseTo(t.y+24,7);p.end();
    });
    it.each(['momentum','coulomb'])('the first body in %s moves without moving its neighbour',recipe=>{
        const a=setup(recipe),other={...body(a,1).position},n={...node(a)},t=target(a,'body'),p=new PartGesture(a.e,t,t);p.update({x:t.x+24,y:t.y+36});expect(body(a,1).position).toEqual(other);expect(node(a)).toEqual(n);p.end();
    });
    it.each(['electricField','lorentz'])('the %s charge moves separately from its field',recipe=>{
        const a=setup(recipe),n={...node(a)},t=target(a,'body'),p=new PartGesture(a.e,t,t);p.update({x:t.x+34,y:t.y+22});p.end();expect(node(a)).toEqual(n);expect(body(a).position.x).toBeCloseTo(t.x+34,7);
    });
    it('part cancellation restores full state and creates no history entry',()=>{
        const a=setup('hooke');a.e.select([a.id]);a.e.history.clear();const before=a.r.snapshot(),t=target(a,'body'),p=new PartGesture(a.e,t,t);p.update({x:t.x+30,y:t.y});p.rotate(15);p.cancel();expect(a.r.snapshot()).toEqual(before);expect(a.e.history.getState().count).toBe(0);
    });
});

describe('analytic parts have real initial conditions or parameters',()=>{
    it.each(['pendulum','springPeriod'])('%s bob follows pointer while held, then resumes continuously and speed matches trajectory',recipe=>{
        const a=setup(recipe),original={...node(a)},p=pull(a,'oscillator',530,385);const held=oscillatorMotion(node(a),a.r.ages.get(a.id)!,a.r.labStates.get(a.id));ticks(a,80);expect(oscillatorMotion(node(a),a.r.ages.get(a.id)!,a.r.labStates.get(a.id))).toEqual(held);p.end();
        expect(oscillatorMotion(node(a),a.r.ages.get(a.id)!,a.r.labStates.get(a.id))).toEqual(held);ticks(a,30);const moved=oscillatorMotion(node(a),a.r.ages.get(a.id)!,a.r.labStates.get(a.id));expect(moved.position).not.toBe(held.position);expect(node(a)).toEqual(original);
        const reading=collectSpeedReadings(a.s.getState(),a.r.world,a.r.ages,a.r.labStates)[0];expect(reading.value).toBeCloseTo(Math.abs(moved.velocity)*(recipe==='pendulum'?original.params.L:1),8);
        expect(parseSave(JSON.stringify(makeSave(a.s.getState(),a.r.snapshot(),'phase'))).runtime.labStates![a.id]).toEqual(a.r.labStates.get(a.id));
    });
    it('equal-density submerged block stays at the depth where it was released',()=>{
        const a=setup('buoyancy');a.s.setParam(a.id,'m',3);a.s.setParam(a.id,'V',3);a.s.setParam(a.id,'rho',1000);pull(a,'fluid',500,420).end();ticks(a,600);expect(floatingMotion(node(a),a.r.ages.get(a.id)!,a.r.labStates.get(a.id)).y).toBeCloseTo(420,8);
    });
    it('a satellite changes orbital radius/phase without moving the central mass',()=>{
        const a=setup('gravitation'),old={x:node(a).x,y:node(a).y};pull(a,'satellite',500,365+9*17).end();expect(node(a).params.r).toBe(9);expect(node(a)).toMatchObject(old);const pos=satelliteMotion(node(a),a.r.ages.get(a.id)!,a.r.labStates.get(a.id));expect(pos.x).toBeCloseTo(500,8);expect(pos.y).toBeCloseTo(518,8);
    });
    it.each([
        ['idealGas','piston','V',470,350],['snell','incident-ray','theta',320,240],['lens','lens-object','d',300,305],['lens','lens-focus','focus',580,340],['ampere','wire','alpha',630,390],['interference','slit','d',280,395],['wave','wavelength','lambda',480,480],
    ] as const)('%s %s changes %s while its installation stays fixed',(recipe,part,key,x,y)=>{
        const a=setup(recipe),old=structuredClone(node(a));pull(a,part,x,y).end();expect(node(a).params[key]).not.toBe(old.params[key]);expect(node(a).x).toBe(old.x);expect(node(a).y).toBe(old.y);
        expect(()=>parseSave(JSON.stringify(makeSave(a.s.getState(),a.r.snapshot(),'part')))).not.toThrow();
    });
    it.each(['ohm','series','parallel','joule','capacitor','power'])('%s circuit switch toggles by clicking the drawn switch',recipe=>{
        const a=setup(recipe),t=target(a,'switch');const before=node(a).closed;new PartGesture(a.e,t,t).click();expect(node(a).closed).toBe(!before);
    });
    it('clicking a Bohr energy level selects its n, without moving the nucleus',()=>{
        const a=setup('bohr'),t=target(a,'bohr-level',2),before={...node(a)};new PartGesture(a.e,t,t).click();expect(node(a).params.n).toBe(3);expect(node(a).x).toBe(before.x);
    });
    it('magnet motion induces a signal; stopping it makes manual emf zero',()=>{
        const a=setup('induction'),p=pull(a,'magnet',420,340);expect(inductionMotion(node(a),0,a.r.labStates.get(a.id)).emf).not.toBe(0);p.end();ticks(a,200);expect(inductionMotion(node(a),a.r.ages.get(a.id)!,a.r.labStates.get(a.id)).emf).toBe(0);
    });
    it('save rejects mismatched or unbounded part states',()=>{
        const a=setup('pendulum'),save=makeSave(a.s.getState(),a.r.snapshot(),'invalid');save.runtime.labStates={[a.id]:{kind:'orbit',position:0,velocity:0,epoch:0}};expect(()=>parseSave(JSON.stringify(save))).toThrow();save.runtime.labStates[a.id]={kind:'oscillator',position:99,velocity:0,epoch:0};expect(()=>parseSave(JSON.stringify(save))).toThrow();
    });
});

describe('unbounded held drag and no unphysical angular spin',()=>{
    it('held component can leave the world, stays there while physics ticks, and cancels exactly',()=>{
        const a=setup('hooke'),before=a.r.snapshot(),t=target(a,'body'),p=new PartGesture(a.e,t,t);p.update({x:-240,y:250},true);ticks(a,100);expect(body(a).position.x).toBe(-240);expect(body(a).collisionFilter.mask).toBe(0);
        const stable=a.e.history.stableSnapshot();expect(()=>parseSave(JSON.stringify(makeSave(stable.state,stable.runtime,'safe')))).not.toThrow();p.cancel();expect(a.r.snapshot()).toEqual(before);expect(body(a).collisionFilter.mask).not.toBe(0);
    });
    it('whole group can cross a boundary while held and snaps back to valid world bounds on ordinary release',()=>{
        const a=setup(),id=a.s.addToken('m',350,250)!;a.e.select([id]);a.e.beginMove();a.e.movePointer(-600,0);ticks(a,50);expect(a.r.world.bodies.get(`${id}/0`)!.body.position.x).toBeLessThan(0);a.e.endMove();expect(a.r.world.bodies.get(`${id}/0`)!.body.position.x).toBeGreaterThan(0);expect(()=>parseSave(JSON.stringify(makeSave(a.s.getState(),a.r.snapshot(),'valid')))).not.toThrow();
    });
    it('restored legacy angular velocity is cleared without changing manual angle or linear velocity',()=>{
        const a=setup('kinetic'),save=a.r.snapshot();save.bodies[0].angle=.61;save.bodies[0].av=1.8;const vx=save.bodies[0].vx;a.r.restore(save);expect(body(a).angularVelocity).toBe(0);expect(body(a).angle).toBe(.61);ticks(a,300);expect(body(a).angle).toBeCloseTo(.61,8);expect(body(a).velocity.x).toBeCloseTo(vx,8);
    });
    it('a spurious torque/angular velocity never makes the glyph spin perpetually',()=>{
        const a=setup('weight');Matter.Body.setAngle(body(a),.3);Matter.Body.setAngularVelocity(body(a),.8);body(a).torque=100;ticks(a,1500);expect(body(a).angle).toBeCloseTo(.3,7);expect(body(a).angularVelocity).toBe(0);expect(body(a).torque).toBe(0);
    });
    it('manual Q/R orientations survive pause, hold/release and a collision',()=>{
        const a=setup('momentum');a.e.select([a.id]);a.e.rotate(45);const angle=body(a).angle;const t=target(a,'body'),p=new PartGesture(a.e,t,t);p.update({x:t.x+24,y:t.y});p.end();ticks(a,500);expect(body(a).angle).toBeCloseTo(angle,8);expect(body(a,1).angularVelocity).toBe(0);
    });
    it('locking angular spin does not disable magnetic curvature or change speed',()=>{
        const a=setup('lorentz'),initial=Matter.Body.getSpeed(body(a)),v={...body(a).velocity};ticks(a,25);expect(Matter.Body.getSpeed(body(a))).toBeCloseTo(initial,6);expect(body(a).velocity.y).not.toBe(v.y);expect(body(a).angularVelocity).toBe(0);
    });
});
