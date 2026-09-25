import { calculate, formatValue, G } from '../../core/evaluate';
import { HEIGHT, PX_PER_M } from '../../core/types';
import { blackHoleGeometry } from '../../physics/geometry';
import { arrow, circle, FAINT, INK, line, MUTED, PAPER, rect, spring, text } from '../primitives';
import type { EffectRenderer } from '../primitives';

const physical: EffectRenderer = ({ c, node, age, world, state }) => {
  const p = node.params, id = node.recipeId!, body = world.bodies.get(`${node.id}/0`)?.body;
  if (id === 'hooke' && body) {
    line(c, 220, 355, 220, 445, INK, 3);
    spring(c, 220, 400, body.position.x - 18, 400, 18);
    line(c, 500, 365, 500, 460, FAINT, 1, [3, 5]);
    text(c, 'x = 0', 500, 485, 16, MUTED, 'center');
  }
  if (id === 'potential') {
    line(c, 872, HEIGHT - 58, 872, HEIGHT - 58 - p.h * 32, MUTED, 1, [3, 5]);
    line(c, 858, HEIGHT - 58, 885, HEIGHT - 58, MUTED);
    line(c, 858, HEIGHT - 58 - p.h * 32, 885, HEIGHT - 58 - p.h * 32, MUTED);
    text(c, `h = ${p.h} м`, 898, HEIGHT - 60 - p.h * 16, 16, MUTED, 'center');
  }
  if (id === 'work') {
    const end = 130 + p.d * 32;
    line(c, 130, 300, end, 300, MUTED, 1, [4, 4]);
    line(c, 130, 290, 130, 310, MUTED);
    line(c, end, 290, end, 310, MUTED);
    text(c, `s = ${p.d} м`, (130 + end) / 2, 327, 18, MUTED, 'center');
  }
  if (id === 'friction') {
    line(c, 80, HEIGHT - 40, 920, HEIGHT - 40, INK, 2);
    for (let x = 80; x < 920; x += 16) line(c, x, HEIGHT - 38, x - 8, HEIGHT - 29, FAINT);
  }
  if (!body) return;

  const speed = body.speed * 60 / PX_PER_M;
  if (id === 'impulse') text(c, age < p.t ? `Сила действует: ${age.toFixed(1)} / ${p.t} с` : 'Сила отключена. Движение по инерции.', 500, 575, 18, MUTED, 'center');
  else if (id === 'kinetic') text(c, `Текущая Eк = ${formatValue(.5 * body.mass * speed * speed)} Дж`, 190, 570, 18, INK, 'left', true);
  else if (id === 'momentum') {
    const b2 = world.bodies.get(`${node.id}/1`)?.body;
    text(c, `Σpₓ = ${formatValue((body.mass * body.velocity.x + (b2?.mass ?? 0) * (b2?.velocity.x ?? 0)) * 60 / PX_PER_M)} кг·м/с`, 180, 570, 18, INK, 'left', true);
  } else if (id === 'friction') text(c, speed < .015 ? 'Тело остановилось' : `v = ${formatValue(speed)} м/с`, 160, 525, 21, INK, 'left', true);
  else text(c, `v = ${formatValue(speed)} м/с`, 135, 560, 18, INK, 'left', true);

  if (state.vectors) {
    const b = body.position;
    if (id === 'weight' || id === 'potential') arrow(c, b.x + 27, b.y, b.x + 27, b.y + Math.min(100, p.g * 5), INK);
    if (id === 'newton') arrow(c, b.x + 27, b.y, b.x + 27 + p.a * 10, b.y, INK);
    if (id === 'friction' && Math.abs(body.velocity.x) > .01) arrow(c, b.x, b.y - 28, b.x - Math.sign(body.velocity.x) * 60, b.y - 28, INK);
  }
};

const pressure: EffectRenderer = ({ c, node }) => {
  const p = node.params, value = calculate('pressure', p).value, width = Math.sqrt(p.S) * 150, deformation = Math.min(65, Math.log1p(value) * 10);
  rect(c, 200, 445, 610, 80, '#dbdbdb', null);
  line(c, 200, 445, 810, 445, FAINT, 1);
  rect(c, 500 - width / 2, 345 + deformation, width, 100, '#cbcbcb', INK);
  rect(c, 483, 180, 34, 164 + deformation, PAPER, INK);
  if (p.F > 0) arrow(c, 500, 134, 500, 218, INK, 2);
  text(c, `F = ${p.F} Н`, 553, 215, 23, INK, 'left', true);
  text(c, `S = ${p.S} м²`, 500, 574, 24, INK, 'center', true);
  if (p.F > 0) for (let x = 500 - width / 2 + 15; x < 500 + width / 2; x += 30) arrow(c, x, 457, x, 490 + deformation * .2, MUTED);
  text(c, 'Меньше площадь → больше давление', 500, 625, 19, MUTED, 'center');
};

const fluid: EffectRenderer = ({ c, node, age }) => {
  const p = node.params, rho = node.recipeId === 'density' ? 1000 : p.rho, m = p.m, V = p.V * 1e-3, g = p.g ?? 9.8, density = m / V, side = Math.cbrt(p.V / 3) * 84;
  rect(c, 270, 270, 460, 280, '#e5e5e5', null);
  line(c, 270, 250, 270, 550, INK, 2);
  line(c, 270, 550, 730, 550, INK, 2);
  line(c, 730, 550, 730, 250, INK, 2);
  for (let x = 270; x <= 730; x += 10) line(c, x, 270 + Math.sin(x * .05 + age * 1.8) * 2, x + 10, 270 + Math.sin((x + 10) * .05 + age * 1.8) * 2, '#c2c2c2');

  const target = density < rho ? 270 + side * (density / rho - .5) : 550 - side / 2;
  const settle = 1 - Math.exp(-age * 1.4);
  const wobble = Math.sin(age * 2.8) * 12 * Math.exp(-age * 0.7);
  const y = 365 + (target - 365) * settle + wobble;
  rect(c, 500 - side / 2, y - side / 2, side, side, PAPER, INK);
  text(c, 'm', 500, y + 8, 29, INK, 'center', true);

  const immersion = Math.min(1, Math.max(0, (y + side / 2 - 270) / side));
  const fa = rho * g * V * immersion;
  if (g > 0) {
    arrow(c, 500 - side / 2 - 25, y, 500 - side / 2 - 25, y + 70, INK, 1.5);
    arrow(c, 500 + side / 2 + 25, y, 500 + side / 2 + 25, y - Math.min(100, fa * 2), INK, 1.5);
  }

  const regime = density < rho ? 'всплывает / плавает' : density > rho ? 'тонет' : 'нейтральная плавучесть';
  text(c, `ρт = ${formatValue(density)} кг/м³`, 500, 595, 23, INK, 'center', true);
  text(c, `FА ≈ ${formatValue(fa)} Н  ·  mg = ${formatValue(m * g)} Н  ·  ${regime}`, 500, 633, 17, MUTED, 'center');
};

const gravitation: EffectRenderer = ({ c, node, age }) => {
  const p = node.params, r = p.r * 1e6, omega = Math.sqrt(G * p.M * 1e24 / r ** 3), a = omega * age * 200, radius = p.r * 17;
  circle(c, 500, 365, radius, null, '#b7b7b7');
  circle(c, 500, 365, 31, '#d7d7d7', INK, 1.5);
  text(c, 'M', 500, 375, 30, INK, 'center', true);
  const x = 500 + Math.cos(a) * radius, y = 365 + Math.sin(a) * radius;
  circle(c, x, y, 10, PAPER, INK, 1.5);
  line(c, 500, 365, x, y, FAINT, 1, [4, 5]);
  arrow(c, x, y, x - (x - 500) * .32, y - (y - 365) * .32, INK);
  text(c, `r = ${p.r} × 10⁶ м`, 500, 608, 22, INK, 'center', true);
  text(c, `Tорб = ${formatValue(2 * Math.PI / omega / 60)} мин  ·  время ×200`, 500, 643, 16, MUTED, 'center');
};

const blackhole: EffectRenderer = ({ c, node, world }) => {
  const h = blackHoleGeometry(node);
  line(c, h.x + h.radius + 10, h.y - 8, h.x + h.radius + 100, h.y - 70, MUTED, 1, [3, 5]);
  text(c, 'горизонт событий', h.x + h.radius + 100, h.y - 80, 16, MUTED, 'center');
  text(c, `rs = ${formatValue(calculate('blackhole', node.params).value)} км`, 500, 588, 26, INK, 'center', true);
  text(c, `Поглощено тел: ${world.absorbed.size}  ·  перетаскивайте дыру прямо мышью`, 500, 631, 16, MUTED, 'center');
};

export const mechanicsEffects: Record<string, EffectRenderer> = {
  weight: physical,
  newton: physical,
  kinetic: physical,
  momentum: physical,
  potential: physical,
  impulse: physical,
  work: physical,
  hooke: physical,
  friction: physical,
  pressure,
  density: fluid,
  buoyancy: fluid,
  gravitation,
  blackhole,
};
