/** Dependency-light audit. Runs the actual core Vitest cases through node:test assertions,
 * plus real effect functions against a recording Canvas interface (not a physics test).
 * Normal CI additionally runs Vitest, Matter tests, Playwright and the Vite production build.
 * TYPESCRIPT_PATH is useful in an offline environment with an existing TypeScript installation.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_PATH || 'typescript');
const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'formula-audit-'));
const shim = `import assert from 'node:assert/strict';export {describe,it} from 'node:test';
export const expect=(actual)=>({
 toBe:expected=>assert.equal(actual,expected),toEqual:expected=>assert.deepEqual(actual,expected),
 toBeTruthy:()=>assert.ok(actual),toBeDefined:()=>assert.notEqual(actual,undefined),toBeUndefined:()=>assert.equal(actual,undefined),
 toBeGreaterThan:x=>assert.ok(actual>x,actual+' > '+x),toBeLessThan:x=>assert.ok(actual<x,actual+' < '+x),
 toBeGreaterThanOrEqual:x=>assert.ok(actual>=x),toBeLessThanOrEqual:x=>assert.ok(actual<=x),
 toHaveLength:x=>assert.equal(actual.length,x),toContain:x=>assert.ok(actual.includes(x)),
 toBeCloseTo:(x,d=2)=>assert.ok(Math.abs(actual-x)<.5*10**(-d),actual+' ≈ '+x),
 toThrow:()=>assert.throws(actual)
});`;
let parsed = 0;
async function walk(dir) {
    for (const entry of await fs.readdir(path.join(root, dir), { withFileTypes: true })) {
        const rel = path.join(dir, entry.name), full = path.join(root, rel);
        if (entry.isDirectory())
            await walk(rel);
        else if (/\.tsx?$/.test(rel)) {
            const result = ts.transpileModule(await fs.readFile(full, 'utf8'), { fileName: rel, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, verbatimModuleSyntax: true } });
            for (const d of result.diagnostics || [])
                if (d.category === ts.DiagnosticCategory.Error)
                    throw new Error(rel + ': ' + ts.flattenDiagnosticMessageText(d.messageText, ' '));
            const out = path.join(tmp, rel.replace(/\.tsx?$/, '.js'));
            await fs.mkdir(path.dirname(out), { recursive: true });
            await fs.writeFile(out, result.outputText.replace(/(from\s*['"])(\.[^'"]+)(['"])/g, (_, a, b, c) => a + b + (path.extname(b) ? '' : '.js') + c).replace(/from ['"]vitest['"]/g, "from '../assertions.mjs'"));
            parsed++;
        }
    }
}
try {
    await fs.writeFile(path.join(tmp, 'package.json'), '{"type":"module"}');
    await fs.writeFile(path.join(tmp, 'assertions.mjs'), shim);
    await walk('src');
    await walk('tests');
    console.log('Syntax transpilation:', parsed, 'TypeScript files; TypeScript', ts.version);
    const result = spawnSync(process.execPath, ['--test', ...['catalog', 'crafting', 'persistence'].map(x => path.join(tmp, 'tests', x + '.test.js'))], { stdio: 'inherit' });
    if (result.status !== 0)
        throw new Error('Core audit failed');
    const { RECIPES, defaults } = await import('file://' + path.join(tmp, 'src/core/catalog.js'));
    const { EFFECTS } = await import('file://' + path.join(tmp, 'src/rendering/effects.js'));
    const { initialState } = await import('file://' + path.join(tmp, 'src/core/store.js'));
    let commands = 0, scenes = 0;
    const context = new Proxy({}, { get(_t, name) { if (name === 'measureText')
            return t => ({ width: t.length * 9 }); if (name === 'createLinearGradient' || name === 'createRadialGradient')
            return () => ({ addColorStop() { } }); return (...args) => { for (const a of args)
            if (typeof a === 'number' && !Number.isFinite(a))
                throw new Error('Non-finite Canvas argument: ' + String(name)); commands++; }; }, set() { return true; } });
    const body = { position: { x: 480, y: 340 }, velocity: { x: 1, y: 1 }, mass: 2, speed: Math.sqrt(2) };
    for (const recipe of RECIPES) {
        const cases = [defaults(recipe), ...recipe.params.flatMap(p => [p.min, p.max].map(value => ({ ...defaults(recipe), [p.key]: value })))];
        for (const params of cases)
            for (const age of [0, 1, 10]) {
                const node = { id: 'audit', parts: recipe.inputs, recipeId: recipe.id, params, x: 480, y: 160, revision: 0, closed: true };
                const world = { bodies: new Map([['audit/0', { key: 'audit/0', body, radius: 18, label: 'm', trail: [] }]]), absorbed: new Set() };
                EFFECTS[recipe.id]({ c: context, node, age, time: age, state: initialState(), world });
                scenes++;
            }
    }
    console.log(JSON.stringify({ recipeCount: RECIPES.length, renderCases: scenes, recordedCanvasCommands: commands, physicsEngine: 'NOT_RUN', viteBuild: 'NOT_RUN' }, null, 2));
}
finally {
    await fs.rm(tmp, { recursive: true, force: true });
}
