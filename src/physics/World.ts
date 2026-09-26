import Matter from 'matter-js';
import { clamp, uid } from '../core/store';
import { hasBodies, isBareBody, tokenGlyph } from '../core/entities';
import { HEIGHT, MAX_BODIES, PX_PER_M, WIDTH } from '../core/types';
import type { BodySnapshot, FormulaNode } from '../core/types';
import { blackHoleAcceleration, fieldsForNode, insideField, rotateMagnetic, segmentDistance } from './fieldModel';
import { blackHoleGeometry } from './geometry';
export { blackHoleGeometry } from './geometry';

export const FLOOR = HEIGHT - 40;
export interface PhysicalBody {
    key: string; owner: string; body: Matter.Body; radius: number; label: string;
    trail: { x: number; y: number }[];
}
export class PhysicsWorld {
    engine = Matter.Engine.create({ gravity: { x: 0, y: 0, scale: 0 }, positionIterations: 10, velocityIterations: 10, enableSleeping: false });
    bodies = new Map<string, PhysicalBody>();
    absorbed = new Set<string>();
    private previous = new Map<string, FormulaNode>();
    private nodes: FormulaNode[] = [];
    private anchors = new Map<string, { x: number; y: number }>();
    private held: PhysicalBody | null = null;
    private heldMass = 2;
    private trailTick = 0;
    
    onCollision: (strength: number, x: number) => void = () => {};
    onAbsorb: (item: PhysicalBody, hole: FormulaNode) => void = () => {};

    constructor() {
        const boundary = { isStatic: true, restitution: .25, friction: .1 };
        Matter.Composite.add(this.engine.world, [
            Matter.Bodies.rectangle(WIDTH / 2, FLOOR + 30, WIDTH + 100, 60, boundary),
            Matter.Bodies.rectangle(-30, HEIGHT / 2, 60, HEIGHT + 100, boundary),
            Matter.Bodies.rectangle(WIDTH + 30, HEIGHT / 2, 60, HEIGHT + 100, boundary),
            Matter.Bodies.rectangle(WIDTH / 2, -30, WIDTH + 100, 60, boundary),
        ]);
        Matter.Events.on(this.engine, 'collisionStart', (e: Matter.IEventCollision<Matter.Engine>) => {
            const pair = e.pairs.filter(p => !p.isSensor).sort((a, b) => (b.bodyA.speed + b.bodyB.speed) - (a.bodyA.speed + a.bodyB.speed))[0];
            if (pair && pair.bodyA.speed + pair.bodyB.speed > 1.5) this.onCollision(pair.bodyA.speed + pair.bodyB.speed, (pair.bodyA.position.x + pair.bodyB.position.x) / 2);
        });
    }
    spawn(x: number, y: number, mass = 2, owner = 'free', label = 'm', radius = 18, key = uid()): PhysicalBody | null {
        if (this.bodies.size >= MAX_BODIES) return null;
        const body = Matter.Bodies.circle(clamp(x, radius + 1, WIDTH - radius - 1), clamp(y, radius + 1, FLOOR - radius), radius, {
            friction: 0, frictionStatic: 0, frictionAir: 0, restitution: .38, slop: .01,
            isSensor: label === '',
            // Dust is light, non-colliding artwork. It must never shove matter away from the hole.
        });
        Matter.Body.setMass(body, mass);
        Matter.Body.setInertia(body, Infinity);
        const item: PhysicalBody = { key, owner, body, radius, label, trail: [] };
        this.bodies.set(key, item);
        Matter.Composite.add(this.engine.world, body);
        return item;
    }
    remove(key: string) {
        const item = this.bodies.get(key);
        if (!item) return;
        Matter.Composite.remove(this.engine.world, item.body);
        this.bodies.delete(key);
        if (this.held === item) this.held = null;
    }
    private capture(item: PhysicalBody, hole: FormulaNode) {
        this.absorbed.add(item.key);
        if (this.absorbed.size > MAX_BODIES * 2) this.absorbed.delete(this.absorbed.values().next().value!);
        this.onAbsorb(item, hole);
        this.remove(item.key);
    }
    positionFor(n: FormulaNode) {
        return this.bodies.get(`${n.id}/0`)?.body.position ?? { x: n.x, y: n.y };
    }
    sync(nodes: FormulaNode[]) {
        const valid = new Set(nodes.map(n => n.id));
        for (const item of [...this.bodies.values()]) if (item.owner !== 'free' && !valid.has(item.owner)) this.remove(item.key);
        for (const id of this.previous.keys()) if (!valid.has(id)) { this.previous.delete(id); this.anchors.delete(id); }
        this.nodes = nodes;
        for (const node of nodes) {
            const old = this.previous.get(node.id);
            if (hasBodies(node) || node.recipeId === 'blackhole') {
                if (!old || old.revision !== node.revision || old.recipeId !== node.recipeId) {
                    for (const item of [...this.bodies.values()]) if (item.owner === node.id) this.remove(item.key);
                    this.setup(node);
                } else {
                    for (const item of this.bodies.values()) if (item.owner === node.id && item.label) {
                        const mass = node.recipeId === 'momentum' && item.key.endsWith('/1') ? 2 : node.params.m ?? (isBareBody(node) ? 2 : 1);
                        if (node.params.m !== old.params.m) {
                            if (this.held === item) this.heldMass = mass;
                            else { Matter.Body.setMass(item.body, mass); Matter.Body.setInertia(item.body, Infinity); }
                        }
                        if ((node.params.v !== old.params.v || node.params.angle !== old.params.angle) && node.params.v !== undefined) this.launch(item, node.params.v, node.params.angle ?? 0);
                    }
                }
            }
            this.previous.set(node.id, node);
        }
    }
    private launch(item: PhysicalBody, speed: number, angle: number) {
        const a = angle * Math.PI / 180;
        Matter.Body.setVelocity(item.body, { x: speed * PX_PER_M / 60 * Math.cos(a), y: speed * PX_PER_M / 60 * Math.sin(a) });
    }
    private setup(n: FormulaNode) {
        const p = n.params, id = n.recipeId;
        const make = (x: number, y: number, mass = p.m ?? 2, index = 0, label = 'm', radius = 20) => this.spawn(x, y, mass, n.id, label, radius, `${n.id}/${index}`);
        if (id === 'blackhole') {
            const h = blackHoleGeometry(n);
            for (let i = 0; i < 10; i++) {
                const a = i * Math.PI / 5, distance = h.radius + 70 + i * 10;
                const b = make(h.x + Math.cos(a) * distance, h.y + Math.sin(a) * distance, .05, i, '', 5);
                if (b) Matter.Body.setVelocity(b.body, { x: -Math.sin(a) * 1.1, y: Math.cos(a) * 1.1 });
            }
            return;
        }
        if (isBareBody(n)) {
            const body = make(n.x, n.y, p.m ?? 2, 0, n.parts.includes('q') || n.parts.includes('q2') ? 'q' : tokenGlyph(n));
            if (body && p.v) this.launch(body, p.v, p.angle ?? 0);
            return;
        }
        if (!hasBodies(n)) return;
        let x = n.x, y = n.y;
        if (id === 'potential') y = FLOOR - 20 - p.h * PX_PER_M;
        if (id === 'friction') { x = 110; y = FLOOR - 20; }
        if (id === 'hooke') { x = n.x + p.x * PX_PER_M; y = n.y; }
        if (id === 'electricField') x = n.x - 90;
        if (id === 'lorentz') y = n.y - Math.min(120, (p.v / Math.max(.1, Math.abs(p.q * p.B))) * PX_PER_M);
        if (id === 'coulomb') x = n.x - p.r * PX_PER_M / 2;
        const charged = ['electricField', 'lorentz', 'coulomb'].includes(id ?? '');
        const body = make(x, y, p.m ?? (charged ? 1 : 2), 0, charged ? 'q' : 'm');
        this.anchors.set(n.id, { x: id === 'hooke' ? n.x : x, y });
        if (!body) return;
        if (id === 'kinetic' || id === 'momentum' || id === 'lorentz') this.launch(body, p.v, 0);
        if (id === 'electricField') this.launch(body, 2, 0);
        if (id === 'friction') this.launch(body, 6, 0);
        if (id === 'momentum') make(clamp(x + 190, 70, 900), y, 2, 1, 'm₂');
        if (id === 'coulomb') make(n.x + p.r * PX_PER_M / 2, y, 1, 1, 'q₂');
    }
    chargeOf(item: PhysicalBody): number {
        const n = this.nodes.find(n => n.id === item.owner);
        if (!n || !item.label.startsWith('q')) return 0;
        if (n.recipeId === 'coulomb') return (item.key.endsWith('/1') ? n.params.q2 : n.params.q) * 1e-6;
        return n.params.q ?? (n.parts.includes('q2') ? -1 : 1);
    }
    private accelerate(b: Matter.Body, ax: number, ay: number) {
        if (ax === 0 && ay === 0) return;
        Matter.Body.applyForce(b, b.position, { x: b.mass * ax * PX_PER_M / 1e6, y: b.mass * ay * PX_PER_M / 1e6 });
    }
    step(dt: number, ages: ReadonlyMap<string, number>, trails = true) {
        const fields = this.nodes.flatMap(fieldsForNode), holes = this.nodes.filter(n => n.recipeId === 'blackhole');
        const before = new Map<string, { x: number; y: number }>();
        for (const item of [...this.bodies.values()]) {
            if (item === this.held) continue;
            const b = item.body, n = this.nodes.find(n => n.id === item.owner), p = n?.params ?? {}, id = n?.recipeId;
            before.set(item.key, { ...b.position });
            let ax = 0, ay = 0, bz = 0;
            if (item.label) {
                if (id === 'weight' || id === 'potential') ay += p.g;
                if (id === 'newton') ax += p.a;
                if (id === 'impulse' && (ages.get(item.owner) ?? 0) < p.t) ax += p.F / b.mass;
                if (id === 'work') { const dx = b.position.x - (this.anchors.get(item.owner)?.x ?? n!.x); if (dx >= 0 && dx < p.d * PX_PER_M) ax += p.F / b.mass; }
                if (id === 'hooke') {
                    const anchor = this.anchors.get(item.owner)!;
                    ax += -p.k * (b.position.x - anchor.x) / PX_PER_M / b.mass - .12 * b.velocity.x * 60 / PX_PER_M;
                    if (!holes.length) { Matter.Body.setPosition(b, { x: b.position.x, y: anchor.y }); Matter.Body.setVelocity(b, { x: b.velocity.x, y: 0 }); }
                }
                if (id === 'friction') {
                    const dv = p.mu * p.g * PX_PER_M / 60 * dt;
                    Matter.Body.setVelocity(b, { x: Math.sign(b.velocity.x) * Math.max(0, Math.abs(b.velocity.x) - dv), y: b.velocity.y });
                }
                const q = this.chargeOf(item);
                for (const f of fields) {
                    if (!insideField(f, b.position.x, b.position.y)) continue;
                    if (f.kind === 'gravity') ay += f.value;
                    if (f.kind === 'electric') { ax += q / b.mass * f.value * Math.cos(f.angle); ay += q / b.mass * f.value * Math.sin(f.angle); }
                    if (f.kind === 'magnetic') bz += f.value;
                    if (f.kind === 'source') {
                        const dx = (f.x - b.position.x) / PX_PER_M, dy = (f.y - b.position.y) / PX_PER_M, dist = Math.hypot(dx, dy), denom = (dist * dist + .49) ** 1.5;
                        ax += f.value * dx / denom; ay += f.value * dy / denom;
                    }
                }
                if (bz && q) Matter.Body.setVelocity(b, rotateMagnetic(b.velocity.x, b.velocity.y, q / b.mass, bz, dt));
                if (id === 'coulomb') {
                    const other = this.bodies.get(`${n!.id}/${item.key.endsWith('/0') ? '1' : '0'}`);
                    if (other) {
                        const dx = (b.position.x - other.body.position.x) / PX_PER_M, dy = (b.position.y - other.body.position.y) / PX_PER_M, distance = Math.max(.4, Math.hypot(dx, dy));
                        const a = 8.9875517923e9 * q * this.chargeOf(other) / distance ** 2 / b.mass;
                        ax += a * dx / distance; ay += a * dy / distance;
                    }
                }
            }
            let captured = false;
            for (const hole of holes) {
                const h = blackHoleGeometry(hole), dx = h.x - b.position.x, dy = h.y - b.position.y;
                if (Math.hypot(dx, dy) < h.radius + item.radius * .22) { this.capture(item, hole); captured = true; break; }
                const a = blackHoleAcceleration(dx, dy, hole.params.M, h.radius);
                ax += a.x; ay += a.y;
                // Dissipation removes angular/outward energy; it never applies a repulsive force.
                const damping = Math.exp(-(.12 + .035 * hole.params.M) * dt);
                Matter.Body.setVelocity(b, { x: b.velocity.x * damping, y: b.velocity.y * damping });
            }
            if (captured) continue;
            const onFloor = b.position.y >= FLOOR - item.radius - .08 && Math.abs(b.velocity.y) < .16 && ay >= 0;
            if (onFloor && !b.isSensor) {
                Matter.Body.setPosition(b, { x: b.position.x, y: FLOOR - item.radius });
                Matter.Body.setVelocity(b, { x: b.velocity.x, y: 0 });
                ay = 0; // Contact reaction cancels gravity at rest, not a perpetual kick upward.
            }
            this.accelerate(b, ax, ay);
        }
        Matter.Engine.update(this.engine, dt * 1000);
        this.trailTick++;
        for (const item of [...this.bodies.values()]) {
            const b = item.body, prev = before.get(item.key);
            if (prev && item !== this.held) {
                const h = holes.find(n => { const g = blackHoleGeometry(n); return segmentDistance(prev.x, prev.y, b.position.x, b.position.y, g.x, g.y) < g.radius + item.radius * .22; });
                if (h) { this.capture(item, h); continue; }
            }
            if (!Number.isFinite(b.position.x + b.position.y + b.velocity.x + b.velocity.y)) { this.remove(item.key); continue; }
            const speed = Matter.Body.getSpeed(b);
            if (speed > 30) { const v = Matter.Body.getVelocity(b); Matter.Body.setVelocity(b, { x: v.x * 30 / speed, y: v.y * 30 / speed }); }
            if (!b.isSensor && b.position.y + item.radius > FLOOR + .1 && Math.abs(b.velocity.y) < .18) {
                Matter.Body.setPosition(b, { x: b.position.x, y: FLOOR - item.radius });
                Matter.Body.setVelocity(b, { x: b.velocity.x, y: 0 });
            }
            if (b.position.x < -50 || b.position.x > WIDTH + 50 || b.position.y < -50 || b.position.y > HEIGHT + 50) {
                if (b.isSensor) { this.remove(item.key); continue; }
                Matter.Body.setPosition(b, { x: clamp(b.position.x, item.radius, WIDTH - item.radius), y: clamp(b.position.y, item.radius, FLOOR - item.radius) });
                Matter.Body.setVelocity(b, { x: 0, y: 0 });
            }
            if (trails && this.trailTick % 3 === 0 && speed > .08) { item.trail.push({ ...b.position }); if (item.trail.length > 60) item.trail.shift(); }
            if (!trails) item.trail = [];
        }
    }
    pickBody(x: number, y: number): PhysicalBody | null {
        return [...this.bodies.values()].reverse().find(i => !!i.label && Math.hypot(x - i.body.position.x, y - i.body.position.y) <= i.radius + 10) ?? null;
    }
    pick(x: number, y: number): boolean { const i = this.pickBody(x, y); return i ? this.hold(i.key) : false; }
    hold(key: string): boolean {
        this.release();
        const item = this.bodies.get(key);
        if (!item) return false;
        this.held = item; this.heldMass = item.body.mass;
        Matter.Body.setStatic(item.body, true); return true;
    }
    drag(x: number, y: number) {
        if (!this.held) return;
        const r = this.held.radius;
        Matter.Body.setPosition(this.held.body, { x: clamp(x, r + 1, WIDTH - r - 1), y: clamp(y, r + 1, FLOOR - r) });
        this.held.trail = [];
    }
    release() {
        if (!this.held) return;
        Matter.Body.setStatic(this.held.body, false); Matter.Body.setMass(this.held.body, this.heldMass); Matter.Body.setInertia(this.held.body, Infinity);
        Matter.Body.setVelocity(this.held.body, { x: 0, y: 0 }); this.held = null;
    }
    snapshot(): BodySnapshot[] {
        return [...this.bodies.values()].map(({ body: b, key, owner, label, radius }) => ({ key, owner, x: b.position.x, y: b.position.y, vx: b.velocity.x, vy: b.velocity.y, angle: b.angle, av: b.angularVelocity, mass: b.isStatic ? this.heldMass : b.mass, radius, label }));
    }
    restore(bodies: BodySnapshot[], absorbed: string[]) {
        for (const key of [...this.bodies.keys()]) this.remove(key);
        this.absorbed = new Set(absorbed);
        for (const s of bodies) {
            const item = this.spawn(s.x, s.y, s.mass, s.owner, s.label, s.radius, s.key);
            if (item) { Matter.Body.setVelocity(item.body, { x: s.vx, y: s.vy }); Matter.Body.setAngle(item.body, s.angle); Matter.Body.setAngularVelocity(item.body, s.av); }
        }
    }
    clearFreeBodies() { for (const i of [...this.bodies.values()]) if (i.owner === 'free') this.remove(i.key); }
    dispose() { this.release(); Matter.Events.off(this.engine, 'collisionStart'); Matter.Composite.clear(this.engine.world, false); Matter.Engine.clear(this.engine); this.bodies.clear(); }
    getPhysicalRecipeCount() { return this.nodes.filter(hasBodies).length; }
}
