import { HEIGHT, WIDTH } from '../core/types';
import type { GameState, Viewport } from '../core/types';
import type { SimulationRuntime } from '../physics/Runtime';
import { blackHoleGeometry } from '../physics/geometry';
import { EFFECTS } from './effects';
import { arrow, circle, FAINT, INK, line, MUTED, PAPER, polyline, setLabelScale, text } from './primitives';

export function getViewport(width: number, height: number): Viewport {
  const scale = Math.min(width / WIDTH, height / HEIGHT);
  return { width, height, scale, ox: (width - WIDTH * scale) / 2, oy: (height - HEIGHT * scale) / 2 };
}

export function toWorld(v: Viewport, x: number, y: number) {
  return { x: (x - v.ox) / v.scale, y: (y - v.oy) / v.scale };
}

export class CanvasRenderer {
  canvas: HTMLCanvasElement;
  c: CanvasRenderingContext2D;
  viewport: Viewport = getViewport(1000, 680);

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const c = canvas.getContext('2d', { alpha: false });
    if (!c) throw new Error('Canvas 2D недоступен в этом браузере.');
    this.c = c;
  }

  resize(width: number, height: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.viewport = getViewport(width, height);
  }

  render(state: GameState, runtime: SimulationRuntime) {
    const { c, canvas, viewport: v } = this;
    setLabelScale(v.width < 600 ? 1.6 : 1);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = PAPER;
    c.fillRect(0, 0, canvas.width, canvas.height);

    const sx = canvas.width / v.width, sy = canvas.height / v.height;
    c.setTransform(sx * v.scale, 0, 0, sy * v.scale, sx * v.ox, sy * v.oy);
    c.save();
    c.beginPath();
    c.rect(0, 0, WIDTH, HEIGHT);
    c.clip();

    const holes = state.lab === 'sandbox' ? state.nodes.filter(n => n.recipeId === 'blackhole').map(blackHoleGeometry) : [];
    const warp = (x: number, y: number) => {
      let wx = x, wy = y;
      for (const h of holes) {
        const dx = x - h.x, dy = y - h.y, dist = Math.hypot(dx, dy), f = h.radius * h.radius * 1.9 / (dist * dist + h.radius * h.radius * 2.6);
        wx -= dx * f;
        wy -= dy * f;
      }
      return { x: wx, y: wy };
    };

    if (holes.length) {
      c.save();
      for (const h of holes) {
        const gradient = c.createRadialGradient(h.x, h.y, h.radius * 0.8, h.x, h.y, h.radius * 7);
        gradient.addColorStop(0, 'rgba(0,0,0,0.05)');
        gradient.addColorStop(0.35, 'rgba(0,0,0,0.04)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = gradient;
        c.fillRect(h.x - h.radius * 7, h.y - h.radius * 7, h.radius * 14, h.radius * 14);
      }
      c.restore();
    }

    if (state.grid) {
      for (let x = 20; x < WIDTH; x += 40) {
        const pts = [];
        for (let y = 0; y <= HEIGHT; y += 10) pts.push(warp(x, y));
        polyline(c, pts, '#e0e0e0', .65);
      }
      for (let y = 20; y < HEIGHT; y += 40) {
        const pts = [];
        for (let x = 0; x <= WIDTH; x += 10) pts.push(warp(x, y));
        polyline(c, pts, '#e0e0e0', .65);
      }
    }

    if (state.lab === 'sandbox') {
      for (const h of holes) {
        const t = runtime.time;
        for (let i = 0; i < 36; i++) {
          const a = i / 36 * Math.PI * 2 + t * 0.14;
          c.save();
          c.translate(h.x, h.y);
          c.rotate(-0.26 + Math.sin(t * 0.25) * 0.03);
          c.beginPath();
          c.ellipse(0, 0, h.radius * 1.65 + i * 0.58, h.radius * 0.34 + i * 0.17, 0, a, a + 1.9);
          c.strokeStyle = `rgba(32,32,32,${0.035 + (36 - i) / 165})`;
          c.lineWidth = 0.6 + i * 0.01;
          c.stroke();
          c.restore();
        }
        c.save();
        c.translate(h.x, h.y);
        c.rotate(t * 0.28);
        c.beginPath();
        c.ellipse(0, 0, h.radius * 2.2, h.radius * 0.72, 0, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(0,0,0,0.12)';
        c.lineWidth = 1.2;
        c.stroke();
        c.restore();
        circle(c, h.x, h.y, h.radius + 7, null, '#b8b8b8', 1.2);
        circle(c, h.x, h.y, h.radius + 2, null, '#858585', 0.8);
        circle(c, h.x, h.y, h.radius, INK, null);
        circle(c, h.x, h.y, h.radius * 0.9, '#101010', null);
      }

      for (const item of runtime.world.bodies.values()) {
        const { body: b, radius } = item;
        if (state.trails) polyline(c, item.trail, '#b7b7b7', .8);
        circle(c, b.position.x, b.position.y, radius, PAPER, INK, 1.3);
        if (item.label) text(c, item.label, b.position.x, b.position.y + 6, radius > 12 ? 19 : 10, INK, 'center', true);
        if (state.vectors && b.speed > .1 && radius > 9) arrow(c, b.position.x, b.position.y, b.position.x + b.velocity.x * 13, b.position.y + b.velocity.y * 13, MUTED, 1);
      }

      line(c, 35, HEIGHT - 40, WIDTH - 35, HEIGHT - 40, FAINT, 1);
      text(c, '0 м', 45, HEIGHT - 18, 12, MUTED);
    }

    const node = state.nodes.find(n => n.id === state.activeId);
    if (node?.recipeId) {
      const effect = EFFECTS[node.recipeId];
      if (!effect) throw new Error(`Нет эффекта ${node.recipeId}`);
      effect({ c, node, age: runtime.ages.get(node.id) ?? 0, time: runtime.time, state, world: runtime.world });
    }

    c.restore();
  }
}
