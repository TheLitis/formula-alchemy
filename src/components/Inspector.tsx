import { partHint } from '../editor/Parts';
import { inductionMotion } from '../physics/interactiveModels';
import { orientation } from '../editor/geometry';
import { selectionIds } from '../editor/geometry';
import { SpeedReadout } from './SpeedReadout';
import { isApparatus, standaloneDescription, standaloneParameters } from '../core/entities';
import { ParameterControls } from './ParameterControls';
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
    const { store, editor } = useSession(), state = useGame(), runtime = useRuntimeTick();
    const node = state.nodes.find(n => n.id === state.selectedId), recipe = node?.recipeId ? RECIPE_MAP[node.recipeId] : null;
    const ids = selectionIds(state);
    let currentX: number | null = null;
    if(node?.recipeId==='hooke'){const b=runtime.world.bodies.get(`${node.id}/0`);const anchor=runtime.world.anchorFor(node.id);if(b&&anchor){const a=orientation(node);currentX=((b.body.position.x-anchor.x)*Math.cos(a)+(b.body.position.y-anchor.y)*Math.sin(a))/32;}}
    const reading = recipe && node ? calculate(recipe.id, currentX!==null?{...node.params,x:currentX}:node.params, runtime.ages.get(node.id) ?? 0) : null;
    if(reading&&node?.recipeId==='induction')reading.value=inductionMotion(node,runtime.ages.get(node.id)??0,runtime.labStates.get(node.id)).emf;
    const possibilities = node ? candidates(node.parts).filter(r => r.id !== node.recipeId).slice(0, 5) : [];
    return <aside className={`inspector ${open ? 'inspector-open' : ''}`} aria-label="Параметры эксперимента">
    <div className="inspector-heading"><span>{ids.length > 1 ? `Выбрано: ${ids.length}` : recipe ? 'Параметры опыта' : node ? 'Исследование' : 'С чего начать'}</span><button className="icon-button inspector-close" aria-label="Закрыть параметры" onClick={onClose}><Icon name="close"/></button>{node && <button className="icon-button inspector-delete" data-trash aria-label="Удалить выбранное" title="Удалить · Delete" onClick={() => editor.deleteSelection()}><Icon name="trash" size={16}/></button>}</div>
    <div className="inspector-body">{ids.length > 1 ? <>
      <h2 className="serif">Группа из {ids.length} объектов</h2>
      <p className="muted">Тяните любой выделенный объект — перемещается вся группа. R поворачивает её на 15°, Q — в обратную сторону. WASD перемещает; Shift замедляет. Ctrl-клик убирает или добавляет один объект.</p>
      <div className="group-actions"><button className="button outline" onClick={() => editor.rotate()}><Icon name="rotate"/>Повернуть</button><button className="button outline" onClick={() => editor.duplicate()}><Icon name="copy"/>Копия</button></div>
      <div className="selected-objects">{state.nodes.filter(n => ids.includes(n.id)).map(n => <button key={n.id} className="text-button" onClick={() => editor.select([n.id])}>{n.recipeId ? RECIPE_MAP[n.recipeId].title : n.parts.map(s => SYMBOL_MAP[s].name).join(' + ')}</button>)}</div>
      <button className="button outline full" onClick={() => editor.deleteSelection()}><Icon name="trash"/>Удалить группу</button>
    </> : !node ? <>
      <div className="intro-glyph"><Formula tex="m+g"/></div><h2 className="serif">Маленький символ.<br />Большое открытие.</h2><p className="muted">Переместите <Formula tex="g"/> на <Formula tex="m"/>. Получится сила тяжести — и тело начнёт падать.</p>
      <div className="first-recipe"><span>Первый эксперимент</span><Formula tex="F=mg"/><button className="button dark" onClick={() => store.openRecipe('weight')}>Показать действие <Icon name="arrow" size={16}/></button></div>
      <div className="mini-guide"><span>01</span><p>Соединяйте переменные</p><span>02</span><p>Изменяйте параметры</p><span>03</span><p>Наблюдайте закономерности</p></div>
      <button className="button outline full" onClick={onBook}><Icon name="book"/> Открыть книгу формул</button>
    </> : recipe && reading ? <>
      <div className="recipe-meta">{TOPICS.find(t => t.id === recipe.topic)?.short} <span>· {recipe.grade} кл.</span></div>
      <h2 className="recipe-title">{recipe.title}</h2><div className="inspector-formula"><Formula tex={recipe.tex} block/></div>
      <div className="reading" aria-live="off"><span className="reading-label">{['decay','hooke','induction'].includes(recipe.id) ? 'На текущий момент' : 'Расчёт по формуле'}</span><div><strong data-testid="reading-value">{reading.note === 'Полное внутреннее отражение' ? 'ПВО' : formatValue(reading.value)}</strong><span>{reading.note === 'Полное внутреннее отражение' ? '' : reading.unit}</span></div>{reading.note && <small>{reading.note}</small>}</div>
      <div className="object-transform"><button className="text-button" title="R · +15°; Q / Shift+R · −15°" onClick={() => editor.rotate()}><Icon name="rotate" size={16}/>Повернуть</button><span data-testid="object-angle">{node.rotation ?? 0}°</span><button className="text-button" title="Ctrl+D" aria-label="Копия выбранного объекта" onClick={() => editor.duplicate()}><Icon name="copy" size={16}/></button></div>
      {partHint(node) && <section className="part-hint" aria-label="Управление деталями"><p>{partHint(node)}</p><small>Alt + перенос или режим «Установка» — переместить целиком.</small></section>}
      {currentX!==null&&<p className="live-displacement">x(t) = <output data-testid="live-extension">{formatValue(currentX)} м</output><small> x ниже задаёт начальное смещение при перезапуске.</small></p>}
      <SpeedReadout nodeId={node.id}/><ParameterControls node={node} definitions={recipe.params}/>
      {recipe.lab === 'circuits' && <button className="button outline full" onClick={() => store.toggleCircuit(node.id)}>{node.closed ? 'Разомкнуть цепь' : 'Замкнуть цепь'} <span className={`circuit-dot ${node.closed ? 'is-on' : ''}`}/></button>}
      {isApparatus(node) && <button className="button outline full" onClick={() => { if (state.lab === 'sandbox') store.focus(node.id); else store.patch({ lab: 'sandbox', activeId: null }); }}>{state.lab === 'sandbox' ? 'Развернуть лабораторию' : 'Вернуть на общий холст'} <Icon name="arrow" size={16}/></button>}
      <button className="button outline full restart-experiment" onClick={() => store.restart(node.id)}><Icon name="reset" size={16}/> Перезапустить опыт</button>
      {exactRecipes(node.parts).length > 1 && <div className="variants"><span className="section-caption">Те же символы, другой закон</span>{exactRecipes(node.parts).filter(r => r.id !== recipe.id).map(r => <button key={r.id} className="variant" onClick={() => store.variant(node.id, r.id)}><Formula tex={r.tex}/><Icon name="arrow" size={14}/></button>)}</div>}
      <section className="explanation"><h3>Физический закон</h3><p>{recipe.description}</p></section><details className="model-note"><summary>Границы учебной модели</summary><p>{recipe.model}</p></details>
      <details className="symbol-details"><summary>Обозначения и единицы</summary>{recipe.inputs.map(id => <p key={id}><Formula tex={SYMBOL_MAP[id].tex}/> — {SYMBOL_MAP[id].name}, {SYMBOL_MAP[id].unit}{SYMBOL_MAP[id].constant && <small> = {SYMBOL_MAP[id].constant}</small>}</p>)}</details>
      {possibilities.some(r => r.inputs.length > node.parts.length) && <section className="next-steps"><h3>Продолжить комбинацию</h3>{possibilities.filter(r => r.inputs.length > node.parts.length).slice(0, 2).map(r => <div key={r.id}><span>{r.title}</span>{missingParts(node.parts, r).map(id => <button key={id} onClick={() => store.dropSymbol(id, node.id)} title={`Добавить ${SYMBOL_MAP[id].name}`}><span>+</span><Formula tex={SYMBOL_MAP[id].tex}/></button>)}</div>)}</section>}
    </> : <>
      <div className="intro-glyph"><Formula tex={node.parts.map(id => SYMBOL_MAP[id].tex).join('\\,')}/></div><h2 className="serif">{node.parts.length === 1 ? SYMBOL_MAP[node.parts[0]].name : 'Промежуточная комбинация'}</h2><p className="muted">{node.parts.length === 1 ? `Единица СИ: ${SYMBOL_MAP[node.parts[0]].unit}. ` : ''}{standaloneDescription(node)}</p>
      <div className="object-transform"><button className="text-button" title="R · +15°; Q / Shift+R · −15°" onClick={() => editor.rotate()}><Icon name="rotate" size={16}/>Повернуть</button><span data-testid="object-angle">{node.rotation ?? 0}°</span><button className="text-button" title="Ctrl+D" aria-label="Копия выбранного объекта" onClick={() => editor.duplicate()}><Icon name="copy" size={16}/></button></div>
      <SpeedReadout nodeId={node.id}/><ParameterControls node={node} definitions={standaloneParameters(node.parts)}/>
      {standaloneParameters(node.parts).length > 0 && <button className="button outline full restart-experiment" onClick={() => store.restart(node.id)}><Icon name="play" size={16}/> Повторить с заданной скоростью</button>}
      <h3 className="section-caption standalone-next">Что можно получить</h3><div className="suggestions">{possibilities.map(r => <div className="suggestion" key={r.id}><span>{r.title}</span><Formula tex={r.tex}/><div>{missingParts(node.parts, r).map(id => <button key={id} title={`Добавить ${SYMBOL_MAP[id].name}`} onClick={() => store.dropSymbol(id, node.id)}><span>+</span><Formula tex={SYMBOL_MAP[id].tex}/></button>)}</div></div>)}</div>
      <button className="text-button" onClick={onBook}>Все рецепты <Icon name="arrow" size={16}/></button>
    </>}</div>
    <div className="inspector-footnote"><span className="tiny-dot"/> Числа — физика. Масштаб — визуализация.</div>
  </aside>;
}
