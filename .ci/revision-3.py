changes = [
{'path':'src/physics/fieldModel.ts','sha256':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','edits':[[0,0,r'''import type { FormulaNode } from '../core/types';
import { PX_PER_M } from '../core/types';

export interface FieldRegion { owner: string; kind: 'electric' | 'magnetic' | 'gravity' | 'wire' | 'source'; x: number; y: number; radius: number; value: number; angle: number; }
export function fieldsForNode(n: FormulaNode): FieldRegion[] {
    const p = n.params, id = n.recipeId, symbol = !id && n.parts.length === 1 ? n.parts[0] : '';
    const base = { owner: n.id, x: n.x, y: n.y, radius: (p.extent ?? 5) * PX_PER_M, angle: id === 'electricField' ? Math.PI / 2 : (p.angle ?? 0) * Math.PI / 180 };
    const fields: FieldRegion[] = [];
    if (symbol === 'E' || id === 'electricField' || id === 'crossedFields') fields.push({ ...base, kind: 'electric', value: p.E ?? 6 });
    if (symbol === 'B' || id === 'lorentz' || id === 'crossedFields') fields.push({ ...base, kind: 'magnetic', value: p.B ?? 1 });
    if (symbol === 'g') fields.push({ ...base, kind: 'gravity', value: p.g ?? 9.8 });
    if (symbol === 'I') fields.push({ ...base, kind: 'wire', value: p.I ?? 3 });
    if (id === 'magneticCoil') fields.push({ ...base, kind: 'magnetic', value: 4 * Math.PI * 1e-7 * p.mu_m * p.I / (2 * p.r), radius: p.r * PX_PER_M });
    if (id === 'gravitySource' || id === 'inverseGravity') fields.push({ ...base, kind: 'source', value: 6.67430e-11 * p.M * 1e12, radius: (p.r ?? 5) * PX_PER_M });
    return fields;
}
export function insideField(f: FieldRegion, x: number, y: number): boolean {
    const dx = x - f.x, dy = y - f.y;
    if (f.kind === 'magnetic' || f.kind === 'wire') return dx * dx + dy * dy < f.radius * f.radius;
    if (f.kind === 'source') return true;
    const cos = Math.cos(f.angle), sin = Math.sin(f.angle), u = dx * cos + dy * sin, v = -dx * sin + dy * cos;
    return Math.abs(u) < f.radius && Math.abs(v) < f.radius * .74;
}
/** Screen y grows downward. Positive Bz points OUT of the screen; +q turns clockwise. */
export function rotateMagnetic(vx: number, vy: number, qOverM: number, bz: number, dt: number) {
    const a = qOverM * bz * dt, c = Math.cos(a), s = Math.sin(a);
    return { x: vx * c - vy * s, y: vx * s + vy * c };
}
export function blackHoleAcceleration(dx: number, dy: number, mass: number, radius: number) {
    const distance = Math.max(1e-6, Math.hypot(dx, dy));
    // Artistic screen scale; never a tangential thrust. SI Schwarzschild radius is separate.
    const pixels = Math.min(4200, 12e6 * mass / (distance * distance + radius * radius));
    return { x: dx / distance * pixels / PX_PER_M, y: dy / distance * pixels / PX_PER_M };
}
export function segmentDistance(x0: number, y0: number, x1: number, y1: number, cx: number, cy: number) {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / l2)) : 0;
    return Math.hypot(x0 + t * dx - cx, y0 + t * dy - cy);
}
''']]},
{'path': 'src/physics/geometry.ts', 'sha256': 'e4dbbde621681e5b844a78693dbda0bf8d29a82bd04520de30848ddbd7cac28c', 'edits': [[0, 125, ''], [175, 175, '/** Node coordinates are the visible center, without a hidden +160px handle offset. */\n'], [233, 366, ' x: node.x, y: node.y, radius: Math.min(96, 22 + (node.params.M ?? 5) * 3) }']]},
{'path':'src/physics/labModels.ts','sha256':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','edits':[[0,0,r'''/** Stable display models; calculated SI values remain in core/evaluate.ts. */
export function fluidCenter(mass: number, liters: number, density: number, g: number, age: number): number {
    const side = Math.cbrt(liters / 3) * 84, bodyDensity = mass / (liters * .001), start = 365;
    if (g <= 0 || Math.abs(bodyDensity - density) <= Math.max(1, density) * 1e-10) return start;
    const target = bodyDensity < density ? 270 + side * (bodyDensity / density - .5) : 550 - side / 2;
    const t = Math.max(0, age) * Math.sqrt(g / 9.8);
    // Critically damped interpolation to the buoyancy equilibrium, not CFD.
    return start + (target - start) * (1 - (1 + t * 1.4) * Math.exp(-t * 1.4));
}
export function capacitorMarkerTravel(current0: number, tau: number, age: number): number {
    if (current0 <= 0 || tau <= 0) return 0;
    // Integral of the display speed 35 sqrt(I0 exp(-t/tau)); always nondecreasing.
    return 70 * Math.sqrt(current0) * tau * -Math.expm1(-Math.max(0, age) / (2 * tau));
}
export function rodPosition(lengthPixels: number, beta: number, age: number): number {
    const span = 1000 + lengthPixels;
    return ((190 + lengthPixels + Math.max(0, age) * 40 * beta) % span + span) % span - lengthPixels;
}
export function energyColumn(heat: number, work: number, progress: number) {
    const delta = heat - work;
    const initial = Math.max(50, -delta + 20); // explicit positive reference energy
    const value = initial + delta * Math.min(1, Math.max(0, progress));
    const scale = Math.max(initial, initial + delta) * 1.1;
    return { initial, value, fraction: value / scale };
}
''']]},
{'path':'src/rendering/FxSystem.ts','sha256':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','edits':[[0,0,r'''import { tokenGlyph } from '../core/entities';
import type { FormulaNode } from '../core/types';
import { circle, INK, polyline } from './primitives';
interface Burst { age: number; duration: number; x: number; y: number; capture: boolean; sources: { x: number; y: number; glyph: string }[]; }
export class FxSystem {
    private bursts: Burst[] = [];
    craft(sources: FormulaNode[], result: FormulaNode) { this.bursts.push({ age: 0, duration: .6, x: result.x, y: result.y, capture: false, sources: sources.map(n => ({ x: n.x, y: n.y, glyph: tokenGlyph(n) })) }); this.bursts = this.bursts.slice(-20); }
    capture(x: number, y: number, hx: number, hy: number, glyph: string) { this.bursts.push({ age: 0, duration: .45, x: hx, y: hy, capture: true, sources: [{ x, y, glyph }] }); this.bursts = this.bursts.slice(-20); }
    step(dt: number) { for (const b of this.bursts) b.age += dt; this.bursts = this.bursts.filter(b => b.age < b.duration); }
    clear() { this.bursts = []; }
    draw(c: CanvasRenderingContext2D, reduced: boolean) {
        for (const b of this.bursts) {
            const t = b.age / b.duration, e = 1 - (1 - t) ** 3;
            c.save();
            c.globalAlpha = 1 - t;
            for (const s of b.sources) {
                const x = s.x + (b.x - s.x) * e, y = s.y + (b.y - s.y) * e;
                c.save(); c.translate(x, y); c.scale(Math.max(.05, 1 - e), Math.max(.05, 1 - e));
                c.font = 'italic 38px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = INK; c.fillText(s.glyph, 0, 0); c.restore();
            }
            if (!reduced) {
                if (!b.capture) circle(c, b.x, b.y, 10 + t * 75, null, '#888', .8);
                for (let i = 0; i < 16; i++) {
                    const angle = i * 2.39996, radius = b.capture ? (1 - e) * 58 : e * (28 + i * 2.5);
                    const x = b.x + Math.cos(angle + t) * radius, y = b.y + Math.sin(angle + t) * radius;
                    polyline(c, [{ x: x - Math.cos(angle) * 6, y: y - Math.sin(angle) * 6 }, { x, y }], '#555', .8);
                }
            }
            c.restore();
        }
    }
}
''']]},
{'path':'src/rendering/Renderer.ts','sha256':'6ced20e8f60b90a8d7e106c45f9ccb65205a4ad86090a9101f36e78721784172','edits':[[0,5323,r'''import { HEIGHT, WIDTH } from '../core/types';
import type { FormulaNode, GameState, Viewport } from '../core/types';
import { hasBodies, isApparatus, isField, tokenGlyph } from '../core/entities';
import type { SimulationRuntime } from '../physics/Runtime';
import { blackHoleGeometry } from '../physics/geometry';
import { fieldsForNode } from '../physics/fieldModel';
import { FLOOR } from '../physics/World';
import { EFFECTS } from './effects';
import { drawNodeFields } from './fields';
import { HitRegistry, recordFor } from './interaction';
import { arrow, circle, INK, line, MUTED, PAPER, polyline, setLabelScale, setApparatusLabels } from './primitives';
export function getViewport(width: number, height: number): Viewport { const scale = Math.min(width / WIDTH, height / HEIGHT); return { width, height, scale, ox: (width - WIDTH * scale) / 2, oy: (height - HEIGHT * scale) / 2 }; }
export function toWorld(v: Viewport, x: number, y: number) { return { x: (x - v.ox) / v.scale, y: (y - v.oy) / v.scale }; }

export class CanvasRenderer {
    c: CanvasRenderingContext2D;
    viewport: Viewport = getViewport(WIDTH, HEIGHT);
    hits = new HitRegistry();
    reduced = false;
    hoverId: string | null = null;
    craftTarget: string | null = null;
    constructor(public canvas: HTMLCanvasElement) {
        const c = canvas.getContext('2d', { alpha: false }); if (!c) throw new Error('Canvas 2D недоступен.'); this.c = c;
        this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    resize(width: number, height: number) { const dpr = Math.min(window.devicePixelRatio || 1, 1.75); this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr); this.viewport = getViewport(width, height); }
    private glyph(value: string, x: number, y: number, size = 42, opacity = 1) {
        const c = this.c; c.save(); c.globalAlpha = opacity; c.fillStyle = INK; c.font = `italic ${Math.max(size, Math.min(70, 28 / this.viewport.scale))}px Georgia, 'Times New Roman', serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(value, x, y); c.restore();
    }
    private holeBack(n: FormulaNode, time: number) {
        const c = this.c, h = blackHoleGeometry(n);
        const gradient = c.createRadialGradient(h.x, h.y, h.radius * .9, h.x, h.y, h.radius * 3.7);
        gradient.addColorStop(0, 'rgba(0,0,0,.17)'); gradient.addColorStop(.3, 'rgba(0,0,0,.035)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gradient; c.fillRect(h.x - h.radius * 4, h.y - h.radius * 4, h.radius * 8, h.radius * 8);
        for (let j = 0; j < (this.reduced ? 12 : 27); j++) {
            const pts = Array.from({ length: 55 }, (_, i) => { const f = i / 54, r = h.radius * (1.02 + f ** 1.4 * (1.5 + (j % 4) * .25)), a = j * 2.39996 + f * 3.5 + (this.reduced ? 0 : time * .24); return { x: h.x + Math.cos(a) * r, y: h.y + Math.sin(a) * r * .9 }; });
            polyline(c, pts, j % 4 ? '#b4b4b4' : '#777', j % 4 ? .65 : .9);
        }
    }
    render(state: GameState, runtime: SimulationRuntime) {
        const { c, canvas, viewport: v } = this;
        this.hits.clear(); recordFor(null); setLabelScale(v.width < 600 ? 1.25 : 1); setApparatusLabels(false);
        c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = PAPER; c.fillRect(0, 0, canvas.width, canvas.height);
        const sx = canvas.width / v.width, sy = canvas.height / v.height;
        c.setTransform(sx * v.scale, 0, 0, sy * v.scale, sx * v.ox, sy * v.oy);
        c.save(); c.beginPath(); c.rect(0, 0, WIDTH, HEIGHT); c.clip(); c.lineCap = 'round'; c.lineJoin = 'round';
        const nodes = state.lab === 'sandbox' ? state.nodes : state.nodes.filter(n => n.id === state.activeId);
        const holes = nodes.filter(n => n.recipeId === 'blackhole');
        const warp = (x: number, y: number) => {
            let wx = x, wy = y;
            for (const n of holes) { const h = blackHoleGeometry(n), dx = x - h.x, dy = y - h.y, f = Math.min(.76, h.radius ** 2 * 4 / (dx * dx + dy * dy + h.radius ** 2 * 4)); wx -= dx * f; wy -= dy * f; }
            return { x: wx, y: wy };
        };
        if (state.grid) {
            for (let x = 20; x < WIDTH; x += 40) { const pts = []; for (let y = 0; y <= HEIGHT; y += holes.length ? 12 : HEIGHT) pts.push(warp(x, y)); polyline(c, pts, '#e1e1e1', .65); }
            for (let y = 20; y < HEIGHT; y += 40) { const pts = []; for (let x = 0; x <= WIDTH; x += holes.length ? 12 : WIDTH) pts.push(warp(x, y)); polyline(c, pts, '#e1e1e1', .65); }
        }
        for (const n of nodes) {
            const fields = fieldsForNode(n);
            if (!fields.length) continue;
            drawNodeFields(c, n, runtime.time, this.reduced);
            for (const f of fields) this.hits.add({ nodeId: n.id, kind: 'node', x: n.x, y: n.y }, f.kind === 'electric' || f.kind === 'gravity' ? { type: 'rect', x: f.x - f.radius, y: f.y - f.radius * .74, w: f.radius * 2, h: f.radius * 1.48, angle: f.angle } : { type: 'circle', x: f.x, y: f.y, r: f.radius, filled: true });
            const glyph = n.recipeId === 'crossedFields' ? 'E  B' : n.recipeId === 'magneticCoil' ? 'I' : n.recipeId === 'gravitySource' || n.recipeId === 'inverseGravity' ? 'M' : n.recipeId === 'electricField' ? 'E' : n.recipeId === 'lorentz' ? 'B' : tokenGlyph(n);
            if (n.recipeId !== 'magneticCoil') this.glyph(glyph, n.x, n.y, glyph.length > 2 ? 29 : 39);
            this.hits.add({ nodeId: n.id, kind: 'node', x: n.x, y: n.y }, { type: 'circle', x: n.x, y: n.y, r: 24, filled: true }, true);
        }
        for (const n of nodes.filter(isApparatus)) {
            const scale = state.lab === 'sandbox' ? n.recipeId === 'gravitation' ? .9 : .64 : .94;
            const tx = n.x - 500 * scale, ty = n.y - 360 * scale;
            c.save(); c.translate(tx, ty); c.scale(scale, scale);
            recordFor({ registry: this.hits, target: { nodeId: n.id, kind: 'apparatus', x: n.x, y: n.y }, tx, ty, scale });
            const effect = EFFECTS[n.recipeId!];
            if (!effect) throw new Error(`Нет эффекта ${n.recipeId}`);
            effect({ c, node: n, age: runtime.ages.get(n.id) ?? 0, time: runtime.time, state, world: runtime.world });
            recordFor(null); c.restore();
        }
        for (const hole of holes) this.holeBack(hole, runtime.time);
        if (state.lab === 'sandbox') {
            for (const item of runtime.world.bodies.values()) {
                const b = item.body;
                if (state.trails) polyline(c, item.trail, '#aaa', .85);
                if (!item.label) { circle(c, b.position.x, b.position.y, 1.6, '#555', null); continue; }
                const near = holes.map(n => ({ h: blackHoleGeometry(n) })).find(({ h }) => Math.hypot(b.position.x - h.x, b.position.y - h.y) < h.radius + 70);
                c.save(); c.translate(b.position.x, b.position.y);
                if (near) { const dx = b.position.x - near.h.x, dy = b.position.y - near.h.y, d = Math.hypot(dx, dy), k = Math.max(.12, Math.min(1, (d - near.h.radius * .7) / 75)); c.rotate(Math.atan2(dy, dx) * (1 - k)); c.scale(k, k); }
                this.glyph(item.label, 0, 0);
                const charge = runtime.world.chargeOf(item);
                if (item.label.startsWith('q')) { c.font = '16px Arial'; c.textAlign = 'center'; c.fillStyle = INK; c.fillText(charge > 0 ? '+' : charge < 0 ? '−' : '0', 24, -17); }
                c.restore();
                if (state.vectors && b.speed > .12 && !near) { const d = Math.hypot(b.velocity.x, b.velocity.y), ux = b.velocity.x / d, uy = b.velocity.y / d; arrow(c, b.position.x + ux * 28, b.position.y + uy * 28, b.position.x + ux * (28 + Math.min(60, d * 13)), b.position.y + uy * (28 + Math.min(60, d * 13)), MUTED, .9); }
                this.hits.add({ nodeId: item.owner, kind: 'body', bodyKey: item.key, x: b.position.x, y: b.position.y }, { type: 'circle', x: b.position.x, y: b.position.y, r: Math.max(item.radius, 22), filled: true }, true);
            }
            // A spring is attached to its real body, not to a second formula tile.
            for (const n of nodes.filter(n => n.recipeId === 'hooke')) {
                const b = runtime.world.bodies.get(`${n.id}/0`); if (!b) continue;
                const pts = Array.from({ length: 37 }, (_, i) => ({ x: n.x - 200 + (b.body.position.x - 24 - n.x + 200) * i / 36, y: n.y + (i === 0 || i === 36 ? 0 : i % 2 ? 8 : -8) }));
                polyline(c, pts, INK, 1.3); line(c, n.x - 200, n.y - 30, n.x - 200, n.y + 30, INK, 2);
            }
            for (const n of nodes) if (!hasBodies(n) && !isField(n) && !isApparatus(n) && n.recipeId !== 'blackhole') {
                this.glyph(tokenGlyph(n), n.x, n.y);
                this.hits.add({ nodeId: n.id, kind: 'node', x: n.x, y: n.y }, { type: 'circle', x: n.x, y: n.y, r: 23 + Math.max(0, n.parts.length - 1) * 7, filled: true }, true);
            }
            line(c, 0, FLOOR, WIDTH, FLOOR, '#a3a3a3', 1);
        }
        runtime.fx.draw(c, this.reduced);
        for (const n of holes) {
            const h = blackHoleGeometry(n);
            circle(c, h.x, h.y, h.radius + 6, null, '#686868', .9);
            circle(c, h.x, h.y, h.radius, '#151515', null);
            circle(c, h.x, h.y, h.radius - 3, null, '#ececec', .8);
            circle(c, h.x, h.y, h.radius - 7, '#0a0a0a', null);
            this.hits.add({ nodeId: n.id, kind: 'node', x: h.x, y: h.y }, { type: 'circle', x: h.x, y: h.y, r: h.radius + 6, filled: true }, true);
        }
        if (this.craftTarget) {
            const target = this.hits.targets().find(h => h.nodeId === this.craftTarget);
            if (target) { c.save(); c.setLineDash([3, 5]); circle(c, target.x, target.y, 35, null, '#555', .9); c.restore(); }
        }
        c.restore();
    }
}
''']]},
{'path': 'src/rendering/effects.ts', 'sha256': '1f800ce4167ccf7f0b0d127486147853c28440698b7a27bd3979296cf79f1d87', 'edits': [[0, 0, "import { fieldEffects } from './fields';\n"], [580, 735, ' ...fieldEffects, ...mechanicsEffects, ...thermalEffects, ...circuitEffects, ...magneticEffects, ...waveEffects, ...opticsEffects, ...quantumEffects, ...relativityEffects }']]},
{'path':'src/rendering/fields.ts','sha256':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','edits':[[0,0,r'''import { fieldsForNode } from '../physics/fieldModel';
import type { FieldRegion } from '../physics/fieldModel';
import type { FormulaNode } from '../core/types';
import { arrow, circle, INK, line, polyline, text } from './primitives';
import type { EffectRenderer } from './primitives';

export function drawField(c: CanvasRenderingContext2D, f: FieldRegion, time: number, reduced = false) {
    const R = f.radius;
    c.save(); c.translate(f.x, f.y); c.rotate(f.angle);
    if (f.kind === 'electric' || f.kind === 'gravity') {
        c.strokeStyle = '#b7b7b7'; c.lineWidth = .75; c.setLineDash([3, 7]); c.strokeRect(-R, -R * .74, R * 2, R * 1.48); c.setLineDash([]);
        if (f.kind === 'electric' && f.value !== 0) {
            const sign = Math.sign(f.value);
            for (let y = -R * .56; y <= R * .6; y += 35) {
                if (Math.abs(y) < 25) continue;
                arrow(c, -sign * (R - 13), y, sign * (R - 13), y, '#aaa', .9);
                if (!reduced) { const x = (((time * (18 + Math.abs(f.value) * 2) + y * 3) % (R * 2 - 35)) + R * 2 - 35) % (R * 2 - 35); circle(c, sign * (-R + 17 + x), y, 1.7, '#6e6e6e', null); }
            }
        }
        if (f.kind === 'gravity' && f.value !== 0) for (let x = -R + 26; x < R; x += 43) {
            if (Math.abs(x) < 24) continue;
            arrow(c, x, -R * .58, x, R * .58, '#b0b0b0', .85);
            if (!reduced) circle(c, x, -R * .58 + ((time * 24 + x + 1000) % (R * 1.16)), 1.5, '#777', null);
        }
    } else if (f.kind === 'magnetic') {
        circle(c, 0, 0, R, null, '#b5b5b5', .8);
        if (f.value !== 0) for (let x = -R + 15; x < R; x += 23) for (let y = -R + 15; y < R; y += 23) {
            const d = x * x + y * y; if (d > (R - 8) ** 2 || d < 31 ** 2) continue;
            if (f.value > 0) circle(c, x, y, 1.2, '#a0a0a0', null);
            else { line(c, x - 2.5, y - 2.5, x + 2.5, y + 2.5, '#a0a0a0', .8); line(c, x + 2.5, y - 2.5, x - 2.5, y + 2.5, '#a0a0a0', .8); }
        }
    } else if (f.kind === 'wire') {
        for (let r = 45; r <= R; r += 35) {
            circle(c, 0, 0, r, null, '#b8b8b8', .75);
            if (!f.value) continue;
            const a = reduced ? -.3 : -time * .5 * Math.sign(f.value) + r / 50;
            arrow(c, r * Math.cos(a), r * Math.sin(a), r * Math.cos(a) + Math.sin(a) * 18 * Math.sign(f.value), r * Math.sin(a) - Math.cos(a) * 18 * Math.sign(f.value), '#777', .9);
        }
    } else if (f.kind === 'source') {
        for (const k of [.7, 1.2, 1.8]) circle(c, 0, 0, R * k, null, '#d0d0d0', .75);
        for (let i = 0; i < 16; i++) {
            const a = i * Math.PI / 8;
            for (const k of [.6, 1.1, 1.6]) { const r = R * k, l = Math.min(30, 12 / (k * k)); arrow(c, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * (r - l), Math.sin(a) * (r - l), '#999', .8); }
            if (!reduced) { const r = 35 + ((R * 1.6 - (time * 27 + i * 9) % (R * 1.6))); circle(c, Math.cos(a) * r, Math.sin(a) * r, 1.3, '#999', null); }
        }
    }
    c.restore();
}
export function drawNodeFields(c: CanvasRenderingContext2D, n: FormulaNode, time: number, reduced = false) {
    for (const f of fieldsForNode(n)) drawField(c, f, time, reduced);
    if (n.recipeId === 'magneticCoil') {
        const R = n.params.r * 32;
        circle(c, n.x, n.y, R * .97, null, INK, 1.5);
        const a = -time * .45 * Math.sign(n.params.I), points = Array.from({ length: 18 }, (_, i) => ({ x: n.x + Math.cos(a - i * .025) * R * .97, y: n.y + Math.sin(a - i * .025) * R * .97 }));
        if (n.params.I !== 0) polyline(c, points, '#555', 2);
        text(c, 'I', n.x, n.y, 34, INK, 'center', true);
    }
}
const field: EffectRenderer = d => drawNodeFields(d.c, d.node, d.time);
export const fieldEffects: Record<string, EffectRenderer> = { crossedFields: field, magneticCoil: field, gravitySource: field, inverseGravity: field };
''']]},
{'path':'src/rendering/interaction.ts','sha256':'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855','edits':[[0,0,r'''export interface Point { x: number; y: number; }
export interface SceneTarget extends Point { nodeId: string; kind: 'body' | 'node' | 'apparatus'; bodyKey?: string; }
type Shape = { type: 'circle'; x: number; y: number; r: number; filled: boolean } | { type: 'rect'; x: number; y: number; w: number; h: number; angle?: number } | { type: 'line'; x: number; y: number; x2: number; y2: number };
interface Region { target: SceneTarget; shape: Shape; core: boolean; }
export class HitRegistry {
    regions: Region[] = [];
    clear() { this.regions = []; }
    add(target: SceneTarget, shape: Shape, core = false) { if (this.regions.length < 18000) this.regions.push({ target, shape, core }); }
    pick(x: number, y: number, exclude?: string, core = false, margin = 8): SceneTarget | null {
        for (let i = this.regions.length - 1; i >= 0; i--) {
            const r = this.regions[i], s = r.shape;
            if (r.target.nodeId === exclude || core && !r.core) continue;
            if (s.type === 'circle') { const d = Math.hypot(x - s.x, y - s.y); if (s.filled ? d <= s.r + margin : Math.abs(d - s.r) <= margin) return r.target; }
            if (s.type === 'rect') {
                const cx = s.x + s.w / 2, cy = s.y + s.h / 2, a = s.angle ?? 0;
                const dx = x - cx, dy = y - cy, u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
                if (Math.abs(u) <= s.w / 2 + margin && Math.abs(v) <= s.h / 2 + margin) return r.target;
            }
            if (s.type === 'line') {
                const dx = s.x2 - s.x, dy = s.y2 - s.y, l2 = dx * dx + dy * dy;
                const t = l2 ? Math.max(0, Math.min(1, ((x - s.x) * dx + (y - s.y) * dy) / l2)) : 0;
                if (Math.hypot(x - s.x - t * dx, y - s.y - t * dy) <= margin) return r.target;
            }
        }
        return null;
    }
    targets() { return [...new Map(this.regions.map(r => [r.target.bodyKey ?? r.target.nodeId, r.target])).values()]; }
}
interface Recorder { registry: HitRegistry; target: SceneTarget; tx: number; ty: number; scale: number; }
let recorder: Recorder | null = null;
export function recordFor(value: Recorder | null) { recorder = value; }
export function recordCircle(x: number, y: number, r: number, filled: boolean) {
    const a = recorder; if (!a) return;
    a.registry.add(a.target, { type: 'circle', x: a.tx + x * a.scale, y: a.ty + y * a.scale, r: r * a.scale, filled }, filled);
}
export function recordRect(x: number, y: number, w: number, h: number) {
    const a = recorder; if (!a) return;
    a.registry.add(a.target, { type: 'rect', x: a.tx + Math.min(x, x + w) * a.scale, y: a.ty + Math.min(y, y + h) * a.scale, w: Math.abs(w * a.scale), h: Math.abs(h * a.scale) }, true);
}
export function recordLine(x: number, y: number, x2: number, y2: number) {
    const a = recorder; if (!a) return;
    a.registry.add(a.target, { type: 'line', x: a.tx + x * a.scale, y: a.ty + y * a.scale, x2: a.tx + x2 * a.scale, y2: a.ty + y2 * a.scale });
}
''']]},
{'path': 'src/rendering/labs/circuits.ts', 'sha256': '8c60245e5b264824039ca615fb37a201241ff83f19cb3ff03e89ab69526fa557', 'edits': [[0, 0, "import { capacitorMarkerTravel } from '../../physics/labModels';\n"], [472, 508, '[], current: number, time: number, integratedTravel?: number) {'], [780, 839, '        let dist = (i * total / 18 + (integratedTravel ?? time * speed)) % total;'], [2611, 2641, "        dots(c, path, I, age, id === 'capacitor' ? capacitorMarkerTravel(U / p.R, p.R * p.C * .001, age) : undefined);"]]},
]
