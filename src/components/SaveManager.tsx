import { useRef, useState } from 'react';
import { useSession } from '../app/session';
import { deleteSlot, exportSave, parseSave, readSlots, writeAuto, writeSlot } from '../core/persistence';
import type { SavedExperiment } from '../core/types';
import { Dialog } from './Dialog';
import { Icon } from './Icon';
export function SaveManager({ onClose }: {
    onClose: () => void;
}) {
    const session = useSession(), { store, editor } = session;
    const [name, setName] = useState('Мой эксперимент'), [error, setError] = useState(''), [deleting, setDeleting] = useState<string | null>(null), [slots, setSlots] = useState<SavedExperiment[]>(() => { try {
        return readSlots();
    }
    catch {
        return [];
    } });
    const input = useRef<HTMLInputElement>(null);
    const load = (saved: SavedExperiment) => { editor.load(saved); try {
        writeAuto(session.snapshot(saved.name));
    }
    catch { /* imported data remains usable even without storage */ } store.notify(`Загружено: ${saved.name}`, 'success'); onClose(); };
    const save = () => { try {
        const saved = session.snapshot(name);
        writeSlot(saved);
        writeAuto(saved);
        setSlots(readSlots());
        store.notify('Эксперимент сохранён в этом браузере.', 'success');
        setError('');
    }
    catch (e) {
        setError(`Сохранение недоступно: ${(e as Error).message} Используйте экспорт JSON.`);
    } };
    const importFile = async (file: File | undefined) => { if (!file)
        return; try {
        if (file.size > 500000)
            throw new Error('Максимальный размер файла — 500 КБ.');
        const save = parseSave(await file.text());
        load(save);
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        if (input.current)
            input.current.value = '';
    } };
    return <Dialog title="Ваши эксперименты" subtitle="Сохраняются формулы, параметры, время, положения и скорости тел." onClose={onClose} className="save-dialog"><div className="save-new"><label htmlFor="experiment-name">Название эксперимента</label><div><input id="experiment-name" maxLength={80} value={name} onChange={e => setName(e.target.value)}/><button className="button dark" onClick={save}><Icon name="save" size={17}/> Сохранить</button></div></div>
    <div className="save-transfer"><button className="button outline" onClick={() => exportSave(session.snapshot(name))}><Icon name="download"/> Экспорт JSON</button><button className="button outline" onClick={() => input.current?.click()}><Icon name="upload"/> Импорт JSON</button><input ref={input} className="sr-only" aria-label="Файл эксперимента" type="file" accept=".json,application/json" onChange={e => { void importFile(e.target.files?.[0]); }}/></div>
    {error && <p className="inline-error" role="alert">{error}</p>}
    <div className="saved-list">{slots.map(s => <article key={s.id}><div><h3>{s.name}</h3><p>{new Date(s.savedAt).toLocaleString('ru-RU')} · {s.state.nodes.length} элементов</p></div>{deleting === s.id ? <div className="inline-confirm"><span>Удалить?</span><button className="text-button" onClick={() => { try {
        deleteSlot(s.id);
        setSlots(readSlots());
        setDeleting(null);
    }
    catch (e) {
        setError((e as Error).message);
    } }}>Да</button><button className="text-button" onClick={() => setDeleting(null)}>Нет</button></div> : <div className="saved-actions"><button className="button tiny outline" onClick={() => load(s)}>Загрузить</button><button className="icon-button" aria-label={`Удалить сохранение ${s.name}`} onClick={() => setDeleting(s.id)}><Icon name="trash" size={16}/></button></div>}</article>)}{!slots.length && <div className="empty-dialog"><h3>Место для ваших гипотез</h3><p>Сохранённых экспериментов пока нет.</p></div>}</div>
    <div className="save-footnote">8 локальных слотов; новое сохранение вытесняет самое старое. Автосохранение каждые 10 секунд — отдельно. JSON позволяет перенести опыт на другой компьютер. Пауза сохраняется, музыка после загрузки выключена.</div>
  </Dialog>;
}
