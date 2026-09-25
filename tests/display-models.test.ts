import { describe, expect, it } from 'vitest';
import { capacitorMarkerTravel, energyColumn, fluidCenter, rodPosition } from '../src/physics/labModels';
import { HitRegistry } from '../src/rendering/interaction';

describe('repaired analytic animation models',()=>{
    it('neutral buoyancy stays put at every timestamp',()=>{for(const age of [0,.1,1,10,100]) expect(fluidCenter(3,3,1000,9.8,age)).toBe(365);});
    it('zero gravity does not move the buoyancy specimen',()=>{expect(fluidCenter(8,1,1000,0,10)).toBe(365);});
    it('lighter objects float and denser objects sink',()=>{expect(fluidCenter(1,3,1000,9.8,10)).toBeLessThan(365);expect(fluidCenter(7,3,1000,9.8,10)).toBeGreaterThan(365);});
    it('capacitor marker phase never goes backwards',()=>{let last=0;for(let t=0;t<30;t+=.01){const d=capacitorMarkerTravel(.3,2,t);expect(d).toBeGreaterThanOrEqual(last);last=d;}expect(last).toBeLessThanOrEqual(70*Math.sqrt(.3)*2);});
    it('the rod starts visible and moves on the first frame',()=>{expect(rodPosition(220,.75,0)).toBeCloseTo(190);expect(rodPosition(220,.75,.1)).toBeGreaterThan(190);expect(rodPosition(220,0,5)).toBeCloseTo(190);});
    it('first-law display bars remain positive and bounded even when Q-A is negative',()=>{for(const Q of [-20,0,60])for(const A of [-10,0,40])for(const t of [0,.1,.5,1]){const e=energyColumn(Q,A,t);expect(e.fraction).toBeGreaterThanOrEqual(0);expect(e.fraction).toBeLessThanOrEqual(1);expect(e.value-e.initial).toBeCloseTo((Q-A)*t);}});
    it('hit geometry selects the actual shape, not arbitrary blank space',()=>{
        const hits=new HitRegistry();const target={nodeId:'hole',kind:'node' as const,x:400,y:300};
        hits.add(target,{type:'circle',x:400,y:300,r:40,filled:true},true);
        expect(hits.pick(400,300)?.nodeId).toBe('hole');expect(hits.pick(400,200)).toBeNull();
    });
});
