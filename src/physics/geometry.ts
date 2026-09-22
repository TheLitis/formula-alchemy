import { calculate } from '../core/evaluate';
import { clamp } from '../core/store';
import { HEIGHT } from '../core/types';
import type { FormulaNode } from '../core/types';
export const blackHoleGeometry = (node: FormulaNode) => ({ x: node.x, y: clamp(node.y + 160, 160, HEIGHT - 120), radius: clamp(20 + calculate('blackhole', node.params).value * 0.65, 22, 70) });
