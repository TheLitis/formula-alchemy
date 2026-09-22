import { RECIPE_MAP } from '../core/catalog';
import type { GameStore } from '../core/store';
import type { GameState, RuntimeSnapshot } from '../core/types';
import { PhysicsWorld } from './World';
export class SimulationRuntime {
    world = new PhysicsWorld();
    time = 0;
    ages = new Map<string, number>();
    private revisions = new Map<string, number>();
    private accumulator = 0;
    private unsubscribe: () => void;
    private state: GameState;
    constructor(store: GameStore) { this.state = store.getState(); this.sync(this.state); this.unsubscribe = store.subscribe(() => this.sync(store.getState())); }
    private sync(state: GameState) {
        this.state = state;
        const ids = new Set(state.nodes.map(n => n.id));
        for (const id of this.ages.keys())
            if (!ids.has(id)) {
                this.ages.delete(id);
                this.revisions.delete(id);
            }
        for (const node of state.nodes) {
            if (this.revisions.get(node.id) !== node.revision) {
                this.ages.set(node.id, 0);
                this.revisions.set(node.id, node.revision);
            }
        }
        this.world.sync(state.nodes);
    }
    advance(realSeconds: number) {
        if (this.state.paused) {
            this.accumulator = 0;
            return;
        }
        this.accumulator += Math.min(Math.max(realSeconds, 0), 0.05) * this.state.speed;
        const dt = 1 / 120;
        let steps = 0;
        while (this.accumulator + 1e-10 >= dt && steps < 24) {
            this.time += dt;
            for (const node of this.state.nodes) {
                // The RC and heating integrators run only while the circuit is closed.
                const circuit = node.recipeId && RECIPE_MAP[node.recipeId].lab === 'circuits';
                if (!circuit || node.closed)
                    this.ages.set(node.id, (this.ages.get(node.id) ?? 0) + dt);
            }
            this.world.step(dt, this.ages, this.state.trails);
            this.accumulator -= dt;
            steps++;
        }
        if (steps === 24)
            this.accumulator = Math.min(this.accumulator, dt);
    }
    snapshot(): RuntimeSnapshot { return { time: this.time, ages: Object.fromEntries(this.ages), bodies: this.world.snapshot(), absorbed: [...this.world.absorbed] }; }
    restore(data: RuntimeSnapshot) { this.time = data.time; this.accumulator = 0; this.ages = new Map(Object.entries(data.ages)); this.world.restore(data.bodies, data.absorbed); }
    reset() { this.time = 0; this.accumulator = 0; this.ages.clear(); this.world.clearFreeBodies(); this.world.absorbed.clear(); }
    dispose() { this.unsubscribe(); this.world.dispose(); }
}
