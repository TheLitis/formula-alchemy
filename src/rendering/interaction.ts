import { rotateVector } from '../editor/geometry';
import type { Box } from '../editor/geometry';
export interface Point { x: number; y: number; }
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
    inBox(box: Box): string[] { return [...new Set(this.regions.filter(r => intersects(box, r.shape)).map(r => r.target.nodeId))]; }
    boundsFor(ids: ReadonlySet<string>): Box | null {
        const shapes = this.regions.filter(r => ids.has(r.target.nodeId)).map(r => bounds(r.shape));
        if (!shapes.length) return null;
        const x = Math.min(...shapes.map(b => b.x)), y = Math.min(...shapes.map(b => b.y));
        return { x, y, w: Math.max(...shapes.map(b => b.x + b.w)) - x, h: Math.max(...shapes.map(b => b.y + b.h)) - y };
    }
    targets() { return [...new Map(this.regions.map(r => [r.target.bodyKey ?? r.target.nodeId, r.target])).values()]; }
}
interface Recorder { registry: HitRegistry; target: SceneTarget; tx: number; ty: number; scale: number; angle?: number; }
let recorder: Recorder | null = null;
export function recordFor(value: Recorder | null) { recorder = value; }
function mapPoint(a: Recorder, x: number, y: number) {
    const p = rotateVector({ x: x * a.scale, y: y * a.scale }, a.angle ?? 0);
    return { x: a.tx + p.x, y: a.ty + p.y };
}
export function recordCircle(x: number, y: number, r: number, filled: boolean) {
    const a = recorder; if (!a) return;
    a.registry.add(a.target, { type: 'circle', ...mapPoint(a, x, y), r: r * a.scale, filled }, filled);
}
export function recordRect(x: number, y: number, w: number, h: number) {
    const a = recorder; if (!a) return;
    const center = mapPoint(a, x + w / 2, y + h / 2), width = Math.abs(w * a.scale), height = Math.abs(h * a.scale);
    a.registry.add(a.target, { type: 'rect', x: center.x - width / 2, y: center.y - height / 2, w: width, h: height, angle: a.angle }, true);
}
export function recordLine(x: number, y: number, x2: number, y2: number) {
    const a = recorder; if (!a) return;
    const end = mapPoint(a, x2, y2);
    a.registry.add(a.target, { type: 'line', ...mapPoint(a, x, y), x2: end.x, y2: end.y });
}
function bounds(s: Shape): Box {
    if (s.type === 'circle') return { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
    if (s.type === 'line') return { x: Math.min(s.x, s.x2), y: Math.min(s.y, s.y2), w: Math.abs(s.x2 - s.x), h: Math.abs(s.y2 - s.y) };
    const c = Math.abs(Math.cos(s.angle ?? 0)), si = Math.abs(Math.sin(s.angle ?? 0)), w = s.w * c + s.h * si, h = s.w * si + s.h * c;
    return { x: s.x + s.w / 2 - w / 2, y: s.y + s.h / 2 - h / 2, w, h };
}
function intersects(box: Box, s: Shape): boolean {
    const b = bounds(s);
    if (b.x > box.x + box.w || b.x + b.w < box.x || b.y > box.y + box.h || b.y + b.h < box.y) return false;
    if (s.type === 'circle') {
        const x = Math.max(box.x, Math.min(s.x, box.x + box.w)), y = Math.max(box.y, Math.min(s.y, box.y + box.h));
        if ((x - s.x) ** 2 + (y - s.y) ** 2 > s.r ** 2) return false;
        if (!s.filled && [[box.x,box.y],[box.x+box.w,box.y],[box.x,box.y+box.h],[box.x+box.w,box.y+box.h]].every(([px,py]) => Math.hypot(px-s.x,py-s.y)<s.r)) return false;
        return true;
    }
    if (s.type === 'line') {
        const dx = s.x2 - s.x, dy = s.y2 - s.y;
        let lo = 0, hi = 1;
        for (const [p,q] of [[-dx,s.x-box.x],[dx,box.x+box.w-s.x],[-dy,s.y-box.y],[dy,box.y+box.h-s.y]]) {
            if (p === 0) { if (q < 0) return false; continue; }
            const t = q / p; if (p < 0) lo = Math.max(lo,t); else hi = Math.min(hi,t);
        }
        return lo <= hi;
    }
    // SAT for a rotated rectangle versus the axis-aligned marquee.
    const a = s.angle ?? 0, u = { x: Math.cos(a), y: Math.sin(a) }, v = { x: -u.y, y: u.x };
    const delta = { x: s.x+s.w/2-box.x-box.w/2, y: s.y+s.h/2-box.y-box.h/2 };
    return [{x:1,y:0},{x:0,y:1},u,v].every(axis => {
        const distance = Math.abs(delta.x*axis.x+delta.y*axis.y);
        const rb = (box.w*Math.abs(axis.x)+box.h*Math.abs(axis.y))/2;
        const rs = (s.w*Math.abs(u.x*axis.x+u.y*axis.y)+s.h*Math.abs(v.x*axis.x+v.y*axis.y))/2;
        return distance <= rb+rs;
    });
}
