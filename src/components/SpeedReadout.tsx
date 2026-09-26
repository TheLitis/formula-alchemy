import { useGame, useRuntimeTick } from '../app/session';
import { collectSpeedReadings, speedText } from '../physics/speedReadings';

export function SpeedReadout({ nodeId }: { nodeId: string }) {
    const state = useGame(), runtime = useRuntimeTick();
    const readings = collectSpeedReadings(state, runtime.world, runtime.ages, runtime.labStates).filter(r => r.nodeId === nodeId);
    if (!readings.length) return null;
    return <section className="speed-readout" aria-label="Текущая скорость" data-testid="speed-readout">
        <h3>{readings[0].prefix === 'волна' ? 'Скорость распространения' : 'Текущая скорость'}</h3>
        {readings.map(r => <div key={r.key}><span>{r.label}</span><output data-speed-key={r.key}>{speedText(r)}</output></div>)}
        <small>Физическая скорость, не скорость указателя или воспроизведения.</small>
    </section>;
}
