import Matter from 'matter-js';
import { RECIPE_MAP } from '../core/catalog';
import { clamp, uid } from '../core/store';
import { HEIGHT, MAX_BODIES, PX_PER_M, WIDTH } from '../core/types';
import type { BodySnapshot, FormulaNode } from '../core/types';
import { blackHoleGeometry } from './geometry';
export { blackHoleGeometry } from './geometry';

export interface PhysicalBody {
  key: string;
  owner: string;
  body: Matter.Body;
  radius: number;
  label: string;
  trail: { x: number; y: number }[];
}

const PHYSICAL = new Set(['weight', 'newton', 'kinetic', 'momentum', 'potential', 'impulse', 'work', 'hooke', 'friction', 'blackhole']);

export class PhysicsWorld {
  engine = Matter.Engine.create({
    gravity: { x: 0, y: 0, scale: 0 },
    positionIterations: 10,
    velocityIterations: 10,
    enableSleeping: true,
  });
  bodies = new Map<string, PhysicalBody>();
  absorbed = new Set<string>();

  private revisions = new Map<string, number>();
  private nodes: FormulaNode[] = [];
  private anchors = new Map<string, { x: number; y: number }>();
  private held: PhysicalBody | null = null;
  private heldMass = 2;
  private trailTick = 0;

  onCollision: () => void = () => {};

  constructor() {
    const walls = [
      Matter.Bodies.rectangle(WIDTH / 2, HEIGHT - 20, WIDTH + 80, 40, { isStatic: true }),
      Matter.Bodies.rectangle(-20, HEIGHT / 2, 40, HEIGHT + 80, { isStatic: true }),
      Matter.Bodies.rectangle(WIDTH + 20, HEIGHT / 2, 40, HEIGHT + 80, { isStatic: true }),
      Matter.Bodies.rectangle(WIDTH / 2, -20, WIDTH + 80, 40, { isStatic: true }),
    ];
    Matter.Composite.add(this.engine.world, walls);
    Matter.Events.on(this.engine, 'collisionStart', (e: Matter.IEventCollision<Matter.Engine>) => {
      if (e.pairs.some(pair => pair.bodyA.speed + pair.bodyB.speed > 1.5)) this.onCollision();
    });
  }

  spawn(x: number, y: number, mass = 2, owner = 'free', label = 'm', radius = 18, key = uid()): PhysicalBody | null {
    if (this.bodies.size >= MAX_BODIES) return null;
    const body = Matter.Bodies.circle(
      clamp(x, radius + 2, WIDTH - radius - 2),
      clamp(y, radius + 2, HEIGHT - 45 - radius),
      radius,
      {
        friction: 0.08,
        frictionStatic: 0.12,
        // Keep drag explicit: the friction experiment applies its own μg deceleration.
        frictionAir: 0,
        restitution: 0.34,
        slop: 0.02,
      },
    );
    Matter.Body.setMass(body, mass);
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

  pickBody(x: number, y: number): PhysicalBody | null {
    const matches = Matter.Query.point([...this.bodies.values()].map(i => i.body), { x, y });
    const body = matches.at(-1);
    if (!body) return null;
    return [...this.bodies.values()].find(i => i.body === body) ?? null;
  }

  ownerAt(x: number, y: number): string | null {
    return this.pickBody(x, y)?.owner ?? null;
  }

  sync(nodes: FormulaNode[]) {
    const valid = new Set(nodes.map(n => n.id));
    for (const item of this.bodies.values()) if (item.owner !== 'free' && !valid.has(item.owner)) this.remove(item.key);
    for (const id of this.revisions.keys()) if (!valid.has(id)) {
      this.revisions.delete(id);
      this.anchors.delete(id);
    }
    this.nodes = nodes;
    for (const node of nodes) {
      if (!node.recipeId || !PHYSICAL.has(node.recipeId)) continue;
      if (this.revisions.get(node.id) !== node.revision) {
        for (const item of [...this.bodies.values()]) if (item.owner === node.id) this.remove(item.key);
        for (const key of [...this.absorbed]) if (key.startsWith(`${node.id}/`)) this.absorbed.delete(key);
        this.revisions.set(node.id, node.revision);
        this.setup(node);
      }
    }
  }

  private setup(n: FormulaNode) {
    const p = n.params, id = n.recipeId!;
    const x = clamp(n.x, 100, 800), y = 230;
    const make = (ix: number, iy: number, mass: number, index = 0, label = 'm', r = 18) => this.spawn(ix, iy, mass, n.id, label, r, `${n.id}/${index}`);

    if (id === 'blackhole') {
      const hole = blackHoleGeometry(n);
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI * 2 / 12;
        const dist = hole.radius * 1.7 + 48 + i * 6;
        const b = make(hole.x + Math.cos(a) * dist, hole.y + Math.sin(a) * dist, 0.25, i, '', 5);
        if (b) Matter.Body.setVelocity(b.body, { x: -Math.sin(a) * 1.05, y: Math.cos(a) * 1.05 });
      }
      return;
    }

    let initialX = x, initialY = y;
    if (id === 'kinetic' || id === 'momentum' || id === 'impulse' || id === 'work') initialX = 130;
    if (id === 'potential') initialY = HEIGHT - 58 - p.h * PX_PER_M;
    if (id === 'friction') {
      initialX = 110;
      initialY = HEIGHT - 58;
    }
    if (id === 'hooke') {
      initialX = 500 + p.x * PX_PER_M;
      initialY = 400;
    }

    const body = make(initialX, initialY, p.m ?? 2);
    this.anchors.set(n.id, { x: id === 'hooke' ? 500 : initialX, y: initialY });
    if (!body) return;

    if (id === 'kinetic' || id === 'momentum') Matter.Body.setVelocity(body.body, { x: p.v * PX_PER_M / 60, y: 0 });
    if (id === 'friction') Matter.Body.setVelocity(body.body, { x: 6 * PX_PER_M / 60, y: 0 });
    if (id === 'momentum') make(560, initialY, 2, 1, 'm₂');
  }

  private accelerate(body: Matter.Body, ax: number, ay: number) {
    Matter.Body.applyForce(body, body.position, { x: body.mass * ax * PX_PER_M / 1e6, y: body.mass * ay * PX_PER_M / 1e6 });
  }

  step(seconds: number, ages: ReadonlyMap<string, number>, trails = true) {
    for (const n of this.nodes) {
      if (!n.recipeId || !PHYSICAL.has(n.recipeId)) continue;
      const p = n.params, id = n.recipeId;

      if (id === 'blackhole') {
        const hole = blackHoleGeometry(n);
        const massFactor = 0.8 + (p.M ?? 1) / 3.5;
        for (const item of [...this.bodies.values()]) {
          if (item === this.held || item.owner === n.id) continue;
          const dx = hole.x - item.body.position.x;
          const dy = hole.y - item.body.position.y;
          const dist = Math.hypot(dx, dy);
          const safe = Math.max(dist, 1);
          if (dist < hole.radius * 1.28 + item.radius * 0.35) {
            this.absorbed.add(item.key);
            if (this.absorbed.size > MAX_BODIES * 2) this.absorbed.delete(this.absorbed.values().next().value!);
            this.remove(item.key);
            continue;
          }
          const radial = Math.min(260, (hole.radius * hole.radius * 0.11 * massFactor) / Math.max(safe * 0.7, 18));
          const tangent = Math.min(55, radial * 0.22);
          this.accelerate(item.body, radial * dx / safe - tangent * dy / safe, radial * dy / safe + tangent * dx / safe);
        }
        continue;
      }

      const item = this.bodies.get(`${n.id}/0`);
      if (!item || item === this.held) continue;
      const b = item.body;

      switch (id) {
        case 'weight':
        case 'potential':
          this.accelerate(b, 0, p.g);
          break;
        case 'newton':
          this.accelerate(b, p.a, 0);
          break;
        case 'impulse':
          if ((ages.get(n.id) ?? 0) < p.t) this.accelerate(b, p.F / b.mass, 0);
          break;
        case 'work': {
          const dx = b.position.x - (this.anchors.get(n.id)?.x ?? 0);
          if (dx >= 0 && dx < p.d * PX_PER_M) this.accelerate(b, p.F / b.mass, 0);
          break;
        }
        case 'hooke': {
          const anchor = this.anchors.get(n.id)!;
          this.accelerate(b, -p.k * (b.position.x - anchor.x) / PX_PER_M / b.mass - 0.42 * b.velocity.x, 0);
          Matter.Body.setPosition(b, { x: b.position.x, y: anchor.y });
          Matter.Body.setVelocity(b, { x: b.velocity.x, y: 0 });
          break;
        }
        case 'friction': {
          const dv = p.mu * p.g * PX_PER_M / 60 * seconds;
          Matter.Body.setVelocity(b, { x: Math.sign(b.velocity.x) * Math.max(0, Math.abs(b.velocity.x) - dv), y: 0 });
          Matter.Body.setPosition(b, { x: b.position.x, y: HEIGHT - 58 - item.radius });
          break;
        }
      }
    }

    Matter.Engine.update(this.engine, seconds * 1000);
    this.trailTick++;

    for (const item of [...this.bodies.values()]) {
      const b = item.body;
      if (!Number.isFinite(b.position.x) || !Number.isFinite(b.position.y)) {
        this.remove(item.key);
        continue;
      }
      if (b.speed > 28) Matter.Body.setVelocity(b, { x: b.velocity.x * 28 / b.speed, y: b.velocity.y * 28 / b.speed });
      if (b.position.x < -30 || b.position.x > WIDTH + 30 || b.position.y > HEIGHT + 30) {
        Matter.Body.setPosition(b, { x: clamp(b.position.x, 25, WIDTH - 25), y: clamp(b.position.y, 25, HEIGHT - 70) });
      }

      const nearFloor = b.position.y > HEIGHT - 45 - item.radius;
      if (nearFloor) {
        Matter.Body.setPosition(b, { x: b.position.x, y: HEIGHT - 40 - item.radius });
        if (Math.abs(b.velocity.y) < 1.05) Matter.Body.setVelocity(b, { x: b.velocity.x * 0.98, y: 0 });
        if (Math.abs(b.velocity.y) < 0.15 && Math.abs(b.velocity.x) < 0.2 && item.owner !== 'free') {
          Matter.Body.setVelocity(b, { x: 0, y: 0 });
          Matter.Body.setAngularVelocity(b, 0);
        }
      }

      if (trails && this.trailTick % 3 === 0) {
        item.trail.push({ ...b.position });
        if (item.trail.length > 52) item.trail.shift();
      }
      if (!trails) item.trail = [];
    }
  }

  pick(x: number, y: number): boolean {
    this.release();
    const item = this.pickBody(x, y);
    if (!item) return false;
    this.held = item;
    this.heldMass = item.body.mass;
    Matter.Body.setStatic(item.body, true);
    Matter.Sleeping.set(item.body, false);
    return true;
  }

  drag(x: number, y: number) {
    if (this.held) Matter.Body.setPosition(this.held.body, { x: clamp(x, 25, WIDTH - 25), y: clamp(y, 25, HEIGHT - 65) });
  }

  release() {
    if (this.held) {
      Matter.Body.setStatic(this.held.body, false);
      Matter.Body.setVelocity(this.held.body, { x: 0, y: 0 });
      this.held = null;
    }
  }

  snapshot(): BodySnapshot[] {
    return [...this.bodies.values()].map(({ body: b, key, owner, label, radius }) => ({
      key,
      owner,
      x: b.position.x,
      y: b.position.y,
      vx: b.velocity.x,
      vy: b.velocity.y,
      angle: b.angle,
      av: b.angularVelocity,
      mass: b.isStatic ? this.heldMass : b.mass,
      radius,
      label,
    }));
  }

  restore(bodies: BodySnapshot[], absorbed: string[]) {
    for (const key of [...this.bodies.keys()]) this.remove(key);
    this.absorbed = new Set(absorbed);
    for (const s of bodies) {
      const b = this.spawn(s.x, s.y, s.mass, s.owner, s.label, s.radius, s.key);
      if (b) {
        Matter.Body.setVelocity(b.body, { x: s.vx, y: s.vy });
        Matter.Body.setAngle(b.body, s.angle);
        Matter.Body.setAngularVelocity(b.body, s.av);
      }
    }
  }

  clearFreeBodies() {
    for (const i of [...this.bodies.values()]) if (i.owner === 'free') this.remove(i.key);
  }

  dispose() {
    this.release();
    Matter.Events.off(this.engine, 'collisionStart');
    Matter.Composite.clear(this.engine.world, false);
    Matter.Engine.clear(this.engine);
    this.bodies.clear();
  }

  getPhysicalRecipeCount() {
    return this.nodes.filter(n => n.recipeId && RECIPE_MAP[n.recipeId].lab === 'sandbox').length;
  }
}
