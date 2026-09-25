import { useSession } from '../app/session';
import type { FormulaNode, Parameter } from '../core/types';
import { Formula } from './Formula';

export function ParameterControls({ node, definitions }: { node: FormulaNode; definitions: Parameter[] }) {
    const { store } = useSession();
    return <div className="parameter-list">{definitions.map(p => <div className="parameter" key={p.key}>
        <label htmlFor={`param-${p.key}`}><span><Formula tex={p.symbol}/> {p.name}</span><small>{p.unit}</small></label>
        <div className="range-row">
            <input id={`param-${p.key}`} type="range" min={p.min} max={p.max} step={p.step} value={node.params[p.key] ?? p.initial} onChange={e => store.setParam(node.id, p.key, e.currentTarget.valueAsNumber)}/>
            <input className="number-input" aria-label={`${p.name}, численно`} type="number" min={p.min} max={p.max} step={p.step} value={node.params[p.key] ?? p.initial} onChange={e => store.setParam(node.id, p.key, e.currentTarget.valueAsNumber)}/>
        </div>
    </div>)}</div>;
}
