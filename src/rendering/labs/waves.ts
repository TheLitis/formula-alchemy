import { oscillatorMotion } from '../../physics/interactiveModels';
import { calculate, formatValue } from '../../core/evaluate';
import { arrow, circle, FAINT, INK, line, MUTED, PAPER, polyline, rect, spring, text } from '../primitives';
import type { EffectRenderer } from '../primitives';
const oscillation: EffectRenderer = ({ c, node, age, labState }) => {
    const p = node.params, id = node.recipeId!, period = calculate(id, p).value, motion = oscillatorMotion(node, age, labState), extent = Math.max(.001, id === 'pendulum' ? .5236 : 4), x = motion.position / extent;
    if (id === 'pendulum') {
        const length = p.L * 52, bx = motion.x, by = motion.y;
        line(c, 435, 180, 545, 180, INK, 3);
        line(c, 490, 180, 490, 460, FAINT, 1, [4, 6]);
        line(c, 490, 180, bx, by, INK, 1.5);
        circle(c, 490, 180, 4, INK, null);
        circle(c, bx, by, 17, PAPER, INK, 1.5);
        text(c, `L = ${p.L} м`, 560, 210 + length / 2, 18, INK, 'left', true);
    }
    else {
        const bx = motion.x;
        line(c, 235, 225, 235, 405, INK, 3);
        spring(c, 235, 310, bx - 22, 310, 18);
        circle(c, bx, 310, 23, PAPER, INK, 1.5);
        text(c, 'm', bx, 318, 25, INK, 'center', true);
        line(c, 500, 210, 500, 425, FAINT, 1, [4, 5]);
        text(c, '0', 500, 450, 14, MUTED, 'center');
        arrow(c, 500, 412, bx, 412, MUTED);
    }
    arrow(c, 160, 550, 860, 550, FAINT);
    arrow(c, 160, 602, 160, 490, FAINT);
    const points = Array.from({ length: 401 }, (_, i) => ({ x: 160 + i * 1.7, y: 550 - oscillatorMotion(node, age - i * .014, labState).position / extent * 43 }));
    polyline(c, points, INK, 1.5);
    circle(c, 160, 550 - x * 43, 4, INK, null);
    text(c, 't', 872, 556, 18, MUTED, 'left', true);
    text(c, 'x', 148, 479, 18, MUTED, 'left', true);
    text(c, `T = ${formatValue(period)} с`, 500, 648, 20, INK, 'center', true);
};
const wave: EffectRenderer = ({ c, node, age }) => {
    const p = node.params, lambda = p.lambda * 60, wavenumber = 2 * Math.PI / lambda;
    line(c, 120, 355, 895, 355, FAINT, 1);
    for (let x = 130; x < 885; x += 13) {
        const y = 355 + Math.sin(wavenumber * (x - 130) - 2 * Math.PI * p.f * age) * 64;
        circle(c, x, y, x === 598 ? 6 : 2.8, x === 598 ? INK : '#727272', null);
    }
    const points = Array.from({ length: 381 }, (_, i) => ({ x: 130 + i * 2, y: 355 + Math.sin(wavenumber * i * 2 - 2 * Math.PI * p.f * age) * 64 }));
    polyline(c, points, MUTED, 1);
    const markX = 520, markY = 355 + Math.sin(wavenumber * (markX - 130) - 2 * Math.PI * p.f * age) * 64;
    line(c, markX, 256, markX, 465, FAINT, 1, [3, 5]);
    circle(c, markX, markY, 7, PAPER, INK, 2);
    arrow(c, 190, 208, 350, 208);
    text(c, 'направление распространения', 190, 181, 16, MUTED);
    line(c, 180, 480, 180 + lambda, 480, INK);
    line(c, 180, 471, 180, 489);
    line(c, 180 + lambda, 471, 180 + lambda, 489);
    text(c, `λ = ${p.lambda} м`, 180 + lambda / 2, 514, 23, INK, 'center', true);
    text(c, 'Отмеченная частица не перемещается вместе с волной', 500, 585, 17, MUTED, 'center');
    text(c, `v = ${formatValue(p.lambda * p.f)} м/с`, 500, 630, 25, INK, 'center', true);
};
const interference: EffectRenderer = ({ c, node, age }) => {
    const p = node.params, spacing = calculate('interference', p).value, dy = 25 + p.d * 30, y1 = 335 - dy / 2, y2 = 335 + dy / 2;
    line(c, 280, 175, 280, y1 - 7, INK, 5);
    line(c, 280, y1 + 7, 280, y2 - 7, INK, 5);
    line(c, 280, y2 + 7, 280, 535, INK, 5);
    c.save();
    c.beginPath();
    c.rect(285, 165, 470, 380);
    c.clip();
    for (const y of [y1, y2])
        for (let i = 0; i < 19; i++) {
            const r = (i * (p.lambda / 24) + age * 38) % 580;
            c.beginPath();
            c.arc(280, y, r, -Math.PI / 2, Math.PI / 2);
            c.strokeStyle = i % 2 ? '#c4c4c4' : '#d6d6d6';
            c.lineWidth = .8;
            c.stroke();
        }
    c.restore();
    for (let y = 190; y < 520; y++) {
        const intensity = (1 + Math.cos(2 * Math.PI * (y - 355) / (spacing * 45))) / 2;
        const shade = Math.round(242 - intensity * 175);
        rect(c, 778, y, 42, 1, `rgb(${shade},${shade},${shade})`, null);
    }
    rect(c, 778, 190, 42, 330, null, FAINT);
    text(c, 'две щели', 280, 582, 16, MUTED, 'center');
    text(c, 'экран', 800, 564, 16, MUTED, 'center');
    text(c, `Δx = ${formatValue(spacing)} мм`, 500, 630, 28, INK, 'center', true);
    line(c, 280, 125, 798, 125, FAINT, 1, [4, 5]);
    text(c, `L = ${p.L} м`, 535, 110, 16, MUTED, 'center');
};
export const waveEffects: Record<string, EffectRenderer> = { springPeriod: oscillation, pendulum: oscillation, wave, interference };
