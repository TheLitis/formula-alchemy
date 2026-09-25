import type { FormulaNode } from '../core/types';
/** Node coordinates are the visible center, without a hidden +160px handle offset. */
export const blackHoleGeometry = (node: FormulaNode) => ({ x: node.x, y: node.y, radius: Math.min(96, 22 + (node.params.M ?? 5) * 3) });
