import { makeSave, validateSave } from '../core/persistence';
import type { GameState, RuntimeSnapshot, SavedExperiment } from '../core/types';

export const CLIPBOARD_KIND = 'formula-alchemy/selection';
export const CLIPBOARD_MIME = 'application/x-formula-alchemy+json';
export function selectionCopy(state: GameState, runtime: RuntimeSnapshot, ids: ReadonlySet<string>): SavedExperiment | null {
    const nodes = state.nodes.filter(n => ids.has(n.id));
    if (!nodes.length) return null;
    const keep = <T>(map: Record<string, T> | undefined) => Object.fromEntries(Object.entries(map ?? {}).filter(([id]) => ids.has(id)));
    const copyState: GameState = { ...state, nodes, selectedIds: nodes.map(n => n.id), selectedId: nodes.at(-1)!.id, lab: 'sandbox', activeId: null,
        discoveries: state.discoveries.filter(d => nodes.some(n => n.recipeId === d.recipeId)) };
    return validateSave(makeSave(copyState, { ...runtime, bodies: runtime.bodies.filter(b => ids.has(b.owner)), ages: keep(runtime.ages),
        anchors: keep(runtime.anchors), motions: keep(runtime.motions), labStates: keep(runtime.labStates),
        absorbed: runtime.absorbed.filter(key => [...ids].some(id => key.startsWith(`${id}/`))) }, 'Копия выделения'));
}
export const encodeSelection = (copy: SavedExperiment) => JSON.stringify({ kind: CLIPBOARD_KIND, version: 1, experiment: copy });
/** Clipboard content is untrusted. No application or physics mutation occurs before validation. */
export function decodeSelection(text: string): SavedExperiment | null {
    if (!text || text.length > 500000) return null;
    try {
        const value: unknown = JSON.parse(text);
        if (!value || typeof value !== 'object' || !('kind' in value) || value.kind !== CLIPBOARD_KIND || !('version' in value) || value.version !== 1 || !('experiment' in value)) return null;
        return validateSave(value.experiment);
    } catch { return null; }
}
