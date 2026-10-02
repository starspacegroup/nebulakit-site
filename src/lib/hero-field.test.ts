import { describe, expect, it } from 'vitest';
import {
	FIELD,
	clamp01,
	easeOut,
	fieldTransform,
	nebulaField,
	meteorGlow,
	meteorHead,
	nebulaSpine,
	planMeteor,
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

describe('meteor', () => {
	const m = { ax: 0, ay: 0, bx: 1000, by: 0, progress: 0.5 };
	const head = meteorHead(m).x;

	it('lights a point just behind the head, on the path', () => {
		expect(meteorGlow(head - 10, 0, m)).toBeGreaterThan(0.9);
	});

	it('leaves points ahead of the head, far behind it, or off the path dark', () => {
		expect(meteorGlow(head + 20, 0, m)).toBe(0);
		expect(meteorGlow(head - 400, 0, m)).toBe(0);
		expect(meteorGlow(head - 10, 200, m)).toBe(0);
		expect(meteorGlow(-50, 0, m)).toBe(0);
	});

	it('dims with distance from the path', () => {
		expect(meteorGlow(head - 10, 40, m)).toBeLessThan(meteorGlow(head - 10, 0, m));
	});

	it('does nothing without a meteor, or with a zero-length one', () => {
		expect(meteorGlow(0, 0, null)).toBe(0);
		expect(meteorGlow(0, 0, { ax: 5, ay: 5, bx: 5, by: 5, progress: 0.5 })).toBe(0);
	});

	it('runs the head from one end to the other', () => {
		expect(meteorHead({ ...m, progress: 0 })).toEqual({ x: 0, y: 0 });
		expect(meteorHead({ ...m, progress: 1 })).toEqual({ x: 1000, y: 0 });
	});

	it('plans a crossing that falls across the field, from either side', () => {
		for (const seed of [1, 2, 3, 4, 5, 6]) {
			const plan = planMeteor(1600, 900, seededRandom(seed));
			expect(plan.by).toBeGreaterThan(plan.ay);
			expect(Math.abs(plan.bx - plan.ax)).toBeGreaterThan(1600 * 0.45);
			expect(plan.progress).toBe(0);
		}
		const left = planMeteor(1600, 900, () => 0.9);
		const right = planMeteor(1600, 900, () => 0.1);
		expect(left.bx).toBeGreaterThan(left.ax);
		expect(right.bx).toBeLessThan(right.ax);
	});

	it('lifts a particle in place() as the meteor passes it', () => {
		const p = particle();
		const at = place(p, frame())!;
		const passing = { ax: at.x - 500, ay: at.y, bx: at.x + 500, by: at.y, progress: 0 };
		// The head just past the particle.
		passing.progress = 0.52;
		const lit = place(p, frame({ meteor: passing }))!;
		expect(lit.lift).toBeGreaterThan(0.8);
		expect(lit.alpha).toBeGreaterThan(at.alpha);
	});
});
