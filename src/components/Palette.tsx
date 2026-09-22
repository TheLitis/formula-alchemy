import { useMemo, useState } from 'react';
import { useGame, useSession } from '../app/session';
import { RECIPES } from '../core/catalog';
import { candidates } from '../core/crafting';
import { SYMBOLS, TOPICS } from '../core/symbols';
import { Formula } from './Formula';
import { Icon } from './Icon';
export function Palette({ onBook }: {
    onBook: () => void;
}) {
    const { store } = useSession(), state = useGame();
    const [topic, setTopic] = useState('mechanics'), [search, setSearch] = useState(''), [expanded, setExpanded] = useState(false);
    const selected = state.nodes.find(n => n.id === state.selectedId);
    const topicSymbols = useMemo(() => new Set(RECIPES.filter(r => r.topic === topic).flatMap(r => r.inputs)), [topic]);
    const items = SYMBOLS.filter(s => (topic === 'all' || topicSymbols.has(s.id) || search.trim()) && (!search.trim() || `${s.name} ${s.id}`.toLowerCase().includes(search.toLowerCase())));
    return <aside className={`palette ${expanded ? 'palette-expanded' : ''}`} aria-label="Палитра физических символов">
    <div className="palette-heading"><div><h2>Переменные</h2><p>Перетащите на холст</p></div><button className="icon-button mobile-only" aria-label={expanded ? 'Свернуть палитру' : 'Развернуть палитру'} onClick={() => setExpanded(!expanded)}><Icon name="chevron" style={{ transform: expanded ? 'rotate(180deg)' : undefined }}/></button></div>
    <div className="palette-filters"><label className="sr-only" htmlFor="palette-topic">Раздел палитры</label><select id="palette-topic" value={topic} onChange={e => setTopic(e.target.value)}><option value="all">Все разделы</option>{TOPICS.map(t => <option key={t.id} value={t.id}>{t.number} · {t.short}</option>)}</select>
    <label className="search-field"><Icon name="search" size={15}/><input aria-label="Поиск символа" placeholder="Найти переменную" value={search} onChange={e => setSearch(e.target.value)}/></label></div>
    <div className="symbol-grid">{items.map(symbol => {
            const compatible = selected && candidates([...selected.parts, symbol.id]).length > 0;
            return <button key={symbol.id} className={`symbol ${compatible ? 'symbol-compatible' : ''}`} data-symbol={symbol.id} title={`${symbol.name} · ${symbol.unit}${symbol.constant ? ' · ' + symbol.constant : ''}`} aria-label={`${symbol.id} — ${symbol.name}`} onClick={e => { if (e.detail === 0)
                store.addToken(symbol.id); }}>
        <Formula tex={symbol.tex}/><span className="symbol-unit">{symbol.unit}</span>{compatible && <span className="compatible-dot"/>}
      </button>;
        })}{items.length === 0 && <p className="empty-small">Символ не найден</p>}</div>
    <div className="palette-footer"><span className="compatibility-legend"><span className="tiny-dot"/> Совместимо с выбором</span><button className="text-button" onClick={onBook}>Посмотреть рецепты <Icon name="arrow" size={16}/></button><p>Коэффициенты и степени<br />достраиваются по рецепту.</p></div>
  </aside>;
}
