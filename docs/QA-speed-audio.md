# QA: speeds and CC0 samples

Base: main `51d4ba8` (merged PR #1). No redesign or change to the 48 recipes.

## Local checks completed

- 152/152 Vitest tests passed (8 files); includes the previous 124 regressions.
- TypeScript and Vite production build passed, with the exact installed lockfile dependencies.
- 65 local HTML/CSS resource paths and 10 bundled WAV hashes verified.
- Actual CC0 sample files downloaded from Kenney; original licenses retained. WAV peaks ≤ -3 dBFS; 44.1 kHz / 16 bit mono; 414266 bytes combined.

## Browser verification

36 Playwright scenarios defined: 22 existing direct-manipulation regressions and 14 new desktop/mobile speed/audio cases. Full HTTP verification runs in GitHub Actions under `/formula-alchemy/`. This section will be updated with the completed run before handoff.

Browser plugin not available. Local Chromium rejects localhost with a managed URL policy; it is not bypassed. CI uses an independent, ordinary HTTP browser test environment, real React/Matter.js/Web Audio and the real decoded WAV files. Unit audio lifecycle tests use mocks and are not represented as listening tests.

## Limits

Wave labels mean propagation speed. Analytic orbit time is accelerated only visually. No material speeds are invented for decorative or uncalibrated animation. Label collision avoidance may suppress labels in dense scenes; the selected object's inspector retains the readout. No real iPhone/Safari or listening-on-speakers evaluation is claimed. Optional background music is unchanged and procedural.
