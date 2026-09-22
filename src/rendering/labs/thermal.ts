import { calculate, formatValue } from '../../core/evaluate';
import { arrow, circle, FAINT, gauge, INK, line, MUTED, PAPER, random, rect, text, triangle } from '../primitives';
import type { DrawContext, EffectRenderer } from '../primitives';
function particles(d: DrawContext, x: number, y: number, w: number, h: number, T: number, count: number) {
    const speed = Math.sqrt(T / 300) * .1;
    for (let i = 0; i < count; i++) {
        const px = x + 8 + triangle(random(i * 4) * 10 + d.age * speed * (.4 + random(i * 4 + 1))) * (w - 16);
        const py = y + 8 + triangle(random(i * 4 + 2) * 10 + d.age * speed * (.4 + random(i * 4 + 3))) * (h - 16);
        circle(d.c, px, py, 2.6, i % 4 === 0 ? INK : '#a3a3a3', null);
    }
}
const heat: EffectRenderer = (d) => {
    const { c, node, age } = d, p = node.params, fraction = Math.min(1, age / 6), T = 293 + p.dT * fraction;
    rect(c, 280, 175, 360, 345, '#ebebeb', null);
    line(c, 280, 160, 280, 520, INK, 2);
    line(c, 280, 520, 640, 520, INK, 2);
    line(c, 640, 520, 640, 160, INK, 2);
    particles(d, 280, 175, 360, 345, T, 65);
    line(c, 295, 185, 625, 185, '#bdbdbd', 1);
    for (let i = 0; i < 9; i++)
        line(c, 380 + i * 20, 550, 390 + i * 20, 535, age < 6 && p.dT > 0 ? INK : FAINT, 1.5);
    arrow(c, 460, 587, 460, 538, INK, 2);
    text(c, 'Q', 487, 573, 24, INK, 'left', true);
    rect(c, 727, 195, 14, 300, null, FAINT);
    rect(c, 730, 490 - (T - 273) / 150 * 290, 8, (T - 273) / 150 * 290, INK, null);
    circle(c, 734, 510, 17, INK, null);
    text(c, `${T.toFixed(0)} К`, 734, 160, 30, INK, 'center', true);
    text(c, `${(T - 273.15).toFixed(1)} °C`, 734, 566, 15, MUTED, 'center');
    text(c, `${formatValue(calculate('heat', p).value * fraction)} Дж передано`, 460, 625, 15, MUTED, 'center');
};
const melting: EffectRenderer = (d) => {
    const { c, node, age } = d, Q = calculate('melting', node.params).value, fraction = Q === 0 ? 1 : Math.min(1, 50000 * age / Q);
    rect(c, 280, 190, 390, 330, '#eaeaea', null);
    line(c, 280, 175, 280, 520, INK, 2);
    line(c, 280, 520, 670, 520, INK, 2);
    line(c, 670, 520, 670, 175, INK, 2);
    const side = 190 * Math.sqrt(1 - fraction);
    rect(c, 475 - side / 2, 405 - side / 2, side, side, PAPER, INK);
    for (let i = 0; i < 8; i++)
        for (let j = 0; j < 8; j++)
            if (i / 8 < 1 - fraction)
                circle(c, 400 + j * 21, 330 + i * 20, 2, '#8f8f8f', null);
    particles(d, 285, 195, 380, 150, 273, 30);
    text(c, '273 К', 760, 260, 34, INK, 'center', true);
    text(c, 'Фазовый переход', 760, 294, 15, MUTED, 'center');
    text(c, `${(fraction * 100).toFixed(0)} %`, 475, 580, 40, INK, 'center', true);
    text(c, 'расплавлено · P = 50 кВт', 475, 610, 15, MUTED, 'center');
};
const idealGas: EffectRenderer = (d) => {
    const { c, node } = d, p = node.params, top = 490 - (p.V - 5) / 45 * 260, pressure = calculate('idealGas', p).value;
    rect(c, 300, top, 340, 520 - top, '#eaeaea', null);
    particles(d, 300, top + 7, 340, 510 - top, p.T, Math.round(22 + p.nu * 22));
    line(c, 300, 160, 300, 520, INK, 2);
    line(c, 300, 520, 640, 520, INK, 2);
    line(c, 640, 520, 640, 160, INK, 2);
    rect(c, 288, top - 12, 364, 18, '#d4d4d4', INK);
    rect(c, 457, 135, 26, Math.max(12, top - 148), PAPER, INK);
    for (let i = 0; i < 3; i++)
        line(c, 448 + i * 12, top - 6, 453 + i * 12, top - 6, INK, 2);
    arrow(c, 685, top + 10, 685, 515, MUTED);
    text(c, `${p.V} л`, 713, (top + 520) / 2, 20, INK, 'left', true);
    gauge(c, 788, 240, pressure, 1500, `${formatValue(pressure)} кПа`);
    text(c, 'Потяните поршень', 470, 590, 16, MUTED, 'center');
    text(c, `${p.T} К   ·   ${p.nu} моль`, 470, 620, 15, MUTED, 'center');
};
const firstLaw: EffectRenderer = (d) => {
    const { c, node, age } = d, p = node.params, progress = Math.min(1, age / 5), du = p.Q - p.W;
    rect(c, 378, 220, 230, 290, null, INK);
    rect(c, 385, 503 - (50 + du * progress) * 2.5, 216, (50 + du * progress) * 2.5, '#cacaca', null);
    for (let i = 0; i < 7; i++)
        line(c, 390, 265 + i * 33, 599, 265 + i * 33, FAINT);
    text(c, 'U', 493, 182, 38, INK, 'center', true);
    text(c, `${formatValue(50 + du * progress)} кДж`, 493, 552, 22, INK, 'center');
    if (p.Q >= 0)
        arrow(c, 160, 345, 340, 345, INK, 3);
    else
        arrow(c, 340, 345, 160, 345, INK, 3);
    text(c, `Q = ${p.Q} кДж`, 245, 310, 20, INK, 'center');
    const pistonY = 405 - p.W * progress * 2;
    rect(c, 712, 225, 125, 290, null, FAINT);
    rect(c, 705, pistonY, 139, 15, '#b5b5b5', INK);
    line(c, 775, 145, 775, pistonY, INK, 6);
    if (p.W >= 0)
        arrow(c, 631, 345, 690, 345, INK, 3);
    else
        arrow(c, 690, 345, 631, 345, INK, 3);
    text(c, `A = ${p.W} кДж`, 776, 550, 20, INK, 'center');
    text(c, `ΔU = ${formatValue(du)} кДж`, 493, 615, 24, INK, 'center', true);
};
export const thermalEffects: Record<string, EffectRenderer> = { heat, melting, idealGas, firstLaw };
