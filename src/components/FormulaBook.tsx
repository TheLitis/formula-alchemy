import { useState } from 'react';
import { useGame, useSession } from '../app/session';
import { RECIPES } from '../core/catalog';
import { SYMBOL_MAP, TOPICS } from '../core/symbols';
import { Dialog } from './Dialog';
import { Formula } from './Formula';
import { Icon } from './Icon';
export function FormulaBook({ onClose }: {
    onClose: () => void;
}) {
    const [query, setQuery] = useState(''), [topic, setTopic] = useState('all'), [onlyFound, setOnlyFound] = useState(false), [expanded, setExpanded] = useState<string | null>(null);
    const { store } = useSession(), state = useGame(), found = new Set(state.discoveries.map(d => d.recipeId));
    const filtered = RECIPES.filter(r => (topic === 'all' || r.topic === topic) && (!onlyFound || found.has(r.id)) && `${r.title} ${r.description} ${r.inputs.join(' ')}`.toLowerCase().includes(query.toLowerCase()));
    return <Dialog title="Книга формул" subtitle={`${RECIPES.length} рецепта. От первого падения — до горизонта событий.`} onClose={onClose} className="book-dialog">
    <div className="book-filters"><label className="search-field"><Icon name="search"/><input aria-label="Поиск формулы" placeholder="Закон, явление или символ…" value={query} onChange={e => setQuery(e.target.value)}/></label><select aria-label="Раздел книги" value={topic} onChange={e => setTopic(e.target.value)}><option value="all">Все разделы</option>{TOPICS.map(t => <option value={t.id} key={t.id}>{t.short}</option>)}</select><button className={`filter-toggle ${onlyFound ? 'active' : ''}`} aria-pressed={onlyFound} onClick={() => setOnlyFound(!onlyFound)}>Открыто {found.size}/{RECIPES.length}</button></div>
    <div className="book-list">{filtered.map((r, i) => <article className={`book-entry ${found.has(r.id) ? 'discovered' : ''}`} data-testid={`recipe-${r.id}`} key={r.id}><div className="book-entry-main"><span className="entry-number">{found.has(r.id) ? <Icon name="check" size={16}/> : String(i + 1).padStart(2, '0')}</span><button className="entry-description" aria-expanded={expanded === r.id} onClick={() => setExpanded(expanded === r.id ? null : r.id)}><span className="entry-topic">{TOPICS.find(t => t.id === r.topic)?.short} · {r.grade} кл.</span><h3>{r.title}</h3><Formula tex={r.tex}/></button><div className="entry-actions"><button className="icon-button" title="Положить ингредиенты на холст" aria-label={`${r.title}: подготовить символы`} onClick={() => { store.prepareRecipe(r.id); onClose(); }}><Icon name="plus" size={18}/></button><button className="button tiny dark" aria-label={`${r.title}: открыть опыт`} onClick={() => { store.openRecipe(r.id); onClose(); }}>Открыть опыт <Icon name="arrow" size={15}/></button></div></div>
      {expanded === r.id && <div className="entry-expanded"><div className="recipe-ingredients">{r.inputs.map((id, j) => <span key={id}>{j > 0 && <span className="muted">+</span>}<Formula tex={SYMBOL_MAP[id].tex}/></span>)}<Icon name="arrow" size={17}/><Formula tex={r.tex}/></div><p>{r.description}</p><p><strong>Что происходит:</strong> {r.effect}</p><p className="entry-model"><strong>Модель:</strong> {r.model}</p></div>}
    </article>)}{!filtered.length && <div className="empty-dialog"><h3>Пока ничего не найдено</h3><p>Измените запрос или откройте свой первый закон.</p><button className="button outline" onClick={() => { setQuery(''); setTopic('all'); setOnlyFound(false); }}>Показать все формулы</button></div>}</div>
    <footer className="book-footer"><Icon name="help" size={15}/><p>«+» готовит символы для самостоятельной сборки. «Открыть опыт» собирает рецепт сразу и отмечает его в журнале.</p></footer>
  </Dialog>;
}
