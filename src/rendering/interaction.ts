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
