import { inductionMotion } from '../../physics/interactiveModels';
import { calculate, formatValue, radians } from '../../core/evaluate';
import { arrow, circle, FAINT, INK, line, MUTED, PAPER, polyline, rect, text } from '../primitives';
import type { EffectRenderer } from '../primitives';
const coulomb: EffectRenderer = ({ c, node }) => {
    const p = node.params, dist = 50 + p.r * 45, x1 = 500 - dist / 2, x2 = 500 + dist / 2, y = 340;
    for (let x = 150; x <= 850; x += 46)
        for (let gy = 170; gy < 555; gy += 44) {
            if (Math.hypot(x - x1, gy - y) < 45 || Math.hypot(x - x2, gy - y) < 45)
                continue;
            let fx = 0, fy = 0;
            for (const [sx, q] of [[x1, p.q], [x2, p.q2]]) {
                const dx = x - sx, dy = gy - y, r = Math.max(30, Math.hypot(dx, dy));
                fx += q * dx / r ** 3;
                fy += q * dy / r ** 3;
            }
            const m = Math.hypot(fx, fy);
            if (m > 1e-10)
                arrow(c, x, gy, x + fx / m * 19, gy + fy / m * 19, '#aeaeae', .8);
        }
    for (const [x, q, label] of [[x1, p.q, 'q₁'], [x2, p.q2, 'q₂']] as const) {
        circle(c, x, y, 25, PAPER, INK, 1.5);
        text(c, q > 0 ? '+' : q < 0 ? '−' : '0', x, y + 8, 27, INK, 'center');
        text(c, `${label} = ${q} мкКл`, x, y + 65, 17, INK, 'center');
    }
    const F = calculate('coulomb', p).value, dir = Math.sign(F);
    if (F !== 0) {
        arrow(c, x1 - dir * 28, y, x1 - dir * 105, y, INK, 2);
        arrow(c, x2 + dir * 28, y, x2 + dir * 105, y, INK, 2);
    }
    line(c, x1, 465, x2, 465, MUTED, 1, [4, 5]);
    text(c, `r = ${p.r} м`, 500, 492, 18, INK, 'center', true);
    text(c, F > 0 ? 'Отталкивание' : F < 0 ? 'Притяжение' : 'Взаимодействия нет', 500, 585, 28, INK, 'center', true);
};
const electricField: EffectRenderer = ({ c, node, age }) => {
    const p = node.params, a = p.q * p.E;
    rect(c, 210, 190, 590, 12, '#c8c8c8', INK);
    rect(c, 210, 475, 590, 12, '#c8c8c8', INK);
    for (let x = 235; x < 800; x += 60) {
        text(c, '+', x, 177, 18, MUTED, 'center');
        text(c, '−', x, 516, 18, MUTED, 'center');
        arrow(c, x, 228, x, 443, FAINT, 1);
    }
    const duration = Math.abs(a) < 1e-6 ? 8 : Math.min(8, Math.sqrt(2 * 125 / (Math.abs(a) * 25))), t = age % duration;
    const points = Array.from({ length: 65 }, (_, i) => { const ti = t * i / 64; return { x: 240 + 2 * ti * 32, y: 337 + 0.5 * a * ti * ti * 25 }; });
    polyline(c, points, MUTED, 1, [4, 4]);
    const end = points.at(-1)!;
    circle(c, end.x, end.y, 16, PAPER, INK, 1.5);
    text(c, p.q > 0 ? '+' : p.q < 0 ? '−' : '0', end.x, end.y + 5, 17, INK, 'center');
    if (a !== 0)
        arrow(c, end.x, end.y + Math.sign(a) * 21, end.x, end.y + Math.sign(a) * 72, INK, 2);
    text(c, `a = ${formatValue(a)} м/с²  ·  m = 1 кг`, 500, 580, 20, INK, 'center', true);
};
const lorentz: EffectRenderer = ({ c, node, age }) => {
    const p = node.params;
    for (let x = 180; x <= 830; x += 55)
        for (let y = 160; y <= 555; y += 55) {
            line(c, x - 3, y - 3, x + 3, y + 3, FAINT);
            line(c, x - 3, y + 3, x + 3, y - 3, FAINT);
        }
    const omega = Math.abs(p.q * p.B), realR = omega < 1e-8 ? Infinity : p.v / omega;
    if (omega < 1e-8) {
        const x = 210 + (age * p.v * 32) % 600;
        circle(c, x, 340, 13, INK, null);
        arrow(c, x + 20, 340, x + 75, 340);
        text(c, 'Прямолинейное движение', 500, 590, 24, INK, 'center', true);
        return;
    }
    const r = realR * Math.min(32, 195 / Math.max(realR, .01)), a = omega * age, dir = Math.sign(p.q);
    circle(c, 500, 350, r, null, FAINT);
    const x = 500 + r * Math.sin(a), y = 350 + dir * r * Math.cos(a);
    const trail = Array.from({ length: 70 }, (_, i) => { const at = a - i * .015; return { x: 500 + r * Math.sin(at), y: 350 + dir * r * Math.cos(at) }; });
    polyline(c, trail, MUTED, 2);
    circle(c, x, y, 13, PAPER, INK, 1.5);
    text(c, dir > 0 ? '+' : '−', x, y + 5, 17, INK, 'center');
    if (p.v > 0) {
        arrow(c, x, y, x + (500 - x) * .35, y + (350 - y) * .35);
        arrow(c, x, y, x + Math.cos(a) * 60, y - dir * Math.sin(a) * 60, MUTED);
    }
    text(c, `r = ${formatValue(realR)} м`, 500, 600, 26, INK, 'center', true);
    text(c, 'B направлено от наблюдателя · |v| постоянно', 500, 632, 15, MUTED, 'center');
};
const ampere: EffectRenderer = ({ c, node, age }) => {
    const p = node.params, angle = radians(p.alpha), length = 90 + p.L * 65, F = calculate('ampere', p).value;
    for (let x = 180; x < 870; x += 65)
        for (let y = 190; y < 550; y += 100)
            arrow(c, x, y, x, y + 64, FAINT);
    const dx = Math.sin(angle) * length / 2, dy = Math.cos(angle) * length / 2;
    line(c, 500 - dx, 335 - dy, 500 + dx, 335 + dy, INK, 7);
    arrow(c, 500 - dx, 335 - dy - 20, 500 + dx, 335 + dy - 20, INK, 1.5);
    text(c, 'I', 500 + dx + 20, 335 + dy, 24, INK, 'left', true);
    circle(c, 500, 335, 24 + Math.min(22, F * 2), PAPER, INK);
    if (F > 1e-8) { line(c, 493, 328, 507, 342, INK, 2); line(c, 493, 342, 507, 328, INK, 2); }
    if (p.I > 0) for (let i = 0; i < 5; i++) {
        const t = ((age * Math.sqrt(p.I) * .15 + i / 5) % 1);
        circle(c, 500 - dx + t * 2 * dx, 315 - dy + t * 2 * dy, 2.7, INK, null);
    }
    text(c, F > 1e-8 ? 'F направлена от наблюдателя' : 'F = 0', 500, 537, 23, INK, 'center', true);
    text(c, `α = ${p.alpha}°   ·   F = ${formatValue(F)} Н`, 500, 590, 20, MUTED, 'center');
    text(c, 'B', 843, 188, 25, INK, 'left', true);
};
const induction: EffectRenderer = ({ c, node, age, labState }) => {
    const p = node.params, motion = inductionMotion(node, age, labState), progress = (motion.x - 180) / 320, emf = motion.emf;
    for (let i = 0; i < 7; i++) {
        c.save();
        c.beginPath();
        c.ellipse(375 + i * 17, 340, 39, 100, 0, 0, Math.PI * 2);
        c.strokeStyle = i % 2 ? MUTED : INK;
        c.stroke();
        c.restore();
    }
    for (let y = 290; y <= 390; y += 50)
        if (p.Phi >= 0)
            arrow(c, 265, y, 555 + progress * 50, y, FAINT, 2);
        else
            arrow(c, 555 + progress * 50, y, 265, y, FAINT, 2);
    rect(c, motion.x - 28, 318, 56, 44, '#bfbfbf', INK);
    text(c, 'N', motion.x - 11, 346, 15, INK);
    text(c, 'S', motion.x + 18, 346, 15, INK, 'right');
    polyline(c, [{ x: 370, y: 442 }, { x: 370, y: 520 }, { x: 760, y: 520 }, { x: 760, y: 420 }], INK, 1.2);
    circle(c, 760, 340, 75, PAPER, INK);
    line(c, 760, 392, 760 + Math.sin(emf * .55) * 54, 340 - Math.cos(emf * .55) * 38, INK, 2);
    text(c, `${formatValue(emf)} В`, 760, 452, 27, INK, 'center', true);
    text(c, '0', 760, 286, 13, MUTED, 'center');
    text(c, `ΔΦ(t) = ${formatValue(motion.flux)} Вб`, 455, 590, 23, INK, 'center', true);
    text(c, Math.abs(emf) > 1e-8 ? 'Поток меняется — возникает ЭДС' : 'Поток постоянен — ЭДС равна нулю', 500, 631, 16, MUTED, 'center');
};
export const magneticEffects: Record<string, EffectRenderer> = { coulomb, electricField, lorentz, ampere, induction };
