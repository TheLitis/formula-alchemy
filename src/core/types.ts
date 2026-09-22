export type Topic = 'mechanics' | 'thermal' | 'electricity' | 'magnetism' | 'waves' | 'optics' | 'quantum' | 'nuclear' | 'relativity';
export type Lab = 'sandbox' | 'thermal' | 'circuits' | 'magnetic' | 'waves' | 'optics' | 'quantum' | 'relativity';
export interface SymbolDef {
    id: string;
    tex: string;
    name: string;
    unit: string;
    topic: Topic;
    constant?: string;
}
export interface Parameter {
    key: string;
    symbol: string;
    name: string;
    unit: string;
    min: number;
    max: number;
    step: number;
    initial: number;
}
export interface Recipe {
    id: string;
    title: string;
    tex: string;
    inputs: string[];
    topic: Topic;
    lab: Lab;
    grade: string;
    description: string;
    model: string;
    effect: string;
    params: Parameter[];
    unit: string;
}
export interface FormulaNode {
    id: string;
    parts: string[];
    x: number;
    y: number;
    recipeId?: string;
    params: Record<string, number>;
    revision: number;
    closed: boolean;
}
export interface Discovery {
    recipeId: string;
    at: string;
    source: 'craft' | 'book';
}
export interface GameState {
    nodes: FormulaNode[];
    selectedId: string | null;
    discoveries: Discovery[];
    paused: boolean;
    speed: number;
    grid: boolean;
    vectors: boolean;
    trails: boolean;
    music: boolean;
    sound: boolean;
    lab: Lab;
    activeId: string | null;
}
export interface BodySnapshot {
    key: string;
    owner: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    av: number;
    mass: number;
    radius: number;
    label: string;
}
export interface RuntimeSnapshot {
    time: number;
    ages: Record<string, number>;
    bodies: BodySnapshot[];
    absorbed: string[];
}
export interface SavedExperiment {
    version: 1;
    id: string;
    name: string;
    savedAt: string;
    state: GameState;
    runtime: RuntimeSnapshot;
}
export interface Reading {
    value: number;
    unit: string;
    note?: string;
}
export interface Viewport {
    scale: number;
    ox: number;
    oy: number;
    width: number;
    height: number;
}
export const WIDTH = 1000;
export const HEIGHT = 680;
export const MAX_NODES = 32;
export const MAX_BODIES = 56;
export const PX_PER_M = 32;
