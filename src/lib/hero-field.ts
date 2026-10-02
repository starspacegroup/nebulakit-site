/**
 * The field behind the home hero: stars, and the dust of the nebula itself.
 *
 * The same move as the Braille field on davis9001.com and the sky on
 * starspace.group, read across to this site's own motif. Seeded, so the
 * server and the browser lay out the same field and hydration has nothing to
 * reconcile; the SVG the server renders and the canvas that takes over on
 * mount draw the same points, so the handover cannot be seen.
 *
 * A plain module rather than code inside the component, so the placement and
 * motion maths are tested and counted — `*.svelte` is excluded from coverage,
 * this file is not.
 */

/** The field's coordinate space. Both layers slice it to cover the hero. */
export const FIELD = { width: 1600, height: 900 } as const;

export const FIELD_SEED = 20261002;

export type Particle = {
	/** A star is a crisp point; dust is a soft mote of the nebula's colour. */
	kind: 'star' | 'dust';
	/** Dust takes the primary (0) or the secondary (1) colour. Stars ignore it. */
	tint: 0 | 1;
	x: number;
	y: number;
	r: number;
	opacity: number;
	/** A quarter of the stars breathe. Seconds; 0 on the rest. */
	twinkle: boolean;
	period: number;
	delay: number;
	/**
	 * Depth on [0, 1), and the number everything that moves is derived from.
	 * Skewed toward the back: parallax only reads when near and far layers
	 * move at obviously different rates.
	 */
	z: number;
	driftX: number;
	driftY: number;
	/** Radians per millisecond: one slow cycle every 26–60 seconds. */
	speed: number;
	phase: number;
};

/** mulberry32: small, fast, and plenty for scattering points. Uniform on [0, 1). */
export function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const round = (value: number, places = 1) => Number(value.toFixed(places));

/**
 * Where the nebula is, as a curve down the left of the field: the dust
 * gathers along it, the way the wash behind it does, rather than being sprinkled
 * evenly like the stars.
 */
export function nebulaSpine(y: number): number {
	const v = y / FIELD.height;
	return FIELD.width * (0.14 + 0.1 * Math.sin(v * Math.PI * 1.4 + 0.6));
}

export function nebulaField(seed = FIELD_SEED, stars = 120, dust = 110): Particle[] {
	const random = seededRandom(seed);
	const particles: Particle[] = [];

	for (let i = 0; i < stars; i++) {
		// Skewed small: most stars are pinpricks, a handful are bright.
		const size = random() ** 2.2;
		const twinkle = random() < 0.25;
		particles.push({
			kind: 'star',
			tint: 0,
			x: round(random() * FIELD.width),
			y: round(random() * FIELD.height),
			r: round(0.6 + size * 1.8),
			opacity: round(0.25 + random() * 0.7, 2),
			twinkle,
			period: twinkle ? round(3 + random() * 4) : 0,
			// Negative, so every twinkler is already part-way through its cycle.
			delay: twinkle ? round(-random() * 7) : 0,
			z: 0,
			driftX: 0,
			driftY: 0,
			speed: 0,
			phase: 0
		});
	}

	for (let i = 0; i < dust; i++) {
		const y = random() * FIELD.height;
		// Two uniforms summed is a cheap bell: most dust sits on the spine, some
		// strays well off it.
		const spread = (random() + random() - 1) * 260;
		particles.push({
			kind: 'dust',
			tint: random() < 0.5 ? 0 : 1,
			x: round(Math.min(Math.max(nebulaSpine(y) + spread, 0), FIELD.width)),
			y: round(y),
			r: round(0.7 + random() * 1.3),
			opacity: round(0.2 + random() * 0.5, 2),
			twinkle: false,
			period: 0,
			delay: 0,
			z: 0,
			driftX: 0,
			driftY: 0,
			speed: 0,
			phase: 0
		});
	}

	// Motion from a second stream, so adding motion never moves a point the
	// still layer already shows.
	const motion = seededRandom(seed + 0x5bd1e995);
	for (const p of particles) {
		const sign = () => (motion() < 0.5 ? -1 : 1);
		p.z = round(motion() ** 1.6, 3);
		p.driftX = round((0.16 + motion() * 0.19) * sign(), 3);
		p.driftY = round((0.16 + motion() * 0.19) * sign(), 3);
		p.speed = (2 * Math.PI) / (26000 + motion() * 34000);
		p.phase = motion() * Math.PI * 2;
	}

	return particles;
}

/**
 * How the 1600×900 field maps onto a hero of another shape — the same
 * arithmetic as the SVG's `preserveAspectRatio="xMidYMid slice"`: scale to
 * cover, then centre.
 */
export function fieldTransform(width: number, height: number) {
	const scale = Math.max(width / FIELD.width, height / FIELD.height);
	return {
		scale,
		offsetX: (width - FIELD.width * scale) / 2,
		offsetY: (height - FIELD.height * scale) / 2
	};
}

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Keep a point on the canvas however far the page has scrolled. */
export const wrap = (v: number, span: number) => ((v % span) + span) % span;

/** Slow out — arriving, not launching. */
export const easeOut = (v: number) => 1 - Math.pow(1 - v, 3);

/** How much of the arrival is spent staggering rather than moving. */
export const INTRO_STAGGER = 0.45;

export type FrameState = {
	/** Milliseconds, from requestAnimationFrame. */
	t: number;
	/** The eased pointer, on [-0.5, 0.5] across the hero. */
	tx: number;
	ty: number;
	/** 0 at the top of the hero, 1 once it has scrolled a full height away. */
	scroll: number;
	/** Arrival progress on [0, 1]. */
	intro: number;
	/** Whether there is a cursor to answer. */
	pointer: boolean;
	width: number;
	height: number;
};

export type Placed = { x: number; y: number; radius: number; alpha: number; lift: number };

const MARGIN = 80;

/**
 * Where one particle is drawn this frame, and how brightly.
 *
 * Near particles travel several times further than far ones under the
 * pointer and the scroll. They arrive left to right with the near ones last,
 * falling into place out of depth, once. A particle near the cursor lifts —
 * grows and brightens — and its neighbours do not, so a sweep finds them one
 * at a time. Returns null for a particle that has not arrived yet.
 */
export function place(p: Particle, s: FrameState): Placed | null {
	const at = (p.x / FIELD.width) * INTRO_STAGGER * (0.7 + p.z * 0.5);
	const arrived = easeOut(clamp01(s.intro * (1 + INTRO_STAGGER) - at));
	if (arrived <= 0) return null;

	const { scale, offsetX, offsetY } = fieldTransform(s.width, s.height);
	const depth = 0.22 + p.z * 3.4;
	const amp = 4 + p.z * 26;
	const wanderX = Math.sin(s.t * p.speed + p.phase) * p.driftX * amp;
	const wanderY = Math.cos(s.t * p.speed * 0.73 + p.phase) * p.driftY * amp;

	const x = offsetX + p.x * scale + s.tx * 46 * depth + wanderX;
	const y =
		wrap(
			offsetY +
				p.y * scale +
				s.ty * 46 * depth +
				wanderY -
				s.scroll * depth * 30 -
				(1 - arrived) * 46 * depth +
				MARGIN,
			s.height + MARGIN * 2
		) - MARGIN;

	const near = s.pointer
		? Math.max(0, 1 - Math.hypot(x - (s.tx + 0.5) * s.width, y - (s.ty + 0.5) * s.height) / 260)
		: 0;
	const lift = near * near;

	const breath = p.twinkle
		? 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(((s.t / 1000 + p.delay) / p.period) * Math.PI))
		: 1;

	return {
		x,
		y,
		radius: (p.r + p.z * 0.9) * scale * (1 + lift * 0.9) * (0.55 + arrived * 0.45),
		alpha: clamp01(p.opacity * breath * (1 + lift * 1.8) * arrived),
		lift
	};
}
