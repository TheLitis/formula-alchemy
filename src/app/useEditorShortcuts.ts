import { useEffect, useRef } from 'react';
import { CLIPBOARD_MIME } from '../editor/Clipboard';
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
                if (!supported) return; // Browser dispatches native clipboard events for Ctrl+C/X/V below; keep Ctrl+R native.
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
            if (['KeyR', 'KeyQ'].includes(e.code) && !e.altKey) {
                e.preventDefault(); editor.rotate(e.code === 'KeyQ' || e.shiftKey ? -15 : 15, `rotate:${editor.ids.join(',')}`); return;
            }
            if (e.code === 'Escape' || e.key === 'Escape') {
                e.preventDefault(); if (!editor.cancelPointer?.()) { editor.select([]); callbacks.current.onEscape(); } return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault(); if (!e.repeat) editor.deleteSelection(); return;
            }
            const direction = ({ ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1] } as Record<string, number[]>)[e.code];
            if (direction && editor.ids.length) {
                e.preventDefault();
                const step = e.altKey ? 1 : e.shiftKey ? 2 : 12;
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
        const clipboard = (event: ClipboardEvent) => {
            if (event.defaultPrevented || isEditingText(event.target) || document.querySelector('[aria-modal="true"]')) return;
            // Text selected in explanations still copies normally.
            if (window.getSelection()?.toString()) return;
            if (event.type === 'paste') {
                const text = event.clipboardData?.getData(CLIPBOARD_MIME) || event.clipboardData?.getData('text/plain');
                if (text && editor.paste(text)) event.preventDefault();
            } else {
                if (!editor.ids.length || !event.clipboardData) return;
                const text = event.type === 'cut' ? editor.cut() : editor.copy();
                if (text) { event.clipboardData.setData('text/plain', text); event.clipboardData.setData(CLIPBOARD_MIME, text); event.preventDefault(); }
            }
        };
        document.addEventListener('keydown', key);
        for (const type of ['copy', 'cut', 'paste']) document.addEventListener(type, clipboard as EventListener);
        return () => { document.removeEventListener('keydown', key); for (const type of ['copy', 'cut', 'paste']) document.removeEventListener(type, clipboard as EventListener); };
    }, [store, editor]);
}
