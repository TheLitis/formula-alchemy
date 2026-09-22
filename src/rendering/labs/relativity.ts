import { calculate, formatValue, gamma } from '../../core/evaluate';
import { arrow, circle, FAINT, INK, line, MUTED, PAPER, polyline, rect, text, triangle } from '../primitives';
import type { EffectRenderer } from '../primitives';
function clock(c: CanvasRenderingContext2D, x: number, y: number, time: number, label: string) {
    line(c, x - 60, y - 90, x + 60, y - 90, INK, 3);
    line(c, x - 60, y + 90, x + 60, y + 90, INK, 3);
    line(c, x, y - 87, x, y + 87, FAINT, 1, [3, 5]);
    const py = y - 85 + triangle(time / 2) * 170;
    circle(c, x, py, 7, INK, null);
    text(c, label, x, y + 134, 17, MUTED, 'center');
    text(c, `${time.toFixed(2)} с`, x, y + 173, 31, INK, 'center', true);
}
const dilation: EffectRenderer = ({ c, node, age }) => {
    const g = gamma(node.params.beta);
    clock(c, 300, 320, age, 'лабораторные часы');
    clock(c, 700, 320, age / g, 'движущиеся часы');
    arrow(c, 620, 159, 780, 159);
    text(c, `v = ${node.params.beta}c`, 700, 128, 19, INK, 'center', true);
    text(c, `Δt = ${formatValue(calculate('timeDilation', node.params).value)} с`, 500, 589, 27, INK, 'center', true);
    text(c, 'Темп часов сравнивается в лабораторной системе отсчёта', 500, 631, 16, MUTED, 'center');
};
const lorentzFactor: EffectRenderer = ({ c, node, age }) => {
    const beta = node.params.beta, g = gamma(beta);
    arrow(c, 160, 495, 830, 495, MUTED);
    arrow(c, 160, 495, 160, 165, MUTED);
    const points = Array.from({ length: 199 }, (_, i) => { const b = i / 200; return { x: 160 + b * 640, y: 495 - (gamma(b) - 1) * 42 }; });
    polyline(c, points, INK, 1.8);
    const x = 160 + beta * 640, y = 495 - (g - 1) * 42;
    line(c, x, 495, x, y, FAINT, 1, [4, 5]);
    line(c, 160, y, x, y, FAINT, 1, [4, 5]);
    circle(c, x, y, 6, PAPER, INK, 2);
    for (let i = 0; i <= 4; i++) {
        const b = i * .25;
        text(c, String(b).replace('.', ','), 160 + b * 640, 522, 14, MUTED, 'center');
    }
    text(c, 'v / c', 860, 501, 18, MUTED, 'left', true);
    text(c, 'γ', 137, 166, 24, INK, 'left', true);
    text(c, '1', 139, 500, 15, MUTED);
    text(c, `γ = ${formatValue(g)}`, 500, 577, 37, INK, 'center', true);
    text(c, `Лаборатория: ${age.toFixed(1)} с   ·   Свои часы: ${(age / g).toFixed(1)} с`, 500, 625, 18, MUTED, 'center');
};
const length: EffectRenderer = ({ c, node, age }) => {
    const p = node.params, base = p.L * 56, contracted = calculate('lengthContraction', p).value * 56, start = 190;
    rect(c, start, 250, base, 43, '#cfcfcf', INK);
    text(c, 'собственная длина L₀', start, 224, 19, MUTED);
    const offset = p.beta === 0 ? 0 : ((age * 40 * p.beta) % (1000 + contracted)) - contracted;
    rect(c, Math.max(150, offset), 405, contracted, 43, PAPER, INK);
    for (let i = 0; i <= 10; i++) {
        const x = start + i * 56;
        line(c, x, 330, x, 342, FAINT);
        text(c, String(i), x, 363, 13, MUTED, 'center');
    }
    line(c, start, 331, start + base, 331, FAINT);
    text(c, `L = ${formatValue(calculate('lengthContraction', p).value)} м`, 500, 563, 37, INK, 'center', true);
    text(c, `v = ${p.beta}c · поперечный размер не меняется`, 500, 614, 17, MUTED, 'center');
};
const massEnergy: EffectRenderer = ({ c, node, age }) => {
    const value = calculate('massEnergy', node.params).value;
    for (let i = 0; i < 5; i++) {
        const radius = 30 + (age * 30 + i * 54) % 245;
        c.save();
        c.globalAlpha = (1 - (radius - 30) / 245) * .4;
        circle(c, 500, 330, radius, null, MUTED);
        c.restore();
    }
    circle(c, 500, 330, 28, PAPER, INK, 1.5);
    text(c, 'm', 500, 340, 31, INK, 'center', true);
    text(c, `${node.params.m} г`, 500, 252, 24, INK, 'center', true);
    const log = Math.log10(value);
    line(c, 210, 536, 790, 536, FAINT, 2);
    for (let i = 10; i <= 15; i++) {
        const x = 210 + (i - 10) * 116;
        line(c, x, 529, x, 543, FAINT);
        text(c, `10${['¹⁰', '¹¹', '¹²', '¹³', '¹⁴', '¹⁵'][i - 10]}`, x, 566, 14, MUTED, 'center');
    }
    circle(c, 210 + (log - 10) * 116, 536, 5, INK, null);
    text(c, `E₀ = ${formatValue(value)} Дж`, 500, 623, 27, INK, 'center', true);
};
export const relativityEffects: Record<string, EffectRenderer> = { gamma: lorentzFactor, timeDilation: dilation, lengthContraction: length, massEnergy };
