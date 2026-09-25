import { tokenGlyph } from '../core/entities';
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
