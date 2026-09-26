import { G } from '../core/evaluate';
import type { FormulaNode, LabState } from '../core/types';
import { fluidCenter } from './labModels';

/** SI initial conditions shared by drawing, hit testing, persistence and speed labels. */
export function oscillatorMotion(node: FormulaNode, age: number, saved?: LabState) {
    const p = node.params, pendulum = node.recipeId === 'pendulum';
    const omega = Math.sqrt(pendulum ? p.g / p.L : p.k / p.m);
    const initial = saved?.kind === 'oscillator' ? saved : { position: pendulum ? .20944 : p.amplitude, velocity: 0, epoch: 0 };
    const dt = Math.max(0, age - initial.epoch), phase = omega * dt;
    const position = omega > 1e-10 ? initial.position * Math.cos(phase) + initial.velocity / omega * Math.sin(phase) : initial.position + initial.velocity * dt;
    const velocity = omega > 1e-10 ? -initial.position * omega * Math.sin(phase) + initial.velocity * Math.cos(phase) : initial.velocity;
    return { position, velocity, omega,
        x: pendulum ? 490 + Math.sin(position) * p.L * 52 : 500 + position * 32,
        y: pendulum ? 180 + Math.cos(position) * p.L * 52 : 310 };
}
export function satelliteMotion(node: FormulaNode, age: number, saved?: LabState) {
    const p = node.params, omega = Math.sqrt(G * p.M * 1e24 / (p.r * 1e6) ** 3);
    const phase = saved?.kind === 'orbit' ? saved.position + omega * Math.max(0, age - saved.epoch) * 200 : omega * age * 200;
    return { phase, x: 500 + Math.cos(phase) * p.r * 17, y: 365 + Math.sin(phase) * p.r * 17 };
}
export function floatingMotion(node: FormulaNode, age: number, saved?: LabState) {
    const p = node.params, initial = saved?.kind === 'fluid' ? saved.position : 365;
    return { x: 500, y: fluidCenter(p.m, p.V, node.recipeId === 'density' ? 1000 : p.rho, p.g ?? 9.8, Math.max(0, age - (saved?.epoch ?? 0)), initial), side: Math.cbrt(p.V / 3) * 84 };
}
/** A bounded demonstration flux profile, not a Maxwell solver. Phi is total flux change. */
export function inductionMotion(node: FormulaNode, age: number, saved?: LabState) {
    const p = node.params;
    if (saved?.kind === 'induction') return { x: saved.position, flux: p.Phi * (saved.position - 180) / 320, emf: saved.velocity ? -p.Phi * saved.velocity / 320 : 0 };
    const progress = Math.min(1, Math.max(0, age / p.dt));
    return { x: 180 + progress * 320, flux: p.Phi * progress, emf: age < p.dt ? -p.Phi / p.dt : 0 };
}
