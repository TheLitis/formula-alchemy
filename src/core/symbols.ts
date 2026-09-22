import type { SymbolDef, Topic } from './types';
export const TOPICS: {
    id: Topic;
    name: string;
    short: string;
    number: string;
}[] = [
    { id: 'mechanics', name: 'Механика и гравитация', short: 'Механика', number: '01' },
    { id: 'thermal', name: 'Теплота и молекулы', short: 'Теплота', number: '02' },
    { id: 'electricity', name: 'Электричество и цепи', short: 'Электричество', number: '03' },
    { id: 'magnetism', name: 'Магнитные поля', short: 'Магнетизм', number: '04' },
    { id: 'waves', name: 'Колебания и волны', short: 'Волны', number: '05' },
    { id: 'optics', name: 'Геометрическая оптика', short: 'Оптика', number: '06' },
    { id: 'quantum', name: 'Кванты и атомы', short: 'Кванты', number: '07' },
    { id: 'nuclear', name: 'Ядерная физика', short: 'Ядро', number: '08' },
    { id: 'relativity', name: 'Пространство и время', short: 'СТО', number: '09' },
];
const s = (id: string, tex: string, name: string, unit: string, topic: Topic, constant?: string): SymbolDef => ({ id, tex, name, unit, topic, constant });
export const SYMBOLS: SymbolDef[] = [
    s('m', 'm', 'Масса', 'кг', 'mechanics'), s('g', 'g', 'Ускорение свободного падения', 'м/с²', 'mechanics'),
    s('a', 'a', 'Ускорение', 'м/с²', 'mechanics'), s('v', 'v', 'Скорость', 'м/с', 'mechanics'),
    s('F', 'F', 'Сила', 'Н', 'mechanics'), s('h', 'h', 'Высота', 'м', 'mechanics'), s('t', 't', 'Время', 'с', 'mechanics'),
    s('d', 'd', 'Расстояние', 'м', 'mechanics'), s('r', 'r', 'Радиус / расстояние', 'м', 'mechanics'),
    s('k', 'k', 'Жёсткость пружины', 'Н/м', 'mechanics'), s('x', 'x', 'Удлинение', 'м', 'mechanics'),
    s('mu', '\\mu', 'Коэффициент трения', '1', 'mechanics'), s('S', 'S', 'Площадь', 'м²', 'mechanics'),
    s('rho', '\\rho', 'Плотность', 'кг/м³', 'mechanics'), s('V', 'V', 'Объём', 'м³', 'thermal'),
    s('G', 'G', 'Гравитационная постоянная', 'Н·м²/кг²', 'mechanics', '6,67430 × 10⁻¹¹'),
    s('M', 'M', 'Масса центрального тела', 'кг', 'mechanics'),
    s('c_heat', 'c_{\\text{уд}}', 'Удельная теплоёмкость', 'Дж/(кг·К)', 'thermal'),
    s('dT', '\\Delta T', 'Изменение температуры', 'К', 'thermal'), s('lambda_heat', '\\lambda_{\\text{пл}}', 'Удельная теплота плавления', 'Дж/кг', 'thermal'),
    s('nu', '\\nu', 'Количество вещества', 'моль', 'thermal'), s('T', 'T', 'Абсолютная температура', 'К', 'thermal'),
    s('Q', 'Q', 'Количество теплоты', 'Дж', 'thermal'), s('W', 'A', 'Работа газа', 'Дж', 'thermal'),
    s('U', 'U', 'Напряжение', 'В', 'electricity'), s('R', 'R', 'Сопротивление', 'Ом', 'electricity'),
    s('R2', 'R_2', 'Второе сопротивление', 'Ом', 'electricity'), s('I', 'I', 'Сила тока', 'А', 'electricity'),
    s('C', 'C', 'Электроёмкость', 'Ф', 'electricity'), s('q', 'q', 'Электрический заряд', 'Кл', 'electricity'),
    s('q2', 'q_2', 'Второй заряд', 'Кл', 'electricity'), s('E', 'E', 'Напряжённость электрического поля', 'Н/Кл', 'electricity'),
    s('B', 'B', 'Магнитная индукция', 'Тл', 'magnetism'), s('L', 'L', 'Длина', 'м', 'waves'),
    s('Phi', '\\Delta\\Phi', 'Изменение магнитного потока', 'Вб', 'magnetism'), s('dt', '\\Delta t', 'Промежуток времени', 'с', 'magnetism'),
    s('lambda', '\\lambda', 'Длина волны', 'м', 'waves'), s('f', 'f', 'Частота', 'Гц', 'waves'),
    s('n1', 'n_1', 'Показатель преломления среды 1', '1', 'optics'), s('n2', 'n_2', 'Показатель преломления среды 2', '1', 'optics'),
    s('theta', '\\theta', 'Угол падения', '°', 'optics'), s('focus', 'F_{\\text{л}}', 'Фокусное расстояние', 'м', 'optics'),
    s('hP', 'h_{\\text{П}}', 'Постоянная Планка', 'Дж·с', 'quantum', '6,62607015 × 10⁻³⁴'),
    s('W0', 'A_{\\text{вых}}', 'Работа выхода', 'Дж', 'quantum'), s('Z', 'Z', 'Зарядовое число ядра', '1', 'quantum'),
    s('n', 'n', 'Главное квантовое число', '1', 'quantum'), s('N0', 'N_0', 'Начальное число ядер', '1', 'nuclear'),
    s('half', 'T_{1/2}', 'Период полураспада', 'с', 'nuclear'), s('dm', '\\Delta m', 'Дефект массы', 'кг', 'nuclear'),
    s('c', 'c', 'Скорость света в вакууме', 'м/с', 'relativity', '299 792 458'),
];
export const SYMBOL_MAP = Object.fromEntries(SYMBOLS.map(item => [item.id, item])) as Record<string, SymbolDef>;
