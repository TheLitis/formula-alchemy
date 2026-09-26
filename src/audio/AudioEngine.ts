import { MAX_SFX_VOICES, MAX_SOUND_AGE_MS, SOUNDS, SOUND_IDS } from './sounds';
import type { SoundId } from './sounds';

interface Voice { source: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode }
/** Bundled sound effects + the licensed, optional NCS music track. */
export class AudioEngine {
    private ctx: AudioContext | null = null;
    private master: GainNode | null = null;
    private sfxBus: GainNode | null = null;
    private musicBus: GainNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;
    private musicElement: HTMLAudioElement | null = null;
    private musicSource: MediaElementAudioSourceNode | null = null;
    private voices = new Set<Voice>();
    private buffers = new Map<SoundId, AudioBuffer>();
    private loads = new Map<SoundId, Promise<AudioBuffer | null>>();
    private controllers = new Set<AbortController>();
    private last = new Map<string, number>();
    private played = new Map<SoundId, number>();
    private failed = new Set<SoundId>();
    private epoch = 0;
    private disposed = false;
    private volume = 1;
    private musicErrorReported = false;
    private _sound = true;
    private _music = false;
    onError: (message: string) => void = () => {};
    onMusicFailure: () => void = () => {};
    constructor(private baseUrl = import.meta.env.BASE_URL) {}
    get sound() { return this._sound; }
    set sound(enabled: boolean) {
        if (this._sound === enabled) return;
        this._sound = enabled;
        this.epoch++; // cancel pending decodes too: muting must never replay an old action
        if (this.ctx && this.sfxBus) this.sfxBus.gain.setValueAtTime(enabled ? .85 : 0, this.ctx.currentTime);
        if (!enabled) this.stopEffects();
    }
    get music() { return this._music; }

    /** Call from a user gesture. Fetches/decode are cached and never block the game loop. */
    async unlock(): Promise<void> {
        if (this.disposed) return;
        if (!this.ctx) {
            this.ctx = new AudioContext({ latencyHint: 'interactive' });
            this.master = this.ctx.createGain(); this.master.gain.value = .65;
            this.sfxBus = this.ctx.createGain(); this.sfxBus.gain.value = this.sound ? .85 : 0;
            this.musicBus = this.ctx.createGain(); this.musicBus.gain.value = .22;
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.value = -10; this.compressor.knee.value = 6;
            this.compressor.ratio.value = 10; this.compressor.attack.value = .003; this.compressor.release.value = .18;
            this.sfxBus.connect(this.master); this.musicBus.connect(this.master);
            this.master.connect(this.compressor); this.compressor.connect(this.ctx.destination);
            document.addEventListener('visibilitychange', this.visibility);
            this.connectMusicElement();
        }
        // resume must be requested synchronously with the gesture, before any fetch await
        const resumed = this.ctx.state === 'suspended' && !document.hidden ? this.ctx.resume() : Promise.resolve();
        const loading = this.sound ? Promise.all(SOUND_IDS.map(id => this.load(id))) : Promise.resolve();
        await resumed; await loading;
    }
    private load(id: SoundId): Promise<AudioBuffer | null> {
        const cached = this.buffers.get(id);
        if (cached) return Promise.resolve(cached);
        const pending = this.loads.get(id);
        if (pending) return pending;
        const ctx = this.ctx;
        if (!ctx || this.disposed) return Promise.resolve(null);
        const controller = new AbortController(); this.controllers.add(controller);
        const timeout = setTimeout(() => controller.abort(), 6000);
        const promise = (async () => {
            try {
                const response = await fetch(`${this.baseUrl}audio/${SOUNDS[id].file}`, { signal: controller.signal, cache: 'force-cache' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
                if (!this.disposed) this.buffers.set(id, buffer);
                return buffer;
            } catch {
                if (!this.disposed) {
                    this.failed.add(id);
                    if (this.failed.size === 1) this.onError('Не удалось загрузить звуковой эффект. Игра продолжает работать без него.');
                }
                return null;
            } finally {
                clearTimeout(timeout); this.controllers.delete(controller);
            }
        })();
        this.loads.set(id, promise);
        return promise;
    }
    private request(id: SoundId, gain = 1, pan = 0) {
        if (!this.ctx || !this.sound || this.disposed || document.hidden) return;
        const now = performance.now();
        const group = id === 'impactSoft' || id === 'impactHard' ? 'impact' : id;
        if (now - (this.last.get(group) ?? -Infinity) < SOUNDS[id].cooldown) return;
        this.last.set(group, now);
        const epoch = this.epoch;
        void this.load(id).then(buffer => {
            if (!buffer || !this.ctx || !this.sfxBus || !this.sound || this.disposed || document.hidden || epoch !== this.epoch || this.ctx.state !== 'running' || performance.now() - now > MAX_SOUND_AGE_MS) return;
            while (this.voices.size >= MAX_SFX_VOICES) this.stopVoice(this.voices.values().next().value!);
            const source = this.ctx.createBufferSource(), envelope = this.ctx.createGain(), panner = this.ctx.createStereoPanner();
            source.buffer = buffer;
            panner.pan.value = Math.max(-.75, Math.min(.75, pan));
            const t = this.ctx.currentTime, amplitude = SOUNDS[id].gain * Math.max(0, Math.min(1.5, gain));
            envelope.gain.setValueAtTime(0, t);
            envelope.gain.linearRampToValueAtTime(amplitude, t + Math.min(.004, buffer.duration / 4));
            envelope.gain.setValueAtTime(amplitude, t + Math.max(.005, buffer.duration - .012));
            envelope.gain.linearRampToValueAtTime(0, t + buffer.duration);
            source.connect(envelope); envelope.connect(panner); panner.connect(this.sfxBus);
            const voice = { source, gain: envelope, pan: panner }; this.voices.add(voice);
            source.onended = () => { this.voices.delete(voice); source.disconnect(); envelope.disconnect(); panner.disconnect(); };
            source.start(t);
            this.played.set(id, (this.played.get(id) ?? 0) + 1);
        }).catch(() => { /* A lost/closed device must never stop the simulation. */ });
    }
    click() { this.request('click'); }
    drop() { this.request('drop'); }
    craft() { this.request('craft'); }
    discovery() { this.request('discovery'); }
    remove() { this.request('remove'); }
    error() { this.request('error'); }
    switch() { this.request('click', .7); }
    blackhole() { this.request('blackhole'); }
    absorb(x = 500) { this.request('absorb', 1, (x - 500) / 500); }
    impact(strength = 3, x = 500) { this.request(strength > 5 ? 'impactHard' : 'impactSoft', Math.min(1.2, Math.max(.2, strength / 7)), (x - 500) / 500); }
    private stopVoice(voice: Voice) {
        this.voices.delete(voice);
        try { voice.source.stop(); } catch { /* already ended */ }
        voice.source.disconnect(); voice.gain.disconnect(); voice.pan.disconnect();
    }
    private stopEffects() { for (const voice of [...this.voices]) this.stopVoice(voice); }
    private connectMusicElement() {
        if (!this.ctx || !this.musicBus || !this.musicElement || this.musicSource) return;
        try {
            const source = this.ctx.createMediaElementSource(this.musicElement);
            source.connect(this.musicBus);
            this.musicSource = source;
            this.musicElement.volume = 1;
        } catch {
            // Keep the track playable if Web Audio routing is unavailable.
            this.musicElement.volume = this.volume * .22 * .65;
        }
    }
    private getMusicElement(): HTMLAudioElement | null {
        if (typeof Audio === 'undefined') return null;
        if (!this.musicElement) {
            this.musicElement = new Audio(`${this.baseUrl}audio/sky-high.mp3`);
            this.musicElement.loop = true;
            this.musicElement.preload = 'none';
            this.musicElement.volume = this.volume * .22 * .65;
            this.musicElement.addEventListener('error', this.musicFailure);
        }
        this.connectMusicElement();
        return this.musicElement;
    }
    private stopMusic() { this.musicElement?.pause(); }
    private musicFailure = () => {
        if (this.disposed || !this.music || this.musicErrorReported) return;
        this.musicErrorReported = true;
        this._music = false;
        this.stopMusic();
        this.onError('Не удалось воспроизвести музыку. Проверьте подключение и попробуйте ещё раз.');
        this.onMusicFailure();
    };
    setMusic(enabled: boolean) {
        if (this.disposed || enabled === this.music) return;
        this._music = enabled;
        if (!enabled) { this.stopMusic(); return; }
        this.musicErrorReported = false;
        const player = this.getMusicElement();
        if (player) void player.play().catch(this.musicFailure);
    }
    private visibility = () => {
        if (!this.ctx || this.disposed) return;
        if (document.hidden) {
            this.epoch++; this.stopEffects(); this.musicElement?.pause(); void this.ctx.suspend().catch(() => {});
            return;
        }
        if (this.sound || this.music) {
            const resumed = this.ctx.resume();
            if (this.music && this.musicElement) void resumed.then(() => this.musicElement?.play()).catch(this.musicFailure);
            else void resumed.catch(() => {});
        }
    };
    setVolume(value: number) {
        this.volume = Math.max(0, Math.min(1, value));
        if (this.ctx && this.master) this.master.gain.setTargetAtTime(this.volume * .65, this.ctx.currentTime, .03);
        if (this.musicElement && !this.musicSource) this.musicElement.volume = this.volume * .22 * .65;
    }
    /** Read-only diagnostics; exposed to browser tests only through the existing ?qa=1 hook. */
    status() { return { state: this.ctx?.state ?? 'locked', loaded: [...this.buffers.keys()], failed: [...this.failed], activeEffects: this.voices.size, activeNotes: this.musicElement ? Number(!this.musicElement.paused) : Number(this.music && this.ctx?.state === 'running'), played: Object.fromEntries(this.played), sound: this.sound, music: this.music }; }
    dispose() {
        this.disposed = true; this.epoch++; this.stopEffects(); this.stopMusic();
        for (const controller of this.controllers) controller.abort(); this.controllers.clear();
        document.removeEventListener('visibilitychange', this.visibility);
        this.musicSource?.disconnect(); this.musicSource = null;
        if (this.musicElement) {
            this.musicElement.removeEventListener('error', this.musicFailure);
            this.musicElement.removeAttribute('src'); this.musicElement.load(); this.musicElement = null;
        }
        void this.ctx?.close().catch(() => {}); this.ctx = null;
        this.buffers.clear(); this.loads.clear();
    }
}
