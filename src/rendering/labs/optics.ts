import { calculate, formatValue, radians } from '../../core/evaluate';
import { arrow, circle, FAINT, INK, line, MUTED, PAPER, rect, text } from '../primitives';
import type { EffectRenderer } from '../primitives';
const snell: EffectRenderer = ({ c, node, age }) => {
    const p = node.params, theta = radians(p.theta), reading = calculate('snell', p), tir = !!reading.note, theta2 = radians(reading.value), cx = 500, cy = 345;
    rect(c, 110, 345, 780, 235, '#e8e8e8', null);
    line(c, 110, 345, 890, 345, MUTED, 1.5);
    line(c, cx, 135, cx, 585, MUTED, 1, [5, 6]);
    text(c, `n₁ = ${p.n1}`, 150, 218, 25, INK, 'left', true);
    text(c, `n₂ = ${p.n2}`, 150, 526, 25, INK, 'left', true);
    const sx = cx - Math.sin(theta) * 215, sy = cy - Math.cos(theta) * 215;
    line(c, sx, sy, cx, cy, INK, 2.2);
    arrow(c, sx, sy, cx - (cx - sx) * .28, cy - (cy - sy) * .28, INK, 2);
    circle(c, sx, sy, 9, PAPER, INK, 1.5);
    const rx = cx + Math.sin(theta) * 240, ry = cy - Math.cos(theta) * 240;
    line(c, cx, cy, rx, ry, tir ? INK : FAINT, tir ? 2 : 1, tir ? [] : [3, 4]);
    if (!tir) {
        const tx = cx + Math.sin(theta2) * 235, ty = cy + Math.cos(theta2) * 235;
        arrow(c, cx, cy, tx, ty, INK, 2);
        text(c, `${formatValue(reading.value)}°`, cx + 30, cy + 85, 20, INK);
    }
    else
        arrow(c, cx, cy, rx, ry, INK, 2);
    const endX = tir ? rx : cx + Math.sin(theta2) * 235, endY = tir ? ry : cy + Math.cos(theta2) * 235;
    lightPackets(c, [{ x: sx, y: sy }, { x: cx, y: cy }, { x: endX, y: endY }], age);
    c.beginPath();
    c.arc(cx, cy, 54, -Math.PI / 2 - theta, -Math.PI / 2);
    c.strokeStyle = MUTED;
    c.stroke();
    text(c, `${p.theta}°`, cx - 25, cy - 80, 20, INK, 'right');
    text(c, tir ? 'Полное внутреннее отражение' : 'Углы отсчитываются от нормали', 500, 625, 23, INK, 'center', true);
};
const lens: EffectRenderer = ({ c, node, age }) => {
    const p = node.params, b = calculate('lens', p).value, scale = 4, cx = 500, cy = 340, ox = cx - p.d * scale, oy = 270, focus = p.focus * scale;
    line(c, 90, cy, 920, cy, FAINT, 1);
    c.save();
    c.beginPath();
    c.ellipse(cx, cy, 17, 190, 0, 0, 2 * Math.PI);
    c.fillStyle = '#e5e5e5';
    c.fill();
    c.strokeStyle = '#979797';
    c.stroke();
    c.restore();
    for (const [x, label] of [[cx - focus, 'F'], [cx + focus, 'F′']] as const) {
        line(c, x, cy - 6, x, cy + 6);
        text(c, label, x, cy + 30, 20, MUTED, 'center', true);
    }
    arrow(c, ox, cy, ox, oy, INK, 2.5);
    text(c, 'предмет', ox, oy - 21, 16, INK, 'center');
    line(c, ox, oy, cx, oy, INK, 1.3);
    line(c, cx, oy, 920, oy + (920 - cx) * 70 / focus, INK, 1.3);
    line(c, ox, oy, 920, cy + (920 - cx) * 70 / (p.d * scale), MUTED, 1.3);
    lightPackets(c, [{ x: ox, y: oy }, { x: cx, y: oy }, { x: 920, y: oy + 420 * 70 / focus }], age);
    lightPackets(c, [{ x: ox, y: oy }, { x: cx, y: cy }, { x: 920, y: cy + 420 * 70 / (p.d * scale) }], age + .6);
    if (Number.isFinite(b)) {
        const ix = cx + b * scale, iy = cy + 70 * b / p.d;
        if (b < 0) {
            line(c, cx, oy, Math.max(95, ix), oy + (Math.max(95, ix) - cx) * 70 / focus, MUTED, 1, [4, 5]);
            line(c, cx, cy, Math.max(95, ix), cy + (Math.max(95, ix) - cx) * 70 / (p.d * scale), MUTED, 1, [4, 5]);
        }
        if (ix > 90 && ix < 920 && iy > 100 && iy < 580) {
            arrow(c, ix, cy, ix, iy, INK, 2);
            text(c, b < 0 ? 'мнимое' : 'изображение', ix, iy + (iy > cy ? 28 : -19), 15, INK, 'center');
        }
        else
            text(c, 'Изображение за границей схемы', 500, 575, 16, MUTED, 'center');
        text(c, `b = ${formatValue(b)} см   ·   Γ = ${formatValue(-b / p.d)}`, 500, 628, 24, INK, 'center', true);
    }
    else {
        text(c, 'd = F: лучи параллельны, b → ∞', 500, 626, 25, INK, 'center', true);
    }
};
function lightPackets(c: CanvasRenderingContext2D, path: { x: number; y: number }[], time: number) {
    const lengths = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
    const total = lengths.reduce((a, b) => a + b, 0);
    for (let i = 0; i < 4; i++) {
        let distance = (Math.max(0, time) * 100 + i * total / 4) % total;
        for (let j = 0; j < lengths.length; j++) {
            if (distance < lengths[j]) { const t = distance / lengths[j]; circle(c, path[j].x + (path[j + 1].x - path[j].x) * t, path[j].y + (path[j + 1].y - path[j].y) * t, 2.6, INK, null); break; }
            distance -= lengths[j];
        }
    }
}
export const opticsEffects: Record<string, EffectRenderer> = { snell, lens };
