import { RECIPE_MAP } from '../core/catalog';
import { hasBodies } from '../core/entities';
import type { GameStore } from '../core/store';
import type { GameState, RuntimeSnapshot } from '../core/types';
import { MAX_BODIES, PX_PER_M } from '../core/types';
import { FxSystem } from '../rendering/FxSystem';
import { blackHoleAcceleration } from './fieldModel';
import { blackHoleGeometry } from './geometry';
import { PhysicsWorld } from './World';
export class SimulationRuntime {
    world = new PhysicsWorld();
    fx = new FxSystem();
    time = 0;
    ages = new Map<string, number>();
    heldNode: string | null = null;
    onCaptureFeedback: (x: number) => void = () => {};
    private revisions = new Map<string, number>();
    private accumulator = 0;
    private unsubscribe: () => void;
    private state: GameState;
    private motions = new Map<string, { vx: number; vy: number }>();
    private capturedOwners = new Set<string>();
    constructor(private store: GameStore) {
        this.state = store.getState(); this.sync(this.state);
        this.unsubscribe = store.subscribe(() => this.sync(store.getState()));
        store.onCraft = (sources, result) => this.fx.craft(sources.map(n => ({ ...n, ...this.world.positionFor(n) })), result);
        this.world.onAbsorb = (item, hole) => {
            this.fx.capture(item.body.position.x, item.body.position.y, hole.x, hole.y, item.label);
            if (item.label) this.onCaptureFeedback(item.body.position.x);
            if (item.label && item.owner !== 'free' && item.owner !== hole.id) this.capturedOwners.add(item.owner);
        };
    }
    private sync(state: GameState) {
        this.state = state;
        const ids = new Set(state.nodes.map(n => n.id));
        for (const id of this.ages.keys()) if (!ids.has(id)) { this.ages.delete(id); this.revisions.delete(id); this.motions.delete(id); }
        for (const node of state.nodes) if (this.revisions.get(node.id) !== node.revision) { this.ages.set(node.id, 0); this.revisions.set(node.id, node.revision); }
        this.world.sync(state.nodes);
    }
    advance(realSeconds: number) {
        if (this.state.paused) { this.accumulator = 0; return; }
        this.accumulator += Math.min(Math.max(realSeconds, 0), .05) * this.state.speed;
        const dt = 1 / 120, positions = new Map<string, { x: number; y: number }>();
        let steps = 0;
        while (this.accumulator + 1e-10 >= dt && steps < 24) {
            this.time += dt; this.fx.step(dt);
            for (const node of this.state.nodes) {
                const circuit = node.recipeId && RECIPE_MAP[node.recipeId].lab === 'circuits';
                if (!circuit || node.closed) this.ages.set(node.id, (this.ages.get(node.id) ?? 0) + dt);
            }
            this.world.step(dt, this.ages, this.state.trails);
            const holes = this.state.nodes.filter(n => n.recipeId === 'blackhole');
            if (holes.length) for (const node of this.state.nodes) {
                if (node.id === this.heldNode || node.recipeId === 'blackhole' || hasBodies(node) || this.capturedOwners.has(node.id)) continue;
                const p = positions.get(node.id) ?? { x: node.x, y: node.y }, v = this.motions.get(node.id) ?? { vx: 0, vy: 0 };
                for (const hole of holes) {
                    const h = blackHoleGeometry(hole), dx = h.x - p.x, dy = h.y - p.y;
                    if (Math.hypot(dx, dy) < h.radius + 6) {
                        this.capturedOwners.add(node.id); this.world.absorbed.add(`node/${node.id}`);
                        if (this.world.absorbed.size > MAX_BODIES * 2) this.world.absorbed.delete(this.world.absorbed.values().next().value!);
                        this.fx.capture(p.x, p.y, h.x, h.y, node.recipeId ? '' : node.parts.join('')); this.onCaptureFeedback(p.x); break;
                    }
                    const a = blackHoleAcceleration(dx, dy, hole.params.M, h.radius), damping = Math.exp(-.6 * dt);
                    v.vx = (v.vx + a.x * PX_PER_M * dt) * damping; v.vy = (v.vy + a.y * PX_PER_M * dt) * damping;
                }
                p.x += v.vx * dt; p.y += v.vy * dt;
                positions.set(node.id, p); this.motions.set(node.id, v);
            }
            this.accumulator -= dt; steps++;
        }
        if (steps === 24) this.accumulator = Math.min(this.accumulator, dt);
        if (positions.size) this.store.moveMany(positions);
        for (const id of this.capturedOwners) if (![...this.world.bodies.values()].some(b => b.owner === id)) this.store.remove(id, true);
        this.capturedOwners.clear();
    }
    snapshot(): RuntimeSnapshot { return { time: this.time, ages: Object.fromEntries(this.ages), bodies: this.world.snapshot(), absorbed: [...this.world.absorbed] }; }
    restore(data: RuntimeSnapshot) { this.time = data.time; this.accumulator = 0; this.ages = new Map(Object.entries(data.ages)); this.motions.clear(); this.fx.clear(); this.world.restore(data.bodies, data.absorbed); }
    reset() { this.time = 0; this.accumulator = 0; this.ages.clear(); this.motions.clear(); this.fx.clear(); this.world.clearFreeBodies(); this.world.absorbed.clear(); }
    dispose() { this.unsubscribe(); this.store.onCraft = () => {}; this.world.dispose(); }
}
