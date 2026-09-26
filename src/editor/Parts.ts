import Matter from 'matter-js';
import { RECIPE_MAP } from '../core/catalog';
import { hasBodies, isApparatus } from '../core/entities';
import { clamp } from '../core/store';
import { PX_PER_M } from '../core/types';
import type { FormulaNode, GameState, LabState } from '../core/types';
import { oscillatorMotion, satelliteMotion, floatingMotion, inductionMotion } from '../physics/interactiveModels';
import { apparatusTransform } from '../physics/speedReadings';
import type { SimulationRuntime } from '../physics/Runtime';
import type { EditorController } from './EditorController';
import { orientation, rotateVector } from './geometry';
import { HitRegistry } from '../rendering/interaction';
import type { SceneTarget, Shape, Point } from '../rendering/interaction';

interface Part { id: string; label: string; shape: Shape; at: Point; value?: number; click?: boolean; }
const disk = (id: string, label: string, x: number, y: number, r: number, filled = true): Part => ({ id, label, at: { x, y }, shape: { type: 'circle', x, y, r, filled } });
const box = (id: string, label: string, x: number, y: number, w: number, h: number): Part => ({ id, label, at: { x: x+w/2, y: y+h/2 }, shape: { type: 'rect', x, y, w, h } });
const segment = (id: string, label: string, x: number, y: number, x2: number, y2: number): Part => ({ id, label, at: { x:(x+x2)/2, y:(y+y2)/2 }, shape: { type:'line', x,y,x2,y2 } });
export function canManipulateBody(node: FormulaNode) { return !!node.recipeId && hasBodies(node); }

/** Only real, visible, physically meaningful parts receive interaction regions. */
export function apparatusParts(node: FormulaNode, age: number, saved?: LabState): Part[] {
    const p = node.params;
    switch (node.recipeId) {
        case 'pendulum': case 'springPeriod': {
            const m = oscillatorMotion(node, age, saved);
            return [disk('oscillator', 'Груз: оттяните и отпустите', m.x, m.y, node.recipeId === 'pendulum' ? 17 : 23)];
        }
        case 'density': case 'buoyancy': {
            const m = floatingMotion(node, age, saved);
            return [box('fluid', 'Тело в жидкости: изменить глубину', 500-m.side/2, m.y-m.side/2, m.side, m.side)];
        }
        case 'gravitation': { const m = satelliteMotion(node,age,saved); return [disk('satellite','Спутник: изменить радиус орбиты',m.x,m.y,10)]; }
        case 'idealGas': return [box('piston', 'Поршень: изменить объём газа', 288, 490-(p.V-5)*260/45-12,364,18)];
        case 'snell': { const a=p.theta*Math.PI/180; return [disk('incident-ray','Источник света: изменить угол падения',500-Math.sin(a)*215,345-Math.cos(a)*215,9)]; }
        case 'lens': return [segment('lens-object','Предмет перед линзой: изменить расстояние',500-p.d*4,270,500-p.d*4,340), segment('lens-focus','Фокус: изменить фокусное расстояние',500+p.focus*4,334,500+p.focus*4,346)];
        case 'ampere': {
            const a=p.alpha*Math.PI/180, l=(90+p.L*65)/2, dx=Math.sin(a)*l,dy=Math.cos(a)*l;
            return [disk('wire','Конец проводника: угол и длина',500+dx,335+dy,5), {...disk('wire','Конец проводника: угол и длина',500-dx,335-dy,5),value:-1}];
        }
        case 'interference': { const dy=25+p.d*30; return [box('slit','Щель: изменить расстояние между щелями',272,335-dy/2-7,16,14),box('slit','Щель: изменить расстояние между щелями',272,335+dy/2-7,16,14)]; }
        case 'wave': return [segment('wavelength','Правый конец мерки: длина волны',180+p.lambda*60,471,180+p.lambda*60,489)];
        case 'induction': { const m=inductionMotion(node,age,saved); return [box('magnet','Магнит: двигайте в катушке для индукции',m.x-28,318,56,44)]; }
        case 'bohr': return Array.from({length:5},(_,i)=>i+1).flatMap(n=>[
            {...disk('bohr-level',`Энергетический уровень n=${n}`,370,340,35+n*27,false),value:n,click:true},
            {...segment('bohr-level',`Энергетический уровень n=${n}`,690,199+285/n**2,864,199+285/n**2),value:n,click:true},
        ]);
        default: return node.recipeId && RECIPE_MAP[node.recipeId].lab==='circuits' ? [{...segment('switch','Ключ цепи: замкнуть / разомкнуть',300,235,346,node.closed?235:212),click:true}] : [];
    }
}
export function partToWorld(node: FormulaNode, lab: GameState['lab'], p: Point): Point {
    const t=apparatusTransform(node,lab), v=rotateVector({x:p.x*t.scale,y:p.y*t.scale},t.angle); return {x:t.tx+v.x,y:t.ty+v.y};
}
export function worldToPart(node: FormulaNode, lab: GameState['lab'], p: Point): Point {
    const t=apparatusTransform(node,lab),v=rotateVector({x:p.x-t.tx,y:p.y-t.ty},-t.angle);return {x:v.x/t.scale,y:v.y/t.scale};
}
export function registerParts(hits: HitRegistry, node: FormulaNode, lab: GameState['lab'], age: number, saved?: LabState) {
    if (!isApparatus(node)) return;
    const t=apparatusTransform(node,lab);
    for (const part of apparatusParts(node,age,saved)) {
        const at=partToWorld(node,lab,part.at),s=part.shape;
        const target:SceneTarget={nodeId:node.id,kind:'apparatus',...at,partId:part.id,partLabel:part.label,partValue:part.value,partClick:part.click};
        if(s.type==='circle')hits.add(target,{...s,...partToWorld(node,lab,s),r:s.r*t.scale},true);
        if(s.type==='line'){const end=partToWorld(node,lab,{x:s.x2,y:s.y2});hits.add(target,{...s,...partToWorld(node,lab,s),x2:end.x,y2:end.y},true);}
        if(s.type==='rect'){const c=partToWorld(node,lab,{x:s.x+s.w/2,y:s.y+s.h/2});hits.add(target,{type:'rect',x:c.x-s.w*t.scale/2,y:c.y-s.h*t.scale/2,w:s.w*t.scale,h:s.h*t.scale,angle:t.angle},true);}
    }
}
export function partHint(node: FormulaNode): string | null {
    if (canManipulateBody(node)) return node.recipeId==='hooke' ? 'Потяните m: пружина растянется, опора останется на месте. Отпустите груз — он начнёт колебаться.' : 'Тяните отдельное тело или заряд. Остальные части установки останутся на месте.';
    const parts=apparatusParts(node,0);return parts.length?parts[0].label:null;
}

/** A part gesture edits initial conditions/parameters, NOT the installation transform. */
export class PartGesture {
    private offset:Point;
    private started = false;
    private lastPointer:Point;
    private magnetAt=0;
    private magnetTime=0;
    private stopMagnetTimer: ReturnType<typeof setTimeout> | undefined;
    constructor(private editor:EditorController, readonly target:SceneTarget, pointer:Point) {
        this.offset={x:target.x-pointer.x,y:target.y-pointer.y};this.lastPointer=pointer;
    }
    private get runtime():SimulationRuntime{return this.editor.runtime;}
    private get node(){return this.editor.store.getState().nodes.find(n=>n.id===this.target.nodeId);}
    begin() {
        if(this.started||!this.node)return;
        this.editor.history.begin('Изменение детали');this.started=true;
        this.runtime.heldNodes.add(this.target.nodeId);
        if(this.target.bodyKey)this.runtime.world.hold(this.target.bodyKey);
        else this.runtime.partHolds.add(this.target.nodeId);
        if(this.target.partId==='magnet'){this.magnetAt=inductionMotion(this.node!,this.age(),this.runtime.labStates.get(this.target.nodeId)).x;this.magnetTime=performance.now();}
    }
    private age(){return this.runtime.ages.get(this.target.nodeId)??0;}
    private saved(kind:LabState['kind'],position:number,velocity=0){this.runtime.setLabState(this.target.nodeId,{kind,position,velocity,epoch:this.age()});}
    update(pointer:Point,outside=false) {
        this.begin();this.lastPointer=pointer;
        const n=this.node;if(!n)return;
        const p={x:pointer.x+this.offset.x,y:pointer.y+this.offset.y};
        if(this.target.bodyKey){
            if(n.recipeId==='hooke'&&!outside){const a=orientation(n),u={x:Math.cos(a),y:Math.sin(a)},anchor=this.runtime.world.anchorFor(n.id)??n;
                const d=clamp((p.x-anchor.x)*u.x+(p.y-anchor.y)*u.y,-4*PX_PER_M,4*PX_PER_M);
                this.runtime.world.drag(anchor.x+d*u.x,anchor.y+d*u.y);
            }else this.runtime.world.drag(p.x,p.y,!outside);
            return;
        }
        if(outside)return; // An analytical part does not acquire invalid physical parameters outside the viewport.
        const local=worldToPart(n,this.editor.store.getState().lab,p),v=n.params;
        const set=(key:string,value:number)=>this.editor.store.setParam(n.id,key,value);
        switch(this.target.partId){
            case 'oscillator': this.saved('oscillator',n.recipeId==='pendulum'?clamp(Math.atan2(local.x-490,local.y-180),-Math.PI/6,Math.PI/6):clamp((local.x-500)/32,-4,4));break;
            case 'fluid': {const side=Math.cbrt(v.V/3)*84;this.saved('fluid',clamp(local.y,Math.max(100,side/2+10),550-side/2));break;}
            case 'satellite': set('r',Math.hypot(local.x-500,local.y-365)/17);this.saved('orbit',Math.atan2(local.y-365,local.x-500));break;
            case 'piston': set('V',5+(490-(local.y+3))*45/260);break;
            case 'incident-ray': set('theta',Math.atan2(Math.abs(500-local.x),Math.max(1,345-local.y))*180/Math.PI);break;
            case 'lens-object':set('d',(500-local.x)/4);break;
            case 'lens-focus':set('focus',Math.abs(local.x-500)/4);break;
            case 'wire':{const sign=this.target.partValue??1,dx=(local.x-500)*sign,dy=(local.y-335)*sign;set('alpha',Math.atan2(Math.abs(dx),dy)*180/Math.PI);set('L',(2*Math.hypot(dx,dy)-90)/65);break;}
            case 'slit':set('d',(2*Math.abs(local.y-335)-25)/30);break;
            case 'wavelength':set('lambda',(local.x-180)/60);break;
            case 'bohr-level':set('n',this.target.partValue!);break;
            case 'magnet':{const now=performance.now(),x=clamp(local.x,180,500),dt=Math.max(.016,(now-this.magnetTime)/1000);this.saved('induction',x,clamp((x-this.magnetAt)/dt,-800,800));this.magnetAt=x;this.magnetTime=now;clearTimeout(this.stopMagnetTimer);this.stopMagnetTimer=setTimeout(()=>{if(this.started)this.saved('induction',this.magnetAt,0);},100);break;}
        }
    }
    click(){this.begin();if(this.target.partId==='switch')this.editor.store.toggleCircuit(this.target.nodeId);else this.update(this.lastPointer);this.end();}
    rotate(degrees:number){this.begin();const b=this.target.bodyKey&&this.runtime.world.bodies.get(this.target.bodyKey)?.body;
        if(b){Matter.Body.setAngle(b,b.angle+degrees*Math.PI/180);Matter.Body.setAngularVelocity(b,0);}else this.editor.store.notify('Поворот всей установки: Alt + перетаскивание или режим «Установка».');
    }
    end(){if(!this.started)return;clearTimeout(this.stopMagnetTimer);
        // Always return a held part to a valid constrained position before committing a saveable edit.
        if(this.target.bodyKey)this.update(this.lastPointer,false);
        this.runtime.world.release();this.runtime.partHolds.delete(this.target.nodeId);this.runtime.heldNodes.delete(this.target.nodeId);
        if(this.target.partId==='magnet'){const s=this.runtime.labStates.get(this.target.nodeId);if(s)this.saved('induction',s.position,0);}
        this.started=false;this.editor.history.end();
    }
    cancel(){if(!this.started)return;clearTimeout(this.stopMagnetTimer);this.runtime.world.release();this.runtime.partHolds.delete(this.target.nodeId);this.runtime.heldNodes.delete(this.target.nodeId);this.started=false;this.editor.history.cancel();}
    get active(){return this.started;}
}
