import { useGame, useRuntimeTick, useSession } from '../app/session';
import { RECIPE_MAP } from '../core/catalog';
import { candidates, exactRecipes, missingParts } from '../core/crafting';
import { calculate, formatValue } from '../core/evaluate';
import { SYMBOL_MAP, TOPICS } from '../core/symbols';
import { Formula } from './Formula';
import { Icon } from './Icon';
export function Inspector({ open, onClose, onBook }: {
    open: boolean;
    onClose: () => void;
    onBook: () => void;
}) {
    const { store } = useSession(), state = useGame(), runtime = useRuntimeTick();
    const node = state.nodes.find(n => n.id === state.selectedId), recipe = node?.recipeId ? RECIPE_MAP[node.recipeId] : null;
    const reading = recipe && node ? calculate(recipe.id, node.params, runtime.ages.get(node.id) ?? 0) : null;
    const possibilities = node ? candidates(node.parts).filter(r => r.id !== node.recipeId).slice(0, 5) : [];
    return <aside className={`inspector ${open ? 'inspector-open' : ''}`} aria-label="Параметры эксперимента">
    <div className="inspector-heading"><span>{recipe ? 'Параметры опыта' : node ? 'Исследование' : 'С чего начать'}</span><button className="icon-button inspector-close" aria-label="Закрыть параметры" onClick={onClose}><Icon name="close"/></button>{node && <button className="icon-button inspector-delete" data-trash aria-label="Удалить выбранное" title="Удалить · Delete" onClick={() => store.remove(node.id)}><Icon name="trash" size={16}/></button>}</div>
    <div className="inspector-body">{!node ? <>
      <div className="intro-glyph"><Formula tex="m+g"/></div><h2 className="serif">Маленький символ.<br />Большое открытие.</h2><p className="muted">Переместите <Formula tex="g"/> на <Formula tex="m"/>. Получится сила тяжести — и тело начнёт падать.</p>
      <div className="first-recipe"><span>Первый эксперимент</span><Formula tex="F=mg"/><button className="button dark" onClick={() => store.openRecipe('weight')}>Показать действие <Icon name="arrow" size={16}/></button></div>
      <div className="mini-guide"><span>01</span><p>Соединяйте переменные</p><span>02</span><p>Изменяйте параметры</p><span>03</span><p>Наблюдайте закономерности</p></div>
      <button className="button outline full" onClick={onBook}><Icon name="book"/> Открыть книгу формул</button>
    </> : recipe && reading ? <>
      <div className="recipe-meta">{TOPICS.find(t => t.id === recipe.topic)?.short} <span>· {recipe.grade} кл.</span></div>
      <h2 className="recipe-title">{recipe.title}</h2><div className="inspector-formula"><Formula tex={recipe.tex} block/></div>
      <div className="reading" aria-live="off"><span className="reading-label">{recipe.id === 'decay' ? 'На текущий момент' : 'Расчёт по формуле'}</span><div><strong data-testid="reading-value">{reading.note === 'Полное внутреннее отражение' ? 'ПВО' : formatValue(reading.value)}</strong><span>{reading.note === 'Полное внутреннее отражение' ? '' : reading.unit}</span></div>{reading.note && <small>{reading.note}</small>}</div>
      <div className="parameter-list">{recipe.params.map(p => <div className="parameter" key={p.key}><label htmlFor={`param-${p.key}`}><span><Formula tex={p.symbol}/> {p.name}</span><small>{p.unit}</small></label><div className="range-row"><input id={`param-${p.key}`} type="range" min={p.min} max={p.max} step={p.step} value={node.params[p.key]} onChange={e => store.setParam(node.id, p.key, e.currentTarget.valueAsNumber)}/><input className="number-input" aria-label={`${p.name}, численно`} type="number" min={p.min} max={p.max} step={p.step} value={node.params[p.key]} onChange={e => store.setParam(node.id, p.key, e.currentTarget.valueAsNumber)}/></div></div>)}</div>
      {recipe.lab === 'circuits' && <button className="button outline full" onClick={() => store.toggleCircuit(node.id)}>{node.closed ? 'Разомкнуть цепь' : 'Замкнуть цепь'} <span className={`circuit-dot ${node.closed ? 'is-on' : ''}`}/></button>}
      <button className="button outline full restart-experiment" onClick={() => store.restart(node.id)}><Icon name="reset" size={16}/> Перезапустить опыт</button>
      {exactRecipes(node.parts).length > 1 && <div className="variants"><span className="section-caption">Те же символы, другой закон</span>{exactRecipes(node.parts).filter(r => r.id !== recipe.id).map(r => <button key={r.id} className="variant" onClick={() => store.variant(node.id, r.id)}><Formula tex={r.tex}/><Icon name="arrow" size={14}/></button>)}</div>}
      <section className="explanation"><h3>Физический закон</h3><p>{recipe.description}</p></section><details className="model-note"><summary>Границы учебной модели</summary><p>{recipe.model}</p></details>
      <details className="symbol-details"><summary>Обозначения и единицы</summary>{recipe.inputs.map(id => <p key={id}><Formula tex={SYMBOL_MAP[id].tex}/> — {SYMBOL_MAP[id].name}, {SYMBOL_MAP[id].unit}{SYMBOL_MAP[id].constant && <small> = {SYMBOL_MAP[id].constant}</small>}</p>)}</details>
      {possibilities.some(r => r.inputs.length > node.parts.length) && <section className="next-steps"><h3>Продолжить комбинацию</h3>{possibilities.filter(r => r.inputs.length > node.parts.length).slice(0, 2).map(r => <div key={r.id}><span>{r.title}</span>{missingParts(node.parts, r).map(id => <button key={id} onClick={() => store.dropSymbol(id, node.id)} title={`Добавить ${SYMBOL_MAP[id].name}`}><span>+</span><Formula tex={SYMBOL_MAP[id].tex}/></button>)}</div>)}</section>}
    </> : <>
      <div className="intro-glyph"><Formula tex={node.parts.map(id => SYMBOL_MAP[id].tex).join('\\,')}/></div><h2 className="serif">{node.parts.length === 1 ? SYMBOL_MAP[node.parts[0]].name : 'Промежуточная комбинация'}</h2><p className="muted">{node.parts.length === 1 ? `Единица СИ: ${SYMBOL_MAP[node.parts[0]].unit}. ` : ''}Добавьте совместимые символы. Порядок соединения не важен.</p>
      <h3 className="section-caption">Что можно получить</h3><div className="suggestions">{possibilities.map(r => <div className="suggestion" key={r.id}><span>{r.title}</span><Formula tex={r.tex}/><div>{missingParts(node.parts, r).map(id => <button key={id} title={`Добавить ${SYMBOL_MAP[id].name}`} onClick={() => store.dropSymbol(id, node.id)}><span>+</span><Formula tex={SYMBOL_MAP[id].tex}/></button>)}</div></div>)}</div>
      <button className="text-button" onClick={onBook}>Все рецепты <Icon name="arrow" size={16}/></button>
    </>}</div>
    <div className="inspector-footnote"><span className="tiny-dot"/> Числа — физика. Масштаб — визуализация.</div>
  </aside>;
}
