/** Kenney CC0 samples, bundled with the app. Provenance: public/audio/credits.json. */
export const SOUNDS = {
    click: { file: 'click.wav', gain: .22, cooldown: 55 },
    drop: { file: 'drop.wav', gain: .23, cooldown: 75 },
    craft: { file: 'craft.wav', gain: .28, cooldown: 140 },
    discovery: { file: 'discovery.wav', gain: .32, cooldown: 240 },
    remove: { file: 'remove.wav', gain: .20, cooldown: 100 },
    error: { file: 'error.wav', gain: .19, cooldown: 400 },
    impactSoft: { file: 'impact-soft.wav', gain: .30, cooldown: 100 },
    impactHard: { file: 'impact-hard.wav', gain: .28, cooldown: 100 },
    absorb: { file: 'absorb.wav', gain: .12, cooldown: 300 },
    blackhole: { file: 'blackhole.wav', gain: .33, cooldown: 900 },
} as const;
export type SoundId = keyof typeof SOUNDS;
export const SOUND_IDS = Object.keys(SOUNDS) as SoundId[];
export const MAX_SFX_VOICES = 8;
export const MAX_SOUND_AGE_MS = 450;
