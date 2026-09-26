import { standaloneParameters } from './entities';
import { RECIPE_MAP, RECIPES } from './catalog';
import { multisetContains } from './crafting';
import { SYMBOL_MAP } from './symbols';
import { MAX_BODIES, MAX_NODES } from './types';
import type { BodySnapshot, Discovery, FormulaNode, GameState, RuntimeSnapshot, SavedExperiment, LabState } from './types';

const AUTO = 'formula-alchemy:autosave:v1', SLOTS = 'formula-alchemy:slots:v1';
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const str = (v: unknown, max = 120): v is string => typeof v === 'string' && v.length > 0 && v.length <= max;
const softStr = (v: unknown, max = 120): v is string => typeof v === 'string' && v.length <= max;
const fail = (): never => {
  throw new Error('Файл повреждён или содержит недопустимые параметры.');
};
const bool = (v: unknown): boolean => typeof v === 'boolean' ? v : fail();

export function validateSave(input: unknown): SavedExperiment {
  if (!isObject(input) || input.version !== 1) throw new Error('Неподдерживаемая версия эксперимента. Нужен файл Formula Alchemy v1.');
  if (!str(input.id) || !str(input.name, 80) || !str(input.savedAt) || !Number.isFinite(Date.parse(input.savedAt))) return fail();

  const s = input.state, r = input.runtime;
  if (!isObject(s) || !isObject(r)) return fail();
  if (!Array.isArray(s.nodes) || s.nodes.length > MAX_NODES || !Array.isArray(s.discoveries) || s.discoveries.length > RECIPES.length) return fail();

  const ids = new Set<string>();
  const nodes: FormulaNode[] = s.nodes.map((n: unknown) => {
    if (!isObject(n) || !str(n.id) || ids.has(n.id) || !Array.isArray(n.parts) || n.parts.length < 1 || n.parts.length > 5 || !n.parts.every(x => typeof x === 'string' && Object.hasOwn(SYMBOL_MAP, x))) return fail();
    ids.add(n.id);
    if (!num(n.x, 0, 1000) || !num(n.y, 0, 680) || !num(n.revision, 0, 1e9) || !Number.isInteger(n.revision) || !isObject(n.params)) return fail();

    if (n.rotation !== undefined && !num(n.rotation, 0, 359.99999999)) return fail();
    const params: Record<string, number> = {};
    let recipeId: string | undefined;
    if (n.recipeId !== undefined) {
      if (typeof n.recipeId !== 'string' || !Object.hasOwn(RECIPE_MAP, n.recipeId)) return fail();
      const recipe = RECIPE_MAP[n.recipeId];
      if (n.parts.length !== recipe.inputs.length || !multisetContains(recipe.inputs, n.parts as string[])) return fail();
      recipeId = n.recipeId;
      for (const p of recipe.params) {
        const value = n.params[p.key];
        if (!num(value, p.min, p.max)) return fail();
        const ticks = (value - p.min) / p.step;
        if (Math.abs(ticks - Math.round(ticks)) > 1e-5) return fail();
        params[p.key] = value;
      }
    } else {
      if (!RECIPES.some(rec => multisetContains(rec.inputs, n.parts as string[]))) return fail();
      for (const p of standaloneParameters(n.parts as string[])) {
        const value = n.params[p.key] ?? p.initial; // v1 saves had no standalone parameters
        if (!num(value, p.min, p.max)) return fail();
        const ticks = (value - p.min) / p.step;
        if (Math.abs(ticks - Math.round(ticks)) > 1e-5) return fail();
        params[p.key] = value;
      }
    }

    return { id: n.id, parts: [...n.parts] as string[], x: n.x, y: n.y, recipeId, params, ...(n.rotation !== undefined ? { rotation: n.rotation as number } : {}), revision: n.revision, closed: bool(n.closed) };
  });

  const discoveries: Discovery[] = s.discoveries.map((d: unknown) => {
    if (!isObject(d) || !str(d.recipeId) || !Object.hasOwn(RECIPE_MAP, d.recipeId) || !str(d.at) || !Number.isFinite(Date.parse(d.at)) || (d.source !== 'craft' && d.source !== 'book')) return fail();
    return { recipeId: d.recipeId, at: d.at, source: d.source };
  });
  if (new Set(discoveries.map(d => d.recipeId)).size !== discoveries.length) return fail();

  for (const k of ['selectedId', 'activeId'] as const) {
    if (s[k] !== null && (typeof s[k] !== 'string' || !ids.has(s[k] as string))) return fail();
  }
  if (![0.25, 0.5, 1, 2, 4].includes(s.speed as number) || !['sandbox', 'thermal', 'circuits', 'magnetic', 'waves', 'optics', 'quantum', 'relativity'].includes(s.lab as string)) return fail();
  if (s.lab !== 'sandbox') {
    const active = nodes.find(n => n.id === s.activeId);
    if (!active?.recipeId || RECIPE_MAP[active.recipeId].lab !== s.lab) return fail();
  }

  if (!num(r.time, 0, 1e8) || !isObject(r.ages) || !Array.isArray(r.bodies) || r.bodies.length > MAX_BODIES || !Array.isArray(r.absorbed) || r.absorbed.length > MAX_BODIES * 2) return fail();

  const ages: Record<string, number> = {};
  for (const [id, age] of Object.entries(r.ages)) {
    if (!ids.has(id) || !num(age, 0, 1e8)) return fail();
    ages[id] = age;
  }

  const bodyKeys = new Set<string>();
  const bodies: BodySnapshot[] = r.bodies.map((b: unknown) => {
    if (!isObject(b) || !str(b.key) || bodyKeys.has(b.key) || !str(b.owner) || (!ids.has(b.owner) && b.owner !== 'free') || !softStr(b.label, 40)) return fail();
    for (const k of ['x', 'y'] as const) if (!num(b[k], -100, 1100)) return fail();
    for (const k of ['vx', 'vy'] as const) if (!num(b[k], -100, 100)) return fail();
    if (!num(b.angle, -1e6, 1e6) || !num(b.av, -10, 10) || !num(b.mass, 0.01, 1e4) || !num(b.radius, 5, 60)) return fail();
    bodyKeys.add(b.key);
    return { key: b.key, owner: b.owner, x: b.x as number, y: b.y as number, vx: b.vx as number, vy: b.vy as number, angle: b.angle, av: b.av, mass: b.mass, radius: b.radius, label: b.label };
  });

  if (!r.absorbed.every(x => softStr(x))) return fail();

  if (s.selectedIds !== undefined && (!Array.isArray(s.selectedIds) || s.selectedIds.length > MAX_NODES || !s.selectedIds.every(id => typeof id === 'string' && ids.has(id)) || new Set(s.selectedIds).size !== s.selectedIds.length)) return fail();
  const anchors: Record<string, { x: number; y: number }> = {};
  const motions: Record<string, { vx: number; vy: number }> = {};
  for (const name of ['anchors', 'motions'] as const) {
    if (r[name] === undefined) continue;
    if (!isObject(r[name])) return fail();
    for (const [id, value] of Object.entries(r[name])) {
      if (!ids.has(id) || !isObject(value)) return fail();
      if (name === 'anchors') {
        if (!num(value.x, -10000, 10000) || !num(value.y, -10000, 10000)) return fail();
        anchors[id] = { x: value.x, y: value.y };
      } else {
        if (!num(value.vx, -1e6, 1e6) || !num(value.vy, -1e6, 1e6)) return fail();
        motions[id] = { vx: value.vx, vy: value.vy };
      }
    }
  }
  const labStates: Record<string, LabState> = {};
  if (r.labStates !== undefined) {
    if (!isObject(r.labStates) || Object.keys(r.labStates).length > MAX_NODES) return fail();
    for (const [id, value] of Object.entries(r.labStates)) {
      const n = nodes.find(n => n.id === id);
      if (!n || !isObject(value) || !num(value.epoch, 0, 1e8) || !num(value.position, -1e5, 1e5) || !num(value.velocity, -1e5, 1e5)) return fail();
      const expected = ['pendulum','springPeriod'].includes(n.recipeId ?? '') ? 'oscillator' : ['density','buoyancy'].includes(n.recipeId ?? '') ? 'fluid' : n.recipeId === 'gravitation' ? 'orbit' : n.recipeId === 'induction' ? 'induction' : null;
      if (value.kind !== expected || expected === null) return fail();
      if (n.recipeId === 'pendulum' && (Math.abs(value.position) > Math.PI/6 || Math.abs(value.velocity) > 10)) return fail();
      if (n.recipeId === 'springPeriod' && (Math.abs(value.position) > 4 || Math.abs(value.velocity) > 100)) return fail();
      if (expected === 'fluid' && !num(value.position, 100, 550)) return fail();
      if (expected === 'induction' && !num(value.position, 160, 520)) return fail();
      labStates[id] = { kind: expected, position: value.position, velocity: value.velocity, epoch: value.epoch };
    }
  }
  const state: GameState = {
    nodes,
    discoveries,
    selectedId: s.selectedId as string | null,
    ...(s.selectedIds !== undefined ? { selectedIds: s.selectedIds as string[] } : {}),
    activeId: s.activeId as string | null,
    lab: s.lab as GameState['lab'],
    paused: bool(s.paused),
    speed: s.speed as number,
    grid: bool(s.grid),
    vectors: bool(s.vectors),
    speeds: s.speeds === undefined ? true : bool(s.speeds),
    trails: bool(s.trails),
    music: bool(s.music),
    sound: bool(s.sound),
  };

  return { version: 1, id: input.id, name: input.name, savedAt: input.savedAt, state, runtime: { time: r.time, ages, bodies, absorbed: r.absorbed as string[], ...(r.anchors !== undefined ? { anchors } : {}), ...(r.motions !== undefined ? { motions } : {}), ...(r.labStates !== undefined ? { labStates } : {}) } };
}

export function parseSave(text: string): SavedExperiment {
  if (text.length > 500000) throw new Error('Файл слишком большой. Максимум 500 КБ.');
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('Не удалось прочитать JSON эксперимента.');
  }
  return validateSave(value);
}

export function makeSave(state: GameState, runtime: RuntimeSnapshot, name: string): SavedExperiment {
  return { version: 1, id: globalThis.crypto?.randomUUID?.() ?? String(Date.now()), name: name.trim().slice(0, 80) || 'Без названия', savedAt: new Date().toISOString(), state: structuredClone(state), runtime: structuredClone(runtime) };
}

export function readAuto(): SavedExperiment | null {
  const raw = localStorage.getItem(AUTO);
  if (!raw) return null;
  try {
    return parseSave(raw);
  } catch {
    throw new Error('Автосохранение повреждено; исходный JSON сохранён.');
  }
}

export function writeAuto(save: SavedExperiment) {
  const clean = validateSave(save);
  const old = localStorage.getItem(AUTO);
  if (old) { try { parseSave(old); } catch { localStorage.setItem(`${AUTO}:recovery`, old); } }
  localStorage.setItem(AUTO, JSON.stringify(clean));
}

export function readSlots(): SavedExperiment[] {
  const raw = localStorage.getItem(SLOTS);
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) {
    return [];
  }
  const valid: SavedExperiment[] = [];
  for (const entry of data.slice(0, 8)) {
    try {
      valid.push(validateSave(entry));
    } catch {
      // skip corrupted slot instead of breaking the whole save manager
    }
  }
  return valid;
}

export function writeSlot(save: SavedExperiment) {
  const clean = validateSave(save);
  const previous = localStorage.getItem(SLOTS);
  if (previous) localStorage.setItem(`${SLOTS}:recovery`, previous);
  const slots = readSlots().filter(s => s.id !== clean.id);
  localStorage.setItem(SLOTS, JSON.stringify([clean, ...slots].slice(0, 8)));
}

export function deleteSlot(id: string) {
  localStorage.setItem(SLOTS, JSON.stringify(readSlots().filter(s => s.id !== id)));
}

export function exportSave(save: SavedExperiment) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(validateSave(save), null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `formula-alchemy-${save.savedAt.slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
