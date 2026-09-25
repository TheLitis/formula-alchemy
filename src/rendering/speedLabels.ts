import { HEIGHT, WIDTH } from '../core/types';
import type { GameState, Viewport } from '../core/types';
import { speedText } from '../physics/speedReadings';
import type { SpeedReading } from '../physics/speedReadings';
import { blackHoleGeometry } from '../physics/geometry';

interface Box { x: number; y: number; w: number; h: number }
export interface SpeedLabel extends Box { key: string; nodeId: string; text: string; value: number; unit: string }
const overlaps = (a: Box, b: Box) => a.x < b.x + b.w + 3 && a.x + a.w + 3 > b.x && a.y < b.y + b.h + 3 && a.y + a.h + 3 > b.y;

/** Screen-sized text only: no card, no hit target, no formula, no React work per frame. */
export function drawSpeedLabels(c: CanvasRenderingContext2D, readings: SpeedReading[], state: GameState, v: Viewport): SpeedLabel[] {
    if (!state.speeds) return [];
    const mobile = v.width < 600, fontSize = (mobile ? 11 : 12) / v.scale, maxLabels = mobile ? 7 : 14;
    const placed: SpeedLabel[] = [];
    const obstacles = readings.filter(r => !r.prefix).map(r => ({ x: r.x - Math.max(r.radius, 16 / v.scale), y: r.y - Math.max(r.radius, 16 / v.scale), w: 2 * Math.max(r.radius, 16 / v.scale), h: 2 * Math.max(r.radius, 16 / v.scale) }));
    const holes = state.lab === 'sandbox' ? state.nodes.filter(n => n.recipeId === 'blackhole').map(blackHoleGeometry) : [];
    const candidates = readings.filter(r => r.value >= (r.unit === 'c' ? .005 : .05) || r.nodeId === state.selectedId)
        .sort((a, b) => Number(b.nodeId === state.selectedId) - Number(a.nodeId === state.selectedId));
    c.save(); c.font = `${fontSize}px 'Segoe UI', Arial, sans-serif`; c.textBaseline = 'top'; c.textAlign = 'left';
    c.lineJoin = 'round';
    for (const r of candidates) {
        if (placed.length >= maxLabels) break;
        if (r.x < 0 || r.x > WIDTH || r.y < 0 || r.y > HEIGHT - 30) continue;
        if (holes.some(h => Math.hypot(r.x - h.x, r.y - h.y) < h.radius + 48)) continue;
        const text = `${r.prefix ? r.prefix + ' ' : ''}${speedText(r)}`;
        const w = c.measureText(text).width, h = fontSize * 1.2;
        const gap = Math.max(r.radius + 8 / v.scale, 22 / v.scale);
        const offsets = [[gap, -h], [gap, 2 / v.scale], [-gap - w, -h], [-gap - w, 2 / v.scale], [-w / 2, -gap - h], [-w / 2, gap]];
        for (const [dx, dy] of offsets) {
            const box = { x: r.x + dx, y: r.y + dy, w, h };
            if (box.x < 5 || box.y < 5 || box.x + w > WIDTH - 5 || box.y + h > HEIGHT - 44) continue;
            if (placed.some(p => overlaps(box, p)) || obstacles.some(p => overlaps(box, p))) continue;
            // A narrow halo makes digits readable across grid lines without reintroducing tiles.
            c.strokeStyle = '#f3f3f3'; c.lineWidth = 2.5 / v.scale; c.strokeText(text, box.x, box.y);
            c.fillStyle = r.nodeId === state.selectedId ? '#3c3c3c' : '#737373'; c.fillText(text, box.x, box.y);
            placed.push({ ...box, key: r.key, nodeId: r.nodeId, text, value: r.value, unit: r.unit });
            break;
        }
    }
    c.restore();
    return placed;
}
