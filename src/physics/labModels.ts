/** Stable display models; calculated SI values remain in core/evaluate.ts. */
export function fluidCenter(mass: number, liters: number, density: number, g: number, age: number, start = 365): number {
    const side = Math.cbrt(liters / 3) * 84, bodyDensity = mass / (liters * .001);
    if (g <= 0 || (Math.abs(bodyDensity - density) <= Math.max(1, density) * 1e-10 && start >= 270 + side / 2)) return start;
    const target = bodyDensity <= density ? 270 + side * (bodyDensity / density - .5) : 550 - side / 2;
    const t = Math.max(0, age) * Math.sqrt(g / 9.8);
    // Critically damped interpolation to the buoyancy equilibrium, not CFD.
    return start + (target - start) * (1 - (1 + t * 1.4) * Math.exp(-t * 1.4));
}
export function capacitorMarkerTravel(current0: number, tau: number, age: number): number {
    if (current0 <= 0 || tau <= 0) return 0;
    // Integral of the display speed 35 sqrt(I0 exp(-t/tau)); always nondecreasing.
    return 70 * Math.sqrt(current0) * tau * -Math.expm1(-Math.max(0, age) / (2 * tau));
}
export function rodPosition(lengthPixels: number, beta: number, age: number): number {
    const span = 1000 + lengthPixels;
    return ((190 + lengthPixels + Math.max(0, age) * 40 * beta) % span + span) % span - lengthPixels;
}
export function energyColumn(heat: number, work: number, progress: number) {
    const delta = heat - work;
    const initial = Math.max(50, -delta + 20); // explicit positive reference energy
    const value = initial + delta * Math.min(1, Math.max(0, progress));
    const scale = Math.max(initial, initial + delta) * 1.1;
    return { initial, value, fraction: value / scale };
}
