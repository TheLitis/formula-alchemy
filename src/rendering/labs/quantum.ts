import { calculate, formatValue } from '../../core/evaluate';
import { arrow, circle, FAINT, INK, line, MUTED, PAPER, polyline, random, rect, text } from '../primitives';
import type { EffectRenderer } from '../primitives';
const photon: EffectRenderer = ({ c, node, age }) => {
    const p = node.params, id = node.recipeId!, energy = calculate('photon', p).value, photo = id === 'photoelectric', kinetic = photo ? calculate(id, p).value : 0;
    const end = photo ? 600 : 890;
    for (let packet = 0; packet < 3; packet++) {
        const center = 130 + ((age * 90 + packet * 230) % (end - 130));
        const pts = Array.from({ length: 120 }, (_, i) => { const x = center - 60 + i; return { x, y: 330 + Math.sin((i + p.f * age * 12) * p.f * .15) * 32 * Math.exp(-(((i - 60) / 28) ** 2)) }; }).filter(pt => pt.x < end && pt.x > 115);
        polyline(c, pts, packet % 2 ? MUTED : INK, 1.4);
    }
    arrow(c, 200, 220, 400, 220);
    text(c, `hf = ${formatValue(energy)} эВ`, 360, 182, 26, INK, 'center', true);
    if (photo) {
        rect(c, 600, 240, 45, 230, '#c7c7c7', INK);
        for (let y = 240; y < 470; y += 16)
            line(c, 603, y, 642, y + 24, MUTED, .6);
        text(c, 'металл', 624, 505, 17, MUTED, 'center');
        text(c, `Aвых = ${p.W0} эВ`, 625, 555, 19, INK, 'center', true);
        if (kinetic > 0) {
            for (let i = 0; i < 5; i++) {
                const dt = (age + i * .45) % 2;
                const ex = 650 + dt * 40 * Math.sqrt(kinetic), ey = 330 + (i - 2) * dt * 14;
                if (ex < 890) {
                    circle(c, ex, ey, 4, INK, null);
                    line(c, ex - 12, ey, ex - 4, ey, MUTED, .7);
                }
            }
            text(c, `Eк,max = ${formatValue(kinetic)} эВ`, 500, 620, 24, INK, 'center', true);
        }
        else
            text(c, 'Энергии фотона недостаточно — эмиссии нет', 500, 620, 20, INK, 'center');
    }
    else {
        const fraction = Math.min(1, energy / 8.3);
        rect(c, 230, 470, 540, 10, null, FAINT);
        rect(c, 230, 470, 540 * fraction, 10, INK, null);
        text(c, '0', 230, 510, 16, MUTED);
        text(c, '8,3 эВ', 770, 510, 16, MUTED, 'right');
        text(c, `E = ${formatValue(energy)} эВ`, 500, 594, 38, INK, 'center', true);
    }
};
const bohr: EffectRenderer = ({ c, node }) => {
    const p = node.params;
    for (let n = 1; n <= 5; n++) {
        circle(c, 370, 340, 35 + n * 27, null, n === p.n ? INK : FAINT, n === p.n ? 2 : 1);
        if (n === p.n) {
            circle(c, 370 + 35 + n * 27, 340, 5, INK, null);
            text(c, `n = ${n}`, 370, 340 - (35 + n * 27) - 15, 18, INK, 'center', true);
        }
    }
    circle(c, 370, 340, 17, '#bbbbbb', INK);
    text(c, `+${p.Z}`, 370, 346, 16, INK, 'center');
    arrow(c, 665, 550, 665, 178, MUTED);
    text(c, 'E, эВ', 665, 155, 20, INK, 'center', true);
    line(c, 688, 199, 872, 199, MUTED, 1, [3, 4]);
    text(c, '0', 889, 204, 16, MUTED);
    for (let n = 1; n <= 5; n++) {
        const y = 199 + 285 / n ** 2;
        line(c, 690, y, 864, y, n === p.n ? INK : FAINT, n === p.n ? 3 : 1);
        if (n === p.n || n < 3)
            text(c, `n=${n}  ${formatValue(-13.6 * p.Z ** 2 / n ** 2)}`, 695, y + (n === 1 ? 25 : -9), 14, n === p.n ? INK : MUTED);
    }
    text(c, `Eₙ = ${formatValue(calculate('bohr', p).value)} эВ`, 500, 623, 28, INK, 'center', true);
};
export function lifetime(index: number, half: number): number { return -Math.log(Math.max(1e-8, random(index + 997))) * half / Math.LN2; }
const decay: EffectRenderer = ({ c, node, age }) => {
    const p = node.params, count = p.N0;
    let living = 0;
    for (let i = 0; i < count; i++) {
        const x = 160 + (i % 16) * 43, y = 190 + Math.floor(i / 16) * 29, death = lifetime(i, p.half), alive = age < death;
        if (alive)
            living++;
        circle(c, x, y, 7, alive ? INK : '#dcdcdc', null);
        if (!alive && age - death < .4) {
            const r = (age - death) * 55;
            c.save();
            c.globalAlpha = 1 - (age - death) / .4;
            circle(c, x, y, 7 + r, null, MUTED);
            c.restore();
        }
    }
    text(c, `${living}`, 265, 565, 52, INK, 'center', true);
    text(c, 'живых в выборке', 265, 597, 16, MUTED, 'center');
    text(c, `${formatValue(calculate('decay', p, age).value)}`, 655, 565, 52, INK, 'center', true);
    text(c, 'ожидаемое число', 655, 597, 16, MUTED, 'center');
    text(c, `t = ${age.toFixed(1)} с   ·   t / T½ = ${(age / p.half).toFixed(2)}`, 500, 644, 18, INK, 'center', true);
};
const binding: EffectRenderer = ({ c, node, age }) => {
    const energy = calculate('binding', node.params).value, progress = Math.min(1, age / 4), tight = 1 - Math.min(1, node.params.dm / .3) * .3;
    for (let i = 0; i < 16; i++) {
        const a = i * 2.39996, r = Math.sqrt(i) * 19 * tight, x = 490 + Math.cos(a) * r, y = 340 + Math.sin(a) * r;
        const sx = 160 + random(i) * 680, sy = 190 + random(i + 70) * 310;
        circle(c, sx + (x - sx) * progress, sy + (y - sy) * progress, 13, i % 2 === 0 ? '#b3b3b3' : PAPER, INK);
        if (i % 2 === 0)
            text(c, '+', sx + (x - sx) * progress, sy + (y - sy) * progress + 5, 15, INK, 'center');
    }
    text(c, 'свободные нуклоны → связанное ядро', 500, 535, 20, MUTED, 'center');
    text(c, `Eсв = ${formatValue(energy)} МэВ`, 500, 595, 34, INK, 'center', true);
    text(c, 'Состав ядра условный; энергия определяется заданным Δm', 500, 632, 15, MUTED, 'center');
};
export const quantumEffects: Record<string, EffectRenderer> = { photon, photoelectric: photon, bohr, decay, binding };
