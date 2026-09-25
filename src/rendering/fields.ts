import { fieldsForNode } from '../physics/fieldModel';
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
