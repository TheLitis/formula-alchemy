import { formatValue } from '../../core/evaluate';
import { circle, FAINT, INK, line, MUTED, PAPER, polyline, rect, text } from '../primitives';
import type { DrawContext, EffectRenderer } from '../primitives';
function resistor(c: CanvasRenderingContext2D, x: number, y: number, label: string) { rect(c, x - 45, y - 17, 90, 34, PAPER, INK); text(c, label, x, y - 33, 16, INK, 'center'); }
function dots(c: CanvasRenderingContext2D, path: {
    x: number;
    y: number;
}[], current: number, time: number) {
    if (current <= 1e-7)
        return;
    const lengths = path.slice(1).map((v, i) => Math.hypot(v.x - path[i].x, v.y - path[i].y)), total = lengths.reduce((a, b) => a + b, 0);
    const speed = 35 * Math.min(8, Math.sqrt(current));
    for (let i = 0; i < 18; i++) {
        let dist = (i * total / 18 + time * speed) % total;
        for (let j = 0; j < lengths.length; j++) {
            if (dist <= lengths[j]) {
                const t = dist / lengths[j];
                circle(c, path[j].x + (path[j + 1].x - path[j].x) * t, path[j].y + (path[j + 1].y - path[j].y) * t, 3.1, INK, null);
                break;
            }
            dist -= lengths[j];
        }
    }
}
const circuit: EffectRenderer = (d: DrawContext) => {
    const { c, node, age } = d, p = node.params, id = node.recipeId!, closed = node.closed;
    let U = p.U ?? p.I * (p.R ?? 1), I = p.I ?? U / (p.R ?? 10);
    if (id === 'series')
        I = U / (p.R + p.R2);
    if (id === 'parallel')
        I = U / p.R + U / p.R2;
    const capFraction = id === 'capacitor' ? 1 - Math.exp(-age / (p.R * p.C * 1e-3)) : 0;
    if (id === 'capacitor')
        I = U / p.R * (1 - capFraction);
    if (!closed)
        I = 0;
    const path = [{ x: 245, y: 390 }, { x: 245, y: 235 }, { x: 765, y: 235 }, { x: 765, y: 510 }, { x: 245, y: 510 }, { x: 245, y: 390 }];
    polyline(c, path, INK, 1.6);
    if (id === 'parallel') {
        const branch = [{ x: 365, y: 235 }, { x: 365, y: 390 }, { x: 680, y: 390 }, { x: 680, y: 235 }];
        polyline(c, branch, INK, 1.5);
        dots(c, [{ x: 365, y: 235 }, { x: 680, y: 235 }], closed ? U / p.R : 0, age);
        dots(c, branch, closed ? U / p.R2 : 0, age);
        resistor(c, 520, 235, `R₁ = ${p.R} Ом`);
        resistor(c, 520, 390, `R₂ = ${p.R2} Ом`);
        text(c, `I₁ = ${formatValue(closed ? U / p.R : 0)} А`, 710, 293, 15, MUTED);
        text(c, `I₂ = ${formatValue(closed ? U / p.R2 : 0)} А`, 710, 434, 15, MUTED);
        dots(c, [path[0], path[1], { x: 350, y: 235 }], I, age);
        dots(c, [{ x: 700, y: 235 }, ...path.slice(3)], I, age);
    }
    else {
        dots(c, path, I, age);
        if (id === 'series') {
            resistor(c, 455, 235, `R₁ = ${p.R} Ом`);
            resistor(c, 640, 235, `R₂ = ${p.R2} Ом`);
            text(c, `${formatValue(I * p.R)} В`, 455, 298, 16, MUTED, 'center');
            text(c, `${formatValue(I * p.R2)} В`, 640, 298, 16, MUTED, 'center');
        }
        else if (id === 'capacitor') {
            resistor(c, 465, 235, `R = ${p.R} Ом`);
            rect(c, 604, 200, 38, 70, PAPER, null);
            line(c, 612, 204, 612, 266, INK, 3);
            line(c, 634, 204, 634, 266, INK, 3);
            for (let i = 0; i < Math.round(capFraction * 7); i++) {
                text(c, '+', 597, 207 + i * 9, 12, INK, 'center');
                text(c, '−', 649, 207 + i * 9, 12, INK, 'center');
            }
            text(c, `${p.C} мФ`, 622, 175, 18, INK, 'center');
            text(c, `q(t) = ${formatValue(p.C * p.U * capFraction)} мКл`, 520, 380, 30, INK, 'center', true);
            text(c, `τ = RC = ${formatValue(p.R * p.C * 1e-3)} с`, 520, 420, 16, MUTED, 'center');
        }
        else if (id === 'power') {
            const power = closed ? p.U * p.I : 0;
            for (let j = 1; j < 5; j++)
                circle(c, 550, 235, 30 + j * 10, `rgba(40,40,40,${power / 120 * .018})`, null);
            circle(c, 550, 235, 29, PAPER, INK, 1.5);
            line(c, 530, 215, 570, 255);
            line(c, 530, 255, 570, 215);
            text(c, `${formatValue(power)} Вт`, 520, 385, 46, INK, 'center', true);
            text(c, 'мощность нагрузки', 520, 420, 16, MUTED, 'center');
        }
        else {
            resistor(c, 550, 235, `R = ${p.R} Ом`);
            if (id === 'joule') {
                const Q = p.I ** 2 * p.R * Math.min(age, p.t), max = p.I ** 2 * p.R * p.t;
                rect(c, 390, 345, 320, 12, null, FAINT);
                rect(c, 391, 346, 318 * (max ? Q / max : 0), 10, INK, null);
                text(c, `Q(t) = ${formatValue(Q)} Дж`, 550, 413, 32, INK, 'center', true);
                text(c, `нагрев: ${Math.min(age, p.t).toFixed(1)} / ${p.t} с`, 550, 447, 16, MUTED, 'center');
            }
            else {
                text(c, `${formatValue(I)} А`, 515, 378, 52, INK, 'center', true);
                text(c, 'сила тока', 515, 417, 16, MUTED, 'center');
            }
        }
    }
    rect(c, 225, 354, 40, 64, PAPER, null);
    line(c, 218, 376, 272, 376, INK, 2);
    line(c, 230, 393, 260, 393, INK, 4);
    text(c, '+', 204, 372, 18, MUTED);
    text(c, `${formatValue(U)} В`, 180, 431, 20, INK, 'center', true);
    // Switch is also available as a semantic HTML button above the canvas.
    rect(c, 290, 212, 67, 32, PAPER, null);
    circle(c, 300, 235, 3, PAPER, INK);
    circle(c, 346, 235, 3, PAPER, INK);
    line(c, 300, 235, 346, closed ? 235 : 212, INK, 2);
    text(c, closed ? 'ключ замкнут' : 'цепь разомкнута', 320, 185, 14, MUTED, 'center');
    text(c, `I = ${formatValue(I)} А`, 500, 580, 19, INK, 'center');
    text(c, 'Маркеры показывают условное направление тока', 500, 617, 14, MUTED, 'center');
};
export const circuitEffects: Record<string, EffectRenderer> = Object.fromEntries(['ohm', 'series', 'parallel', 'joule', 'capacitor', 'power'].map(id => [id, circuit]));
