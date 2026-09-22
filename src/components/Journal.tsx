import { useGame, useSession } from '../app/session';
import { RECIPES, RECIPE_MAP } from '../core/catalog';
import { TOPICS } from '../core/symbols';
import { Dialog } from './Dialog';
import { Formula } from './Formula';
import { Icon } from './Icon';
export function Journal({ onClose }: {
    onClose: () => void;
}) {
    const state = useGame(), { store } = useSession();
    return <Dialog title="Журнал открытий" subtitle="Каждый закон — ещё один способ взглянуть на мир." onClose={onClose} className="journal-dialog"><div className="journal-summary"><div><strong>{state.discoveries.length}</strong><span>из {RECIPES.length} открытий</span></div><div className="discovery-progress"><span style={{ width: `${state.discoveries.length / RECIPES.length * 100}%` }}/></div><div className="topic-progress">{TOPICS.map(t => { const total = RECIPES.filter(r => r.topic === t.id).length, done = state.discoveries.filter(d => RECIPE_MAP[d.recipeId].topic === t.id).length; return <span key={t.id} title={`${t.name}: ${done} из ${total}`} className={done === total ? 'complete' : ''}>{t.short}<b>{done}/{total}</b></span>; })}</div></div>
    <div className="journal-list">{[...state.discoveries].reverse().map(d => { const r = RECIPE_MAP[d.recipeId]; return <article key={d.recipeId}><span className="journal-dot"/><div><span className="entry-topic">{new Date(d.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {d.source === 'craft' ? 'собрано вручную' : 'открыто из книги'}</span><h3>{r.title}</h3><Formula tex={r.tex}/></div><button className="icon-button" aria-label={`Повторить: ${r.title}`} onClick={() => { store.openRecipe(r.id); onClose(); }}><Icon name="arrow"/></button></article>; })}{!state.discoveries.length && <div className="empty-dialog"><Formula tex="m+g\\;\\longrightarrow\\;F=mg"/><h3>Первое открытие впереди</h3><p>Перетащите g на m — физика начнётся с простого.</p><button className="button dark" onClick={onClose}>Вернуться на холст</button></div>}</div></Dialog>;
}
