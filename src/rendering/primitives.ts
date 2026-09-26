import { recordCircle, recordRect, recordLine } from './interaction';
import type { FormulaNode, GameState } from '../core/types';
import type { PhysicsWorld } from '../physics/World';
export interface DrawContext {
    labState?: import('../core/types').LabState;
    c: CanvasRenderingContext2D;
    node: FormulaNode;
    age: number;
    time: number;
    state: GameState;
    world: PhysicsWorld;
}
export type EffectRenderer = (d: DrawContext) => void;
export const INK = '#282828', MUTED = '#7a7a7a', FAINT = '#d6d6d6', PAPER = '#f3f3f3';
let labelScale = 1;
let apparatusLabels = false;
export function setApparatusLabels(enabled: boolean) { apparatusLabels = enabled; }
export function setLabelScale(scale: number) { labelScale = scale; }
export const line = (c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = INK, width = 1, dash: number[] = []) => {
    recordLine(x1, y1, x2, y2);
    c.save();
    c.strokeStyle = color;
    c.lineWidth = width;
    c.setLineDash(dash);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.restore();
};
export function text(c: CanvasRenderingContext2D, value: string, x: number, y: number, size = 16, color = INK, align: CanvasTextAlign = 'left', serif = false) { if (!apparatusLabels && (value.includes('=') || value.includes('→') || value.length > 12)) return; c.save(); c.font = `${serif ? 'italic ' : ''}${size * labelScale}px ${serif ? 'Georgia, serif' : 'Arial, sans-serif'}`; c.fillStyle = color; c.textAlign = align; c.fillText(value, x, y); c.restore(); }
export function circle(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | null = null, stroke: string | null = INK, width = 1) { if (r < 0 || !Number.isFinite(r))
    return; recordCircle(x, y, r, !!fill); c.save(); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) {
    c.fillStyle = fill;
    c.fill();
} if (stroke) {
    c.lineWidth = width;
    c.strokeStyle = stroke;
    c.stroke();
} c.restore(); }
export function rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string | null = null, stroke: string | null = INK) { recordRect(x, y, w, h); c.save(); if (fill) {
    c.fillStyle = fill;
    c.fillRect(x, y, w, h);
} if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = 1;
    c.strokeRect(x, y, w, h);
} c.restore(); }
export function arrow(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color = INK, width = 1.4) {
    line(c, x1, y1, x2, y2, color, width);
    const a = Math.atan2(y2 - y1, x2 - x1), len = 7;
    line(c, x2, y2, x2 - len * Math.cos(a - .45), y2 - len * Math.sin(a - .45), color, width);
    line(c, x2, y2, x2 - len * Math.cos(a + .45), y2 - len * Math.sin(a + .45), color, width);
}
export function polyline(c: CanvasRenderingContext2D, points: {
    x: number;
    y: number;
}[], color = INK, width = 1, dash: number[] = []) { if (points.length < 2)
    return; for (let i = 1; i < points.length; i += 2) recordLine(points[i-1].x, points[i-1].y, points[i].x, points[i].y); c.save(); c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash); c.beginPath(); points.forEach((p, i) => i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)); c.stroke(); c.restore(); }
export function spring(c: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, turns = 15) { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy), nx = -dy / Math.max(1, l), ny = dx / Math.max(1, l); const pts = [{ x: x1, y: y1 }]; for (let i = 1; i < turns * 2; i++) {
    const t = i / (turns * 2), a = i % 2 ? 9 : -9;
    pts.push({ x: x1 + dx * t + nx * a, y: y1 + dy * t + ny * a });
} pts.push({ x: x2, y: y2 }); polyline(c, pts, INK, 1.4); }
export const triangle = (t: number) => { const f = ((t % 1) + 1) % 1; return f < .5 ? f * 2 : (1 - f) * 2; };
export const random = (seed: number) => { let x = Math.imul(seed + 17, 0x45d9f3b); x = Math.imul(x ^ (x >>> 16), 0x45d9f3b); return ((x ^ (x >>> 16)) >>> 0) / 4294967296; };
export function labelPill(c: CanvasRenderingContext2D, label: string, x: number, y: number) { c.save(); c.font = '13px Arial'; const w = c.measureText(label).width + 24; c.fillStyle = PAPER; c.fillRect(x - w / 2, y - 19, w, 28); text(c, label, x, y, 13, MUTED, 'center'); c.restore(); }
export function gauge(c: CanvasRenderingContext2D, x: number, y: number, value: number, max: number, label: string) {
    c.save();
    c.strokeStyle = FAINT;
    c.lineWidth = 5;
    c.beginPath();
    c.arc(x, y, 52, Math.PI, 2 * Math.PI);
    c.stroke();
    const a = Math.PI + Math.min(1, Math.max(0, value / max)) * Math.PI;
    line(c, x, y, x + Math.cos(a) * 42, y + Math.sin(a) * 42, INK, 2);
    circle(c, x, y, 4, INK, null);
    text(c, label, x, y + 28, 16, INK, 'center');
    c.restore();
}
