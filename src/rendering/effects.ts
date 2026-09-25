import { fieldEffects } from './fields';
import { mechanicsEffects } from './labs/mechanics';
import { thermalEffects } from './labs/thermal';
import { circuitEffects } from './labs/circuits';
import { magneticEffects } from './labs/magnetic';
import { waveEffects } from './labs/waves';
import { opticsEffects } from './labs/optics';
import { quantumEffects } from './labs/quantum';
import { relativityEffects } from './labs/relativity';
import type { EffectRenderer } from './primitives';
/** Adding a recipe without an actual effect fails the catalogue test. */
export const EFFECTS: Record<string, EffectRenderer> = { ...fieldEffects, ...mechanicsEffects, ...thermalEffects, ...circuitEffects, ...magneticEffects, ...waveEffects, ...opticsEffects, ...quantumEffects, ...relativityEffects };
