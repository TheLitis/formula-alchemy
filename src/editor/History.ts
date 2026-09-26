import type { GameState, RuntimeSnapshot } from '../core/types';
export interface EditorSnapshot { state: GameState; runtime: RuntimeSnapshot }
interface Entry { before: EditorSnapshot; after: EditorSnapshot; label: string; mergeKey?: string; at: number }
export interface HistoryState { canUndo: boolean; canRedo: boolean; undoLabel: string; redoLabel: string; count: number }
const signature = (s: EditorSnapshot) => JSON.stringify([s.state.nodes, s.runtime.bodies, s.runtime.anchors, s.runtime.motions, s.runtime.labStates]);

/** Bounded command history, not a recording of every physics frame. Nested edits form one entry. */
export class EditHistory {
    private undoStack: Entry[] = [];
    private redoStack: Entry[] = [];
    private pending: { before: EditorSnapshot; label: string; mergeKey?: string } | null = null;
    private depth = 0;
    private applying = false;
    private listeners = new Set<() => void>();
    private status: HistoryState = { canUndo: false, canRedo: false, undoLabel: '', redoLabel: '', count: 0 };
    constructor(private capture: () => EditorSnapshot, private restore: (s: EditorSnapshot) => void, readonly limit = 60) {}
    getState = () => this.status;
    subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
    private publish() {
        this.status = { canUndo: !!this.undoStack.length, canRedo: !!this.redoStack.length, undoLabel: this.undoStack.at(-1)?.label ?? '', redoLabel: this.redoStack.at(-1)?.label ?? '', count: this.undoStack.length };
        for (const listener of this.listeners) listener();
    }
    stableSnapshot() { return structuredClone(this.pending?.before ?? this.capture()); }
    get active() { return this.pending !== null; }
    begin(label: string, mergeKey?: string) {
        if (this.applying) return;
        if (this.depth++ === 0) this.pending = { before: structuredClone(this.capture()), label, mergeKey };
    }
    end() {
        if (this.applying || this.depth === 0) return;
        if (--this.depth > 0) return;
        const pending = this.pending; this.pending = null;
        if (!pending) return;
        const after = structuredClone(this.capture());
        if (signature(after) === signature(pending.before)) return;
        const now = Date.now(), last = this.undoStack.at(-1);
        if (pending.mergeKey && last?.mergeKey === pending.mergeKey && now - last.at < 550 && !this.redoStack.length) {
            last.after = after; last.at = now;
        } else {
            this.undoStack.push({ ...pending, after, at: now });
            if (this.undoStack.length > this.limit) this.undoStack.shift();
        }
        this.redoStack = []; this.publish();
    }
    run<T>(label: string, fn: () => T, mergeKey?: string): T {
        this.begin(label, mergeKey);
        try { const result = fn(); this.end(); return result; }
        catch (error) { this.cancel(); throw error; }
    }
    private apply(snapshot: EditorSnapshot) {
        this.applying = true;
        try { this.restore(structuredClone(snapshot)); } finally { this.applying = false; }
    }
    cancel() {
        const before = this.pending?.before; this.pending = null; this.depth = 0;
        if (before) this.apply(before);
    }
    undo(): boolean {
        if (this.active) { this.cancel(); return true; }
        const entry = this.undoStack.pop(); if (!entry) return false;
        this.apply(entry.before); this.redoStack.push(entry); this.publish(); return true;
    }
    redo(): boolean {
        if (this.active) return false;
        const entry = this.redoStack.pop(); if (!entry) return false;
        this.apply(entry.after); this.undoStack.push(entry); this.publish(); return true;
    }
    clear() { this.pending = null; this.depth = 0; this.undoStack = []; this.redoStack = []; this.publish(); }
}
