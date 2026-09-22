import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
export function Dialog({ title, subtitle, onClose, children, className = '' }: {
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null), labelId = useId();
    useEffect(() => {
        const previous = document.activeElement as HTMLElement | null, app = document.getElementById('app-shell');
        app?.setAttribute('inert', '');
        const dialog = ref.current!;
        dialog.querySelector<HTMLElement>('button,input,select,[tabindex="0"]')?.focus();
        const key = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
                return;
            }
            if (e.key === 'Tab') {
                const focusables = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select,textarea,a[href],summary,[tabindex="0"]')].filter(el => el.offsetWidth || el.offsetHeight);
                if (!focusables.length) {
                    e.preventDefault();
                    dialog.focus();
                    return;
                }
                const first = focusables[0], last = focusables.at(-1)!;
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                }
                else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };
        document.addEventListener('keydown', key);
        return () => { document.removeEventListener('keydown', key); app?.removeAttribute('inert'); previous?.focus(); };
    }, [onClose]);
    return createPortal(<div className="dialog-backdrop" onPointerDown={e => { if (e.target === e.currentTarget)
        onClose(); }}><div className={`dialog ${className}`} ref={ref} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1}><header className="dialog-heading"><div><h2 id={labelId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button close-dialog" aria-label="Закрыть окно" onClick={onClose}><Icon name="close" size={22}/></button></header>{children}</div></div>, document.body);
}
