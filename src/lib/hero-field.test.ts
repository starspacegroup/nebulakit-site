import { describe, expect, it } from 'vitest';
import {
	FIELD,
	clamp01,
	easeOut,
	fieldTransform,
	nebulaField,
	nebulaSpine,
	place,
	seededRandom,
	wrap,
	type FrameState,
	type Particle
} from './hero-field';

const frame = (over: Partial<FrameState> = {}): FrameState => ({
	t: 0,
	tx: 0,
	ty: 0,
	scroll: 0,
	intro: 1,
	pointer: false,
	width: FIELD.width,
	height: FIELD.height,
	...over
});

const particle = (over: Partial<Particle> = {}): Particle => ({
	kind: 'star',
	tint: 0,
	x: 800,
	y: 450,
	r: 1,
	opacity: 0.5,
	twinkle: false,
	period: 0,
	delay: 0,
	z: 0.5,
	driftX: 0,
	driftY: 0,
	speed: 0,
	phase: 0,
	...over
});

describe('seededRandom', () => {
	it('repeats for a seed and stays on [0, 1)', () => {
		const a = seededRandom(7);
		const b = seededRandom(7);
		for (let i = 0; i < 200; i++) {
			const v = a();
			expect(v).toBe(b());
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});
});

describe('nebulaField', () => {
	it('is the same field on the server and in the browser', () => {
		expect(nebulaField()).toEqual(nebulaField());
	});

	it('makes the stars and dust it was asked for, inside the field', () => {
		const field = nebulaField(1, 30, 12);
		expect(field.filter((p) => p.kind === 'star')).toHaveLength(30);
		expect(field.filter((p) => p.kind === 'dust')).toHaveLength(12);
		for (const p of field) {
			expect(p.x).toBeGreaterThanOrEqual(0);
			expect(p.x).toBeLessThanOrEqual(FIELD.width);
			expect(p.y).toBeGreaterThanOrEqual(0);
			expect(p.y).toBeLessThanOrEqual(FIELD.height);
			expect(p.z).toBeGreaterThanOrEqual(0);
			expect(p.z).toBeLessThan(1);
			expect(p.speed).toBeGreaterThan(0);
		}
	});

	it('only lets stars twinkle, each with a period', () => {
		const field = nebulaField();
		expect(field.some((p) => p.twinkle)).toBe(true);
		for (const p of field) {
			if (p.kind === 'dust') expect(p.twinkle).toBe(false);
			if (p.twinkle) expect(p.period).toBeGreaterThan(0);
		}
	});

	it('gathers the dust along the nebula, not across the whole field', () => {
		const dust = nebulaField().filter((p) => p.kind === 'dust');
		const off = dust.map((p) => Math.abs(p.x - nebulaSpine(p.y)));
		const mean = off.reduce((a, b) => a + b, 0) / off.length;
		expect(mean).toBeLessThan(200);
		expect(new Set(dust.map((p) => p.tint))).toEqual(new Set([0, 1]));
	});
});

describe('fieldTransform', () => {
	it('covers a wide hero and centres the crop', () => {
		const { scale, offsetX, offsetY } = fieldTransform(3200, 900);
		expect(scale).toBe(2);
		expect(offsetX).toBe(0);
		expect(offsetY).toBe(-450);
	});

	it('covers a tall hero', () => {
		const { scale, offsetX } = fieldTransform(400, 900);
		expect(scale).toBe(1);
		expect(offsetX).toBe(-600);
	});
});

describe('helpers', () => {
	it('clamp01, wrap and easeOut', () => {
		expect(clamp01(-1)).toBe(0);
		expect(clamp01(2)).toBe(1);
		expect(clamp01(0.3)).toBe(0.3);
		expect(wrap(-10, 100)).toBe(90);
		expect(wrap(250, 100)).toBe(50);
		expect(easeOut(0)).toBe(0);
		expect(easeOut(1)).toBe(1);
		expect(easeOut(0.5)).toBeGreaterThan(0.5);
	});
});

describe('place', () => {
	it('draws nothing before a particle has arrived', () => {
		expect(place(particle({ x: 1500, z: 0.9 }), frame({ intro: 0 }))).toBeNull();
	});

	it('arrives left to right', () => {
		const s = frame({ intro: 0.15 });
		expect(place(particle({ x: 10 }), s)).not.toBeNull();
		expect(place(particle({ x: 1590 }), s)).toBeNull();
	});

	it('moves near particles further than far ones under the pointer', () => {
		const still = frame();
		const moved = frame({ tx: 0.4 });
		const far = particle({ z: 0 });
		const near = particle({ z: 0.95 });
		const farShift = place(far, moved)!.x - place(far, still)!.x;
		const nearShift = place(near, moved)!.x - place(near, still)!.x;
		expect(nearShift).toBeGreaterThan(farShift * 3);
	});

	it('moves with the scroll, and stays on the canvas', () => {
		const p = particle({ z: 0.9 });
		const a = place(p, frame())!;
		const b = place(p, frame({ scroll: 0.5 }))!;
		expect(b.y).not.toBe(a.y);
		for (const scroll of [0, 0.25, 0.5, 0.75, 1]) {
			const y = place(particle({ y: 5, z: 0.99 }), frame({ scroll }))!.y;
			expect(y).toBeGreaterThanOrEqual(-80);
			expect(y).toBeLessThan(FIELD.height + 80);
		}
	});

	it('lifts the particle under the cursor, and only with a cursor', () => {
		const p = particle();
		const under = place(p, frame({ pointer: true }))!;
		const without = place(p, frame({ pointer: false }))!;
		const away = place(particle({ x: 100, y: 100 }), frame({ pointer: true }))!;
		expect(under.lift).toBeGreaterThan(0.9);
		expect(under.radius).toBeGreaterThan(without.radius);
		expect(under.alpha).toBeGreaterThan(without.alpha);
		expect(without.lift).toBe(0);
		expect(away.lift).toBe(0);
	});

	it('wanders on its own when nothing else moves', () => {
		const p = particle({ driftX: 0.3, driftY: 0.3, speed: 0.001 });
		const a = place(p, frame({ t: 0 }))!;
		const b = place(p, frame({ t: 1500 }))!;
		expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(1);
	});

	it('lets a twinkling star breathe', () => {
		const p = particle({ twinkle: true, period: 4, delay: 0 });
		const alphas = [0, 1000, 2000, 3000, 4000].map((t) => place(p, frame({ t }))!.alpha);
		expect(Math.max(...alphas)).toBeGreaterThan(Math.min(...alphas));
	});
});
