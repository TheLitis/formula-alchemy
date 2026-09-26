import { orientation } from '../editor/geometry';
import type { FormulaNode } from '../core/types';
import { PX_PER_M } from '../core/types';

export interface FieldRegion { owner: string; kind: 'electric' | 'magnetic' | 'gravity' | 'wire' | 'source'; x: number; y: number; radius: number; value: number; angle: number; }
export function fieldsForNode(n: FormulaNode): FieldRegion[] {
    const p = n.params, id = n.recipeId, symbol = !id && n.parts.length === 1 ? n.parts[0] : '';
    const base = { owner: n.id, x: n.x, y: n.y, radius: (p.extent ?? 5) * PX_PER_M, angle: (id === 'electricField' ? Math.PI / 2 : (p.angle ?? 0) * Math.PI / 180) + orientation(n) };
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
