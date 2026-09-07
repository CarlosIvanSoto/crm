export const NOW = Date.now();

export const DAY_MS = 24 * 60 * 60 * 1000;

export function makeRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export type Rng = () => number;

export function pick<T>(rng: Rng, values: readonly T[]): T {
	const value = values[Math.floor(rng() * values.length)];
	if (value === undefined) {
		throw new Error("pick called on an empty list");
	}
	return value;
}

export function chance(rng: Rng, probability: number): boolean {
	return rng() < probability;
}

export function integer(rng: Rng, min: number, max: number): number {
	return min + Math.floor(rng() * (max - min + 1));
}

export function sample<T>(rng: Rng, values: readonly T[], count: number): T[] {
	const pool = [...values];
	const out: T[] = [];
	while (out.length < count && pool.length > 0) {
		const index = Math.floor(rng() * pool.length);
		out.push(pool.splice(index, 1)[0] as T);
	}
	return out;
}

export function daysFromNow(days: number): Date {
	return new Date(NOW + days * DAY_MS);
}

export function hoursFromNow(hours: number): Date {
	return new Date(NOW + hours * 60 * 60 * 1000);
}

export function isoDay(date: Date): string {
	return date.toISOString().slice(0, 10);
}

export function tokenFromRng(rng: Rng): string {
	const bytes = Buffer.alloc(24);
	for (let index = 0; index < bytes.length; index += 1) {
		bytes[index] = Math.floor(rng() * 256);
	}
	return bytes.toString("base64url");
}
