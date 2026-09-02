export type GarageNumberType = 'quote' | 'job-card' | 'invoice';
const prefixes: Record<GarageNumberType, string> = { quote: 'EST', 'job-card': 'JC', invoice: 'INV' };
const counterKey = (type: GarageNumberType) => `aa-garage-number-${type}`;
const format = (type: GarageNumberType, number: number) => `${prefixes[type]}-${String(number).padStart(5, '0')}`;
export const peekNextGarageNumber = (type: GarageNumberType) => format(type, Number(localStorage.getItem(counterKey(type)) || 0) + 1);
export const nextGarageNumber = (type: GarageNumberType) => { const next = Number(localStorage.getItem(counterKey(type)) || 0) + 1; localStorage.setItem(counterKey(type), String(next)); return format(type, next); };
