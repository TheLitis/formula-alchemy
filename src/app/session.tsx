import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { GameStore } from '../core/store';
import { makeSave, readAuto, writeAuto } from '../core/persistence';
import { SimulationRuntime } from '../physics/Runtime';
import type { SavedExperiment } from '../core/types';
export function createSession() {
    let saved: SavedExperiment | null = null, storageError = '';
    try {
        saved = readAuto();
    }
    catch {
        storageError = 'Автосохранение не прочитано. Начат новый опыт; файл не перезаписан до следующего сохранения.';
    }
    const store = new GameStore(saved ? { ...saved.state, music: false } : undefined), runtime = new SimulationRuntime(store), audio = new AudioEngine();
    if (saved)
        runtime.restore(saved.runtime);
    audio.sound = store.getState().sound;
    audio.onError = text => store.notify(text);
    store.onFeedback = event => audio[event]();
    runtime.world.onCollision = (strength, x) => audio.impact(strength, x);
    runtime.onCaptureFeedback = x => audio.absorb(x);
    const stopAudioSync = store.subscribe(() => { audio.sound = store.getState().sound; audio.setMusic(store.getState().music); });
    return { store, runtime, audio, storageError, snapshot: (name = 'Автосохранение') => makeSave(store.getState(), runtime.snapshot(), name), dispose: () => { stopAudioSync(); store.onFeedback = () => {}; runtime.dispose(); audio.dispose(); } };
}
export type Session = ReturnType<typeof createSession>;
export const SessionContext = createContext<Session | null>(null);
export function useSession() { const session = useContext(SessionContext); if (!session)
    throw new Error('Нет сессии'); return session; }
export function useGame() { const { store } = useSession(); return useSyncExternalStore(store.subscribe, store.getState, store.getState); }
export function useRuntimeTick() { const [, tick] = useState(0); useEffect(() => { const timer = setInterval(() => tick(n => n + 1), 250); return () => clearInterval(timer); }, []); return useSession().runtime; }
export function useAutoSave() {
    const session = useSession();
    useEffect(() => {
        let warned = false;
        const save = () => { try {
            writeAuto(session.snapshot());
        }
        catch {
            if (!warned) {
                warned = true;
                session.store.notify('Браузер запретил сохранение. Экспортируйте опыт в JSON.', 'error');
            }
        } };
        const timer = setInterval(save, 10000);
        window.addEventListener('pagehide', save);
        return () => { clearInterval(timer); window.removeEventListener('pagehide', save); };
    }, [session]);
}
