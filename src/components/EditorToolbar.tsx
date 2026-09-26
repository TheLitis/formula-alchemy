import { useSyncExternalStore } from 'react';
import { useGame, useSession } from '../app/session';
import { selectionIds } from '../editor/geometry';
import { Icon } from './Icon';

export function EditorToolbar() {
    const { editor } = useSession(), game = useGame();
    const history = useSyncExternalStore(editor.history.subscribe, editor.history.getState, editor.history.getState);
    const mode = useSyncExternalStore(editor.subscribe, editor.getState, editor.getState);
    const count = selectionIds(game).length;
    const clipboard = (cut = false) => { const text = cut ? editor.cut() : editor.copy(); if(text && navigator.clipboard?.writeText) void navigator.clipboard.writeText(text).catch(()=>{}); };
    return <div className="editor-toolbar" role="toolbar" aria-label="Редактирование эксперимента">
        <button className="icon-button" aria-label="Отменить действие" title={`Ctrl+Z · ${history.undoLabel || 'Отмена'}`} disabled={!history.canUndo} onClick={() => editor.undo()}><Icon name="undo" size={17}/></button>
        <button className="icon-button" aria-label="Повторить действие" title={`Ctrl+Shift+Z / Ctrl+Y · ${history.redoLabel || 'Повтор'}`} disabled={!history.canRedo} onClick={() => editor.redo()}><Icon name="redo" size={17}/></button>
        <span className="toolbar-separator"/>
        <button className={`icon-button ${mode.selectionMode ? 'active' : ''}`} aria-label="Выделение рамкой" title="Рамка даже поверх объекта · Shift+перетаскивание" aria-pressed={mode.selectionMode} onClick={() => editor.toggleSelectionMode()}><Icon name="select" size={17}/></button>
        <button className="icon-button" aria-label="Выбрать все объекты" title="Ctrl+A · Выбрать всё на холсте" onClick={() => editor.selectAll()}><Icon name="selectAll" size={17}/></button>
        <button className="icon-button" aria-label="Повернуть выбранное" title="R · +15°; Q / Shift+R · −15°. Работает при удержании." disabled={!count} onClick={() => editor.rotate()}><Icon name="rotate" size={17}/></button>
        <button className="icon-button" aria-label="Повернуть против часовой стрелки" title="Q · −15°" disabled={!count} onClick={() => editor.rotate(-15)}><Icon name="rotate" size={17} style={{transform:'scaleX(-1)'}}/></button>
        <button className={`assembly-mode ${mode.assemblyMode?'active':''}`} aria-label="Перемещать установку целиком" aria-pressed={mode.assemblyMode} title="Alt + перенос. Выключено: тяните отдельные подвижные детали." onClick={()=>editor.toggleAssemblyMode()}><Icon name="assembly" size={15}/>{mode.assemblyMode?'Установка':'Детали'}</button>
        <button className="icon-button" aria-label="Скопировать выделение" title="Ctrl+C · Копировать" disabled={!count} onClick={()=>clipboard()}><Icon name="copy" size={17}/></button>
        <button className="icon-button" aria-label="Вырезать выделение" title="Ctrl+X · Вырезать" disabled={!count} onClick={()=>clipboard(true)}><Icon name="cut" size={17}/></button>
        <button className="icon-button" aria-label="Вставить выделение" title="Ctrl+V · Вставить копию" disabled={!mode.canPaste} onClick={()=>editor.paste()}><Icon name="paste" size={17}/></button>
        <button className="icon-button" aria-label="Дублировать выбранное" title="Ctrl+D · Копия выделения" disabled={!count} onClick={() => editor.duplicate()}><Icon name="copy" size={17}/></button>
        <button className="icon-button" data-trash aria-label="Удалить выделение" title="Delete / Backspace · Удалить выделение" disabled={!count} onClick={() => editor.deleteSelection()}><Icon name="trash" size={17}/></button>
        <span className="editor-selection-count" aria-live="polite">{count ? `Выбрано: ${count}` : mode.selectionMode ? 'Потяните рамку' : 'Q / R · WASD'}</span>
    </div>;
}
