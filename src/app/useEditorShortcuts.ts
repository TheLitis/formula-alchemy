import { useEffect, useRef } from 'react';
import { useSession } from './session';

/** Editing a number or typing in a dialog keeps native browser text shortcuts intact. */
export function isEditingText(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
}
export function useEditorShortcuts(actions: { onSave: () => void; onHelp: () => void; onEscape: () => void }) {
    const { store, editor } = useSession(), callbacks = useRef(actions);
    callbacks.current = actions;
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if (e.defaultPrevented || e.isComposing || document.querySelector('[aria-modal="true"]') || isEditingText(e.target)) return;
            const command = e.ctrlKey || e.metaKey;
            // code, not key: R/Z/A/D/S also work with the Russian keyboard layout.
            if (command && !e.altKey) {
                const supported = ['KeyZ', 'KeyY', 'KeyA', 'KeyD', 'KeyS'].includes(e.code);
                if (!supported) return; // in particular, do not intercept browser Ctrl+R.
                e.preventDefault();
                if (e.repeat) return;
                if (e.code === 'KeyZ') { if (e.shiftKey) editor.redo(); else editor.undo(); }
                if (e.code === 'KeyY') editor.redo();
                if (e.code === 'KeyA') { editor.cancelPointer?.(); editor.selectAll(); }
                if (e.code === 'KeyD') editor.duplicate();
                if (e.code === 'KeyS') { editor.cancelPointer?.(); callbacks.current.onSave(); }
                return;
            }
            if (command) return;
            if (e.code === 'KeyR' && !e.altKey) {
                e.preventDefault(); editor.rotate(e.shiftKey ? -15 : 15, `rotate:${editor.ids.join(',')}`); return;
            }
            if (e.code === 'Escape' || e.key === 'Escape') {
                e.preventDefault(); if (!editor.cancelPointer?.()) { editor.select([]); callbacks.current.onEscape(); } return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault(); if (!e.repeat) editor.deleteSelection(); return;
            }
            const direction = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, number[]>)[e.key];
            if (direction && editor.ids.length) {
                e.preventDefault();
                const step = e.altKey ? 1 : e.shiftKey ? 40 : 12;
                editor.move(direction[0] * step, direction[1] * step, `nudge:${editor.ids.join(',')}`); return;
            }
            if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
                e.preventDefault(); editor.cancelPointer?.();
                const ids = editor.visibleIds(), index = ids.indexOf(store.getState().selectedId ?? '');
                if (ids.length) editor.select([ids[(index + (e.code === 'BracketLeft' ? -1 : 1) + ids.length) % ids.length]]);
                return;
            }
            if (e.code === 'Space' && !(e.target as Element)?.closest('button,summary,a')) {
                e.preventDefault(); if (!e.repeat) store.patch({ paused: !store.getState().paused }); return;
            }
            if (e.key === '?' || e.code === 'KeyH' && !e.altKey) {
                e.preventDefault(); editor.cancelPointer?.(); callbacks.current.onHelp();
            }
        };
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
    }, [store, editor]);
}
