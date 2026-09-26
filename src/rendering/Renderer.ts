import { registerParts, canManipulateBody } from '../editor/Parts';
import { orientation, selectionIds } from '../editor/geometry';
import type { Box } from '../editor/geometry';
import { HEIGHT, WIDTH } from '../core/types';
import type { FormulaNode, GameState, Viewport } from '../core/types';
import { hasBodies, isApparatus, isField, tokenGlyph } from '../core/entities';
import type { SimulationRuntime } from '../physics/Runtime';
import { blackHoleGeometry } from '../physics/geometry';
import { fieldsForNode } from '../physics/fieldModel';
import { FLOOR } from '../physics/World';
import { EFFECTS } from './effects';
import { collectSpeedReadings, apparatusTransform } from '../physics/speedReadings';
import { drawSpeedLabels } from './speedLabels';
import type { SpeedLabel } from './speedLabels';
import { drawNodeFields } from './fields';
import { HitRegistry, recordFor } from './interaction';
import { arrow, circle, INK, line, MUTED, PAPER, polyline, setLabelScale, setApparatusLabels } from './primitives';
export function getViewport(width: number, height: number): Viewport { const scale = Math.min(width / WIDTH, height / HEIGHT); return { width, height, scale, ox: (width - WIDTH * scale) / 2, oy: (height - HEIGHT * scale) / 2 }; }
export function toWorld(v: Viewport, x: number, y: number) { return { x: (x - v.ox) / v.scale, y: (y - v.oy) / v.scale }; }

export interface FloatingSelection { ids: string[]; bodyKey?: string; offset?: { x: number; y: number }; }
export class CanvasRenderer {
    c: CanvasRenderingContext2D;
    viewport: Viewport = getViewport(WIDTH, HEIGHT);
    hits = new HitRegistry();
    speedLabels: SpeedLabel[] = [];
    reduced = false;
    hoverId: string | null = null;
    craftTarget: string | null = null;
    marquee: { box: Box; additive: boolean } | null = null;
    floating: FloatingSelection | null = null;
    private overlay: CanvasRenderer | null = null;
    setFloating(selection: FloatingSelection | null) {
        this.floating = selection;
        if (!selection) { this.overlay?.canvas.remove(); this.overlay = null; }
    }
    dispose() { this.setFloating(null); }
    constructor(public canvas: HTMLCanvasElement, private transparent = false) {
        const c = canvas.getContext('2d', { alpha: transparent }); if (!c) throw new Error('Canvas 2D недоступен.'); this.c = c;
        this.reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    resize(width: number, height: number) { const dpr = Math.min(window.devicePixelRatio || 1, 1.75); this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr); this.viewport = getViewport(width, height); }
    private glyph(value: string, x: number, y: number, size = 42, opacity = 1, angle = 0) {
        const c = this.c; c.save(); c.globalAlpha = opacity; c.fillStyle = INK; c.font = `italic ${Math.max(size, Math.min(70, 28 / this.viewport.scale))}px Georgia, 'Times New Roman', serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.translate(x, y); c.rotate(angle); c.fillText(value, 0, 0); c.restore();
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
        c.setTransform(1, 0, 0, 1, 0, 0); if (this.transparent) c.clearRect(0, 0, canvas.width, canvas.height); else { c.fillStyle = PAPER; c.fillRect(0, 0, canvas.width, canvas.height); }
        const sx = canvas.width / v.width, sy = canvas.height / v.height;
        c.setTransform(sx * v.scale, 0, 0, sy * v.scale, sx * v.ox, sy * v.oy);
        c.save(); if (!this.transparent) { c.beginPath(); c.rect(0, 0, WIDTH, HEIGHT); c.clip(); } c.lineCap = 'round'; c.lineJoin = 'round';
        const visible = state.lab === 'sandbox' ? state.nodes : state.nodes.filter(n => n.id === state.activeId);
        const floatingIds = new Set(this.floating?.ids ?? []);
        const nodes = this.transparent ? (this.floating?.bodyKey ? [] : visible.filter(n => floatingIds.has(n.id)).map(n => ({...n,x:n.x+(this.floating?.offset?.x??0),y:n.y+(this.floating?.offset?.y??0)}))) : visible.filter(n => !floatingIds.has(n.id) || !!this.floating?.bodyKey);
        const holes = nodes.filter(n => n.recipeId === 'blackhole');
        const warp = (x: number, y: number) => {
            let wx = x, wy = y;
            for (const n of holes) { const h = blackHoleGeometry(n), dx = x - h.x, dy = y - h.y, f = Math.min(.76, h.radius ** 2 * 4 / (dx * dx + dy * dy + h.radius ** 2 * 4)); wx -= dx * f; wy -= dy * f; }
            return { x: wx, y: wy };
        };
        if (state.grid && !this.transparent) {
            for (let x = 20; x < WIDTH; x += 40) { const pts = []; for (let y = 0; y <= HEIGHT; y += holes.length ? 12 : HEIGHT) pts.push(warp(x, y)); polyline(c, pts, '#e1e1e1', .65); }
            for (let y = 20; y < HEIGHT; y += 40) { const pts = []; for (let x = 0; x <= WIDTH; x += holes.length ? 12 : WIDTH) pts.push(warp(x, y)); polyline(c, pts, '#e1e1e1', .65); }
        }
        for (const n of nodes) {
            const fields = fieldsForNode(n);
            if (!fields.length) continue;
            drawNodeFields(c, n, runtime.time, this.reduced);
            for (const f of fields) this.hits.add({ nodeId: n.id, kind: 'node', x: n.x, y: n.y }, f.kind === 'electric' || f.kind === 'gravity' ? { type: 'rect', x: f.x - f.radius, y: f.y - f.radius * .74, w: f.radius * 2, h: f.radius * 1.48, angle: f.angle } : { type: 'circle', x: f.x, y: f.y, r: f.radius, filled: true });
            const glyph = n.recipeId === 'crossedFields' ? 'E  B' : n.recipeId === 'magneticCoil' ? 'I' : n.recipeId === 'gravitySource' || n.recipeId === 'inverseGravity' ? 'M' : n.recipeId === 'electricField' ? 'E' : n.recipeId === 'lorentz' ? 'B' : tokenGlyph(n);
            if (n.recipeId !== 'magneticCoil') this.glyph(glyph, n.x, n.y, glyph.length > 2 ? 29 : 39, 1, orientation(n));
            this.hits.add({ nodeId: n.id, kind: 'node', x: n.x, y: n.y }, { type: 'circle', x: n.x, y: n.y, r: 24, filled: true }, true);
        }
        for (const n of nodes.filter(isApparatus)) {
            const { scale, tx, ty, angle } = apparatusTransform(n, state.lab);
            c.save(); c.translate(tx, ty); c.rotate(angle); c.scale(scale, scale);
            recordFor({ registry: this.hits, target: { nodeId: n.id, kind: 'apparatus', x: n.x, y: n.y }, tx, ty, scale, angle });
            const effect = EFFECTS[n.recipeId!];
            if (!effect) throw new Error(`Нет эффекта ${n.recipeId}`);
            effect({ c, node: n, age: runtime.ages.get(n.id) ?? 0, time: runtime.time, state, world: runtime.world, labState: runtime.labStates.get(n.id) });
            recordFor(null); c.restore();
            registerParts(this.hits, n, state.lab, runtime.ages.get(n.id) ?? 0, runtime.labStates.get(n.id));
        }
        for (const hole of holes) this.holeBack(hole, runtime.time);
        if (state.lab === 'sandbox') {
            for (const item of runtime.world.bodies.values()) {
                const include = this.floating?.bodyKey ? this.floating.bodyKey === item.key : floatingIds.has(item.owner);
                if (this.transparent ? !include : include) continue;
                const b = item.body;
                if (state.trails && !this.transparent) polyline(c, item.trail, '#aaa', .85);
                if (!item.label) { circle(c, b.position.x, b.position.y, 1.6, '#555', null); continue; }
                const near = holes.map(n => ({ h: blackHoleGeometry(n) })).find(({ h }) => Math.hypot(b.position.x - h.x, b.position.y - h.y) < h.radius + 70);
                c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle);
                if (near) { const dx = b.position.x - near.h.x, dy = b.position.y - near.h.y, d = Math.hypot(dx, dy), k = Math.max(.12, Math.min(1, (d - near.h.radius * .7) / 75)); c.rotate(Math.atan2(dy, dx) * (1 - k)); c.scale(k, k); }
                this.glyph(item.label, 0, 0);
                const charge = runtime.world.chargeOf(item);
                if (item.label.startsWith('q')) { c.font = '16px Arial'; c.textAlign = 'center'; c.fillStyle = INK; c.fillText(charge > 0 ? '+' : charge < 0 ? '−' : '0', 24, -17); }
                c.restore();
                if (state.vectors && b.speed > .12 && !near) { const d = Math.hypot(b.velocity.x, b.velocity.y), ux = b.velocity.x / d, uy = b.velocity.y / d; arrow(c, b.position.x + ux * 28, b.position.y + uy * 28, b.position.x + ux * (28 + Math.min(60, d * 13)), b.position.y + uy * (28 + Math.min(60, d * 13)), MUTED, .9); }
                this.hits.add({ nodeId: item.owner, kind: 'body', bodyKey: item.key, x: b.position.x, y: b.position.y, partId: visible.some(n => n.id === item.owner && canManipulateBody(n)) ? 'body' : undefined, partLabel: 'Тело: оттяните отдельно. Alt — перенос всей установки.' }, { type: 'circle', x: b.position.x, y: b.position.y, r: Math.max(item.radius, 22), filled: true }, true);
            }
            // A spring is attached to its real body, not to a second formula tile.
            for (const n of nodes.filter(n => n.recipeId === 'hooke')) {
                const b = runtime.world.bodies.get(`${n.id}/0`); if (!b) continue;
                const a = orientation(n), u = { x: Math.cos(a), y: Math.sin(a) }, v = { x: -u.y, y: u.x };
                const from = { x: n.x - 200 * u.x, y: n.y - 200 * u.y }, to = { x: b.body.position.x - 24 * u.x, y: b.body.position.y - 24 * u.y };
                const pts = Array.from({ length: 37 }, (_, i) => { const d = i === 0 || i === 36 ? 0 : i % 2 ? 8 : -8; return { x: from.x + (to.x - from.x) * i / 36 + v.x * d, y: from.y + (to.y - from.y) * i / 36 + v.y * d }; });
                polyline(c, pts, INK, 1.3); line(c, from.x - v.x * 30, from.y - v.y * 30, from.x + v.x * 30, from.y + v.y * 30, INK, 2);
                for (let i = 1; i < pts.length; i++) this.hits.add({ nodeId: n.id, kind: 'node', x: n.x, y: n.y }, { type: 'line', ...pts[i - 1], x2: pts[i].x, y2: pts[i].y });
            }
            for (const n of nodes) if (!hasBodies(n) && !isField(n) && !isApparatus(n) && n.recipeId !== 'blackhole') {
                this.glyph(tokenGlyph(n), n.x, n.y, 42, 1, orientation(n));
                this.hits.add({ nodeId: n.id, kind: 'node', x: n.x, y: n.y }, { type: 'circle', x: n.x, y: n.y, r: 23 + Math.max(0, n.parts.length - 1) * 7, filled: true }, true);
            }
            if (!this.transparent) line(c, 0, FLOOR, WIDTH, FLOOR, '#a3a3a3', 1);
        }
        if (!this.transparent) runtime.fx.draw(c, this.reduced);
        for (const n of holes) {
            const h = blackHoleGeometry(n);
            circle(c, h.x, h.y, h.radius + 6, null, '#686868', .9);
            circle(c, h.x, h.y, h.radius, '#151515', null);
            circle(c, h.x, h.y, h.radius - 3, null, '#ececec', .8);
            circle(c, h.x, h.y, h.radius - 7, '#0a0a0a', null);
            this.hits.add({ nodeId: n.id, kind: 'node', x: h.x, y: h.y }, { type: 'circle', x: h.x, y: h.y, r: h.radius + 6, filled: true }, true);
        }
        // Selection is an outline around real geometry, never a proxy object/handle.
        const selected = this.transparent ? [] : selectionIds(state);
        c.save(); c.strokeStyle = '#737373'; c.lineWidth = .9 / Math.max(.65, v.scale); c.setLineDash([4, 5]);
        for (const id of selected) {
            const b = this.hits.boundsFor(new Set([id]));
            if (b) c.strokeRect(b.x - 7, b.y - 7, b.w + 14, b.h + 14);
        }
        if (selected.length > 1) {
            const b = this.hits.boundsFor(new Set(selected));
            if (b) { c.setLineDash([7, 5]); c.strokeStyle = '#333'; c.strokeRect(b.x - 14, b.y - 14, b.w + 28, b.h + 28); }
        }
        c.restore();
        if (this.marquee) {
            const b = this.marquee.box;
            c.save(); c.fillStyle = 'rgba(45,45,45,.04)'; c.fillRect(b.x, b.y, b.w, b.h);
            c.strokeStyle = '#414141'; c.lineWidth = 1 / Math.max(.5, v.scale);
            c.setLineDash(this.marquee.additive ? [5, 4] : []); c.strokeRect(b.x, b.y, b.w, b.h); c.restore();
        }
        this.speedLabels = this.transparent ? [] : drawSpeedLabels(c, collectSpeedReadings(state, runtime.world, runtime.ages, runtime.labStates).filter(r => !(this.floating?.bodyKey ? r.key === this.floating.bodyKey : floatingIds.has(r.nodeId))), state, v);
        if (this.craftTarget) {
            const target = this.hits.targets().find(h => h.nodeId === this.craftTarget);
            if (target) { c.save(); c.setLineDash([3, 5]); circle(c, target.x, target.y, 35, null, '#555', .9); c.restore(); }
        }
        c.restore();
        if (!this.transparent && this.floating) {
            if (!this.overlay) {
                const overlay = document.createElement('canvas');
                overlay.dataset.dragLayer = 'true'; overlay.setAttribute('aria-hidden','true');
                Object.assign(overlay.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',pointerEvents:'none',zIndex:'50000'});
                document.body.appendChild(overlay); this.overlay = new CanvasRenderer(overlay, true);
            }
            const layer = this.overlay, bounds = this.canvas.getBoundingClientRect();
            if(layer.viewport.width!==innerWidth||layer.viewport.height!==innerHeight)layer.resize(innerWidth,innerHeight);
            layer.viewport={width:innerWidth,height:innerHeight,scale:v.scale,ox:bounds.left+v.ox,oy:bounds.top+v.oy};
            layer.floating=this.floating; layer.reduced=this.reduced; layer.render(state,runtime);
        }
    }
}
