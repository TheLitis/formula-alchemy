import { orientation, rotateVector } from '../editor/geometry';
import Matter from 'matter-js';
import { G } from '../core/evaluate';
import { isApparatus } from '../core/entities';
import { PX_PER_M } from '../core/types';
import type { FormulaNode, GameState, LabState } from '../core/types';
import type { PhysicsWorld } from './World';
import { oscillatorMotion, satelliteMotion } from './interactiveModels';
import { rodPosition } from './labModels';

export interface SpeedReading {
    key: string;
    nodeId: string;
    label: string;
    value: number;
    unit: 'м/с' | 'км/с' | 'c';
    x: number;
    y: number;
    radius: number;
    kind: 'body' | 'apparatus';
    /** Waves carry phase, not their particles, through the medium. */
    prefix?: string;
}

/** Shared with Renderer: moving a diagram does not change its physical velocity. */
export function apparatusTransform(n: FormulaNode, lab: GameState['lab']) {
    const scale = lab === 'sandbox' ? n.recipeId === 'gravitation' ? .9 : .64 : .94;
    const angle = orientation(n), offset = rotateVector({ x: 500 * scale, y: 360 * scale }, angle);
    return { scale, angle, tx: n.x - offset.x, ty: n.y - offset.y };
}

/** Exactly the analytic trajectories used in the diagrams, before display scaling. */
export function apparatusSpeed(n: FormulaNode, age: number, saved?: LabState): SpeedReading | null {
    const p = n.params;
    const base = { key: `${n.id}/speed`, nodeId: n.id, kind: 'apparatus' as const, radius: 22, unit: 'м/с' as const };
    switch (n.recipeId) {
        case 'gravitation': {
            const r = p.r * 1e6, gm = G * p.M * 1e24;
            const a = satelliteMotion(n, age, saved).phase; // only the drawing runs at orbital time ×200
            return { ...base, label: 'Спутник', value: Math.sqrt(gm / r) / 1000, unit: 'км/с',
                x: 500 + Math.cos(a) * p.r * 17, y: 365 + Math.sin(a) * p.r * 17, radius: 12 };
        }
        case 'springPeriod': {
            const motion = oscillatorMotion(n, age, saved);
            return { ...base, label: 'Груз на пружине', value: Math.abs(motion.velocity), x: motion.x, y: motion.y };
        }
        case 'pendulum': {
            const motion = oscillatorMotion(n, age, saved);
            return { ...base, label: 'Груз маятника', value: Math.abs(p.L * motion.velocity), x: motion.x, y: motion.y, radius: 17 };
        }
        case 'wave':
            return { ...base, label: 'Скорость распространения волны', prefix: 'волна',
                value: p.lambda * p.f, x: 520, y: 208, radius: 8 };
        case 'lengthContraction': {
            const contracted = p.L * Math.sqrt(1 - p.beta ** 2) * 56;
            return { ...base, label: 'Движущийся стержень', value: p.beta, unit: 'c',
                x: rodPosition(contracted, p.beta, age) + contracted / 2, y: 427, radius: 28 };
        }
        // Thermal dots, light packets, circuit markers, nuclei and field-source handles
        // have no calibrated material velocity. Never label their screen motion as m/s.
        default: return null;
    }
}

export function collectSpeedReadings(state: GameState, world: PhysicsWorld, ages: ReadonlyMap<string, number>, labStates?: ReadonlyMap<string, LabState>): SpeedReading[] {
    const readings: SpeedReading[] = [];
    if (state.lab === 'sandbox') {
        for (const item of world.bodies.values()) {
            if (!item.label || item.body.isSensor) continue; // black-hole dust is artwork
            const velocity = Matter.Body.getVelocity(item.body);
            const speed = item.body.isStatic ? 0 : Math.hypot(velocity.x, velocity.y) * 60 / PX_PER_M;
            if (!Number.isFinite(speed)) continue;
            readings.push({ key: item.key, nodeId: item.owner, label: item.label, kind: 'body',
                value: speed, unit: 'м/с', x: item.body.position.x, y: item.body.position.y, radius: item.radius });
        }
    }
    for (const n of state.nodes) {
        if (!isApparatus(n) || (state.lab !== 'sandbox' && n.id !== state.activeId)) continue;
        const reading = apparatusSpeed(n, ages.get(n.id) ?? 0, labStates?.get(n.id));
        if (!reading || !Number.isFinite(reading.value)) continue;
        const { scale, tx, ty, angle } = apparatusTransform(n, state.lab);
        const point = rotateVector({ x: reading.x * scale, y: reading.y * scale }, angle);
        readings.push({ ...reading, x: tx + point.x, y: ty + point.y, radius: reading.radius * scale });
    }
    return readings;
}

export function speedText(reading: Pick<SpeedReading, 'value' | 'unit'>): string {
    const digits = reading.unit === 'c' ? 2 : 1;
    const value = Math.abs(reading.value) < .5 * 10 ** -digits ? 0 : reading.value;
    return `${value.toFixed(digits).replace('.', ',')} ${reading.unit}`;
}
