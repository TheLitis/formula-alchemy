/** Original procedural soundtrack. No network, samples, cookies or microphone. */
export class AudioEngine {
    private ctx: AudioContext | null = null;
    private bus: GainNode | null = null;
    private timer: ReturnType<typeof setInterval> | null = null;
    private step = 0;
    private lastImpact = 0;
    sound = true;
    music = false;
    async unlock() {
        if (!this.ctx) {
            this.ctx = new AudioContext();
            this.bus = this.ctx.createGain();
            this.bus.gain.value = 0.22;
            this.bus.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended')
            await this.ctx.resume();
    }
    private tone(frequency: number, duration: number, gain: number, type: OscillatorType = 'sine', offset = 0) {
        if (!this.ctx || !this.bus || this.ctx.state !== 'running')
            return;
        const now = this.ctx.currentTime + offset, osc = this.ctx.createOscillator(), env = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = frequency;
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(gain, now + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        osc.connect(env);
        env.connect(this.bus);
        osc.start(now);
        osc.stop(now + duration + 0.02);
        osc.onended = () => { osc.disconnect(); env.disconnect(); };
    }
    click() { if (this.sound)
        this.tone(520, 0.05, 0.12); }
    discovery() { if (this.sound)
        [261.63, 329.63, 392].forEach((n, i) => this.tone(n, 0.45, 0.17, 'sine', i * 0.09)); }
    impact() { const now = performance.now(); if (this.sound && now - this.lastImpact > 180) {
        this.lastImpact = now;
        this.tone(100, 0.06, 0.12, 'triangle');
    } }
    setMusic(enabled: boolean) {
        this.music = enabled;
        if (this.timer)
            clearInterval(this.timer);
        this.timer = null;
        if (!enabled)
            return;
        const notes = [130.81, 196, 261.63, 329.63, 146.83, 220, 293.66, 349.23, 110, 164.81, 220, 261.63, 130.81, 196, 293.66, 392];
        const tick = () => { if (document.hidden)
            return; this.tone(notes[this.step % notes.length], 1.35, 0.13, 'sine'); if (this.step % 4 === 0)
            this.tone(notes[this.step % notes.length] / 2, 1.8, 0.09, 'triangle'); this.step++; };
        tick();
        this.timer = setInterval(tick, 375);
    }
    setVolume(value: number) { if (this.ctx && this.bus)
        this.bus.gain.setTargetAtTime(Math.min(1, Math.max(0, value)) * 0.4, this.ctx.currentTime, 0.05); }
    dispose() { if (this.timer)
        clearInterval(this.timer); this.timer = null; void this.ctx?.close().catch(() => { }); this.ctx = null; }
}
