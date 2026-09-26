import { useSyncExternalStore } from 'react';
import { useGame, useSession } from '../app/session';
import { selectionIds } from '../editor/geometry';
import { Icon } from './Icon';

export function EditorToolbar() {
    const { editor } = useSession(), game = useGame();
    const history = useSyncExternalStore(editor.history.subscribe, editor.history.getState, editor.history.getState);
    const mode = useSyncExternalStore(editor.subscribe, editor.getState, editor.getState);
    const count = selectionIds(game).length;
    return <div className="editor-toolbar" role="toolbar" aria-label="Редактирование эксперимента">
        <button className="icon-button" aria-label="Отменить действие" title={`Ctrl+Z · ${history.undoLabel || 'Отмена'}`} disabled={!history.canUndo} onClick={() => editor.undo()}><Icon name="undo" size={17}/></button>
        <button className="icon-button" aria-label="Повторить действие" title={`Ctrl+Shift+Z / Ctrl+Y · ${history.redoLabel || 'Повтор'}`} disabled={!history.canRedo} onClick={() => editor.redo()}><Icon name="redo" size={17}/></button>
        <span className="toolbar-separator"/>
        <button className={`icon-button ${mode.selectionMode ? 'active' : ''}`} aria-label="Выделение рамкой" title="Рамка даже поверх объекта · Shift+перетаскивание" aria-pressed={mode.selectionMode} onClick={() => editor.toggleSelectionMode()}><Icon name="select" size={17}/></button>
        <button className="icon-button" aria-label="Выбрать все объекты" title="Ctrl+A · Выбрать всё на холсте" onClick={() => editor.selectAll()}><Icon name="selectAll" size={17}/></button>
        <button className="icon-button" aria-label="Повернуть выбранное" title="R · +15°; Shift+R · −15°. Работает при удержании." disabled={!count} onClick={() => editor.rotate()}><Icon name="rotate" size={17}/></button>
        <button className="icon-button" aria-label="Дублировать выбранное" title="Ctrl+D · Копия выделения" disabled={!count} onClick={() => editor.duplicate()}><Icon name="copy" size={17}/></button>
        <button className="icon-button" data-trash aria-label="Удалить выделение" title="Delete / Backspace · Удалить выделение" disabled={!count} onClick={() => editor.deleteSelection()}><Icon name="trash" size={17}/></button>
        <span className="editor-selection-count" aria-live="polite">{count ? `Выбрано: ${count}` : mode.selectionMode ? 'Потяните рамку' : 'Рамка · Ctrl · R'}</span>
    </div>;
}
