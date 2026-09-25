import { RECIPE_MAP } from './catalog';
import type { Reading } from './types';
export const C = 299792458;
export const G = 6.67430e-11;
export const H = 6.62607015e-34;
export const E_CHARGE = 1.602176634e-19;
export const ATOMIC_MASS = 1.66053906660e-27;
export const GAS_R = 8.314462618;
export const SOLAR_MASS = 1.98847e30;
export const gamma = (beta: number): number => 1 / Math.sqrt(1 - beta * beta);
export const radians = (degrees: number): number => degrees * Math.PI / 180;
export function calculate(id: string, p: Record<string, number>, elapsed = 0): Reading {
    const recipe = RECIPE_MAP[id];
    if (!recipe)
        throw new Error(`Неизвестная формула: ${id}`);
    let value: number;
    let note: string | undefined;
    switch (id) {
        case 'gravitySource':
        case 'inverseGravity':
            value = G * p.M * 1e12 / p.r ** 2;
            break;
        case 'crossedFields':
            value = p.B === 0 ? Infinity : Math.abs(p.E / p.B);
            if (p.B === 0) note = 'Магнитное поле отсутствует';
            break;
        case 'magneticCoil':
            value = 4 * Math.PI * 1e-7 * p.mu_m * p.I / (2 * p.r);
            break;
        case 'weight':
            value = p.m * p.g;
            break;
        case 'newton':
            value = p.m * p.a;
            break;
        case 'kinetic':
            value = p.m * p.v ** 2 / 2;
            break;
        case 'momentum':
            value = p.m * p.v;
            break;
        case 'potential':
            value = p.m * p.g * p.h;
            break;
        case 'impulse':
            value = p.F * p.t;
            break;
        case 'work':
            value = p.F * p.d;
            break;
        case 'hooke':
            value = -p.k * p.x;
            break;
        case 'friction':
            value = p.mu * p.m * p.g;
            break;
        case 'pressure':
            value = p.F / p.S;
            break;
        case 'density':
            value = p.m / (p.V * 1e-3);
            break;
        case 'buoyancy':
            value = p.rho * p.g * p.V * 1e-3;
            break;
        case 'gravitation':
            value = G * p.M * 1e24 * p.m / (p.r * 1e6) ** 2;
            break;
        case 'blackhole':
            value = 2 * G * p.M * SOLAR_MASS / C ** 2 / 1000;
            break;
        case 'heat':
            value = p.m * p.c_heat * p.dT;
            break;
        case 'melting':
            value = p.lambda_heat * 1000 * p.m;
            break;
        case 'idealGas':
            value = p.nu * GAS_R * p.T / (p.V * 1e-3) / 1000;
            break;
        case 'firstLaw':
            value = p.Q - p.W;
            break;
        case 'ohm':
            value = p.U / p.R;
            break;
        case 'series':
            value = p.R + p.R2;
            break;
        case 'parallel':
            value = p.R * p.R2 / (p.R + p.R2);
            break;
        case 'joule':
            value = p.I ** 2 * p.R * p.t;
            break;
        case 'capacitor':
            value = p.C * p.U;
            break;
        case 'power':
            value = p.U * p.I;
            break;
        case 'coulomb':
            value = 8.9875517923e9 * p.q * 1e-6 * p.q2 * 1e-6 / p.r ** 2;
            break;
        case 'electricField':
            value = p.q * p.E;
            break;
        case 'lorentz':
            value = p.q * p.v * p.B;
            break;
        case 'ampere':
            value = p.B * p.I * p.L * Math.sin(radians(p.alpha));
            break;
        case 'induction':
            value = -p.Phi / p.dt;
            break;
        case 'springPeriod':
            value = 2 * Math.PI * Math.sqrt(p.m / p.k);
            break;
        case 'pendulum':
            value = 2 * Math.PI * Math.sqrt(p.L / p.g);
            break;
        case 'wave':
            value = p.lambda * p.f;
            break;
        case 'interference':
            value = (p.lambda * 1e-9) * p.L / (p.d * 1e-3) * 1e3;
            break;
        case 'snell': {
            const sin = p.n1 * Math.sin(radians(p.theta)) / p.n2;
            value = sin > 1 ? 0 : Math.asin(sin) * 180 / Math.PI;
            if (sin > 1)
                note = 'Полное внутреннее отражение';
            break;
        }
        case 'lens':
            value = Math.abs(p.d - p.focus) < 1e-9 ? Infinity : p.focus * p.d / (p.d - p.focus);
            if (!Number.isFinite(value))
                note = 'Изображение на бесконечности';
            break;
        case 'photon':
            value = H * p.f * 1e14 / E_CHARGE;
            break;
        case 'photoelectric':
            value = Math.max(0, H * p.f * 1e14 / E_CHARGE - p.W0);
            if (H * p.f * 1e14 / E_CHARGE < p.W0)
                note = 'Ниже порога: эмиссии нет';
            break;
        case 'bohr':
            value = -13.6 * p.Z ** 2 / p.n ** 2;
            break;
        case 'decay':
            value = p.N0 * 2 ** (-elapsed / p.half);
            note = 'Математическое ожидание';
            break;
        case 'binding':
            value = p.dm * ATOMIC_MASS * C ** 2 / (E_CHARGE * 1e6);
            break;
        case 'massEnergy':
            value = p.m * 1e-3 * C ** 2;
            break;
        case 'gamma':
            value = gamma(p.beta);
            break;
        case 'timeDilation':
            value = gamma(p.beta) * p.t;
            break;
        case 'lengthContraction':
            value = p.L / gamma(p.beta);
            break;
        default: throw new Error(`Нет вычислителя для ${id}`);
    }
    return { value, unit: recipe.unit, note };
}
export function formatValue(value: number): string {
    if (value === Infinity)
        return '∞';
    if (!Number.isFinite(value))
        return '—';
    if (value !== 0 && (Math.abs(value) >= 1e6 || Math.abs(value) < 0.001))
        return value.toExponential(2).replace('.', ',').replace('e+', ' × 10^').replace('e-', ' × 10^−');
    return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2 }).format(value);
}
