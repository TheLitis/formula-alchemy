import { Component, useCallback, useEffect, useState } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useAutoSave, useGame, useSession } from './session';
import { RECIPES } from '../core/catalog';
import type { NoticeKind } from '../core/store';
import { FormulaBook } from '../components/FormulaBook';
import { Journal } from '../components/Journal';
import { SaveManager } from '../components/SaveManager';
import { Help } from '../components/Help';
import { Dialog } from '../components/Dialog';
import { Palette } from '../components/Palette';
import { Inspector } from '../components/Inspector';
import { Stage } from '../components/Stage';
import { Icon } from '../components/Icon';
type Modal = 'book' | 'journal' | 'save' | 'help' | 'reset' | null;
export function App() {
    const session = useSession(), { store, audio, runtime } = session, state = useGame();
    const [modal, setModal] = useState<Modal>(null), [inspectOpen, setInspectOpen] = useState(false), [toast, setToast] = useState<{
        text: string;
        kind: NoticeKind;
    } | null>(null);
    useAutoSave();
    const close = useCallback(() => setModal(null), []);
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        store.onNotice = (text, kind) => { setToast({ text, kind }); if (timeout)
            clearTimeout(timeout); timeout = setTimeout(() => setToast(null), 4200); if (kind === 'error') audio.error(); };
        if (session.storageError)
            store.notify(session.storageError, 'error');
        return () => { if (timeout)
            clearTimeout(timeout); store.onNotice = () => { }; };
    }, [store, audio, session]);
    useEffect(() => {
        const buttonSound = (event: Event) => {
            const button = (event.target as Element).closest<HTMLButtonElement>('button');
            if (!button || button.disabled || button.matches('[data-symbol],.sound-toggle,.music-toggle')) return;
            if (event instanceof PointerEvent && (event.button !== 0 || !event.isPrimary)) return;
            if (event.type === 'click' && (event as MouseEvent).detail !== 0) return;
            void audio.unlock().catch(() => {}); audio.click();
        };
        document.addEventListener('pointerdown', buttonSound);
        document.addEventListener('click', buttonSound);
        return () => { document.removeEventListener('pointerdown', buttonSound); document.removeEventListener('click', buttonSound); };
    }, [audio]);
    useEffect(() => {
        const key = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS') {
                e.preventDefault();
                setModal('save');
                return;
            }
            if (modal || (e.target as Element).closest('input,textarea,select,button,[contenteditable="true"]'))
                return;
            if (e.code === 'Space') {
                e.preventDefault();
                store.patch({ paused: !store.getState().paused });
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                const id = store.getState().selectedId;
                if (id) {
                    e.preventDefault();
                    store.remove(id);
                }
            }
            if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
                e.preventDefault();
                const current = store.getState(), nodes = current.nodes;
                if (nodes.length) {
                    const index = nodes.findIndex(n => n.id === current.selectedId);
                    store.select(nodes[(index + (e.code === 'BracketLeft' ? -1 : 1) + nodes.length) % nodes.length].id);
                }
            }
            if (e.key.startsWith('Arrow')) {
                const current = store.getState(), n = current.nodes.find(n => n.id === current.selectedId);
                const delta = ({ ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] } as Record<string, number[]>)[e.key];
                if (n && delta) {
                    e.preventDefault(); const p = runtime.world.positionFor(n), b = runtime.world.bodies.get(`${n.id}/0`);
                    if (b) { runtime.world.hold(b.key); runtime.world.drag(p.x + delta[0], p.y + delta[1]); runtime.world.release(); }
                    else store.move(n.id, p.x + delta[0], p.y + delta[1]);
                }
            }
            if (e.key === '?')
                setModal('help');
        };
        document.addEventListener('keydown', key);
        return () => document.removeEventListener('keydown', key);
    }, [store, runtime, modal]);
    const toggleMusic = async () => { try {
        await audio.unlock();
        store.patch({ music: !store.getState().music });
    }
    catch {
        store.notify('Аудио недоступно в этом браузере.', 'error');
    } };
    return <><div className="app-shell" id="app-shell"><header className="app-header"><a className="wordmark" href="#" onClick={e => { e.preventDefault(); store.patch({ lab: 'sandbox', activeId: null, selectedId: null }); }} aria-label="Formula Alchemy — на холст"><span className="brand-mark">ƒ</span><span>Formula <em>Alchemy</em><small>ФИЗИКА В ВАШИХ РУКАХ</small></span></a>
      <nav aria-label="Основная навигация"><button className={`nav-button ${!modal ? 'nav-active' : ''}`} onClick={() => { setModal(null); store.patch({ lab: 'sandbox', activeId: null, selectedId: null }); }}><Icon name="flask" size={17}/><span>Лаборатория</span></button><button className="nav-button" aria-label="Книга формул" onClick={() => setModal('book')}><Icon name="book" size={17}/><span>Книга формул</span></button><button className="nav-button" aria-label={`Открытия: ${state.discoveries.length}`} onClick={() => setModal('journal')}><Icon name="journal" size={17}/><span>Открытия</span><span className="nav-count">{state.discoveries.length}</span></button></nav>
      <div className="header-tools"><button className={`icon-button music-toggle ${state.music ? 'active' : ''}`} title={state.music ? 'Выключить музыку' : 'Включить музыку'} aria-label={state.music ? 'Выключить музыку' : 'Включить музыку'} aria-pressed={state.music} onClick={() => { void toggleMusic(); }}><Icon name="music" size={17}/></button><button className="icon-button sound-toggle" aria-label={state.sound ? 'Выключить звуки' : 'Включить звуки'} title={state.sound ? 'Выключить звуки' : 'Включить звуки'} aria-pressed={state.sound} onClick={() => { const enabled = !store.getState().sound; store.patch({ sound: enabled }); if (enabled) void audio.unlock().then(() => audio.click()).catch(() => store.notify('Аудио недоступно в этом браузере.')); }}><Icon name={state.sound ? 'volume' : 'muted'} size={17}/></button><button className="button dark header-save" aria-label="Сохранить" onClick={() => setModal('save')}><Icon name="save" size={16}/><span>Сохранить</span></button></div>
    </header>
    <div className="app-content"><Palette onBook={() => setModal('book')}/><Stage onReset={() => setModal('reset')} onHelp={() => setModal('help')} onInspect={() => setInspectOpen(true)}/>{inspectOpen && <button className="inspector-scrim" aria-label="Закрыть панель параметров" onClick={() => setInspectOpen(false)}/>}<Inspector open={inspectOpen} onClose={() => setInspectOpen(false)} onBook={() => setModal('book')}/></div>
    <footer className="app-footer"><span>Любопытство — единственная предпосылка.</span><span>{RECIPES.length} физических рецепта <span className="footer-dot">·</span> 7–11 классы</span></footer>
  </div>
  {modal === 'book' && <FormulaBook onClose={close}/>}{modal === 'journal' && <Journal onClose={close}/>}{modal === 'save' && <SaveManager onClose={close}/>}{modal === 'help' && <Help onClose={close}/>}{modal === 'reset' && <Dialog title="Начать с чистого листа?" subtitle="Элементы и физические тела будут удалены. Журнал открытий сохранится." onClose={close} className="confirm-dialog"><div className="confirm-actions"><button className="button outline" onClick={close}>Продолжить опыт</button><button className="button dark" onClick={() => { store.reset(); runtime.reset(); close(); store.notify('Холст очищен. Открытия остались в журнале.'); }}>Очистить холст</button></div></Dialog>}
  {toast && <div className={`toast toast-${toast.kind}`} role="status"><Icon name={toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'help' : 'flask'} size={19}/><span>{toast.text}</span><button className="icon-button" aria-label="Закрыть уведомление" onClick={() => setToast(null)}><Icon name="close" size={15}/></button></div>}
  </>;
}
export class ErrorBoundary extends Component<{
    children: ReactNode;
}, {
    error: string;
}> {
    state = { error: '' };
    static getDerivedStateFromError(error: Error) { return { error: error.message }; }
    componentDidCatch(error: Error, info: ErrorInfo) { console.error('Formula Alchemy UI error', error, info.componentStack); }
    render() { if (this.state.error)
        return <div className="fatal-error"><h1>Formula Alchemy</h1><p>Не удалось открыть интерфейс: {this.state.error}</p><button className="button dark" onClick={() => location.reload()}>Перезагрузить</button><p>Ваши локальные сохранения не удалены.</p></div>; return this.props.children; }
}
