import type { FormulaNode, GameState } from '../core/types';

export interface Point { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }
export const radians = (degrees: number) => degrees * Math.PI / 180;
export const normalizeAngle = (degrees: number) => ((degrees % 360) + 360) % 360;
export const orientation = (node: FormulaNode) => radians(node.rotation ?? 0);
export function rotateVector(p: Point, angle: number): Point {
    const c = Math.cos(angle), s = Math.sin(angle);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}
export function rotatePoint(p: Point, pivot: Point, angle: number): Point {
    const v = rotateVector({ x: p.x - pivot.x, y: p.y - pivot.y }, angle);
    return { x: pivot.x + v.x, y: pivot.y + v.y };
}
export function boxFromPoints(a: Point, b: Point): Box {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}
export const selectionIds = (s: GameState): string[] => (s.selectedIds ?? (s.selectedId ? [s.selectedId] : [])).filter(id => s.nodes.some(n => n.id === id));
