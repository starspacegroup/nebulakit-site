<script lang="ts">
	import { onMount } from 'svelte';
	import { FIELD, INTRO_STAGGER, clamp01, nebulaField, place } from '$lib/hero-field';

	/**
	 * The live field behind the home hero — the same move as the Braille field
	 * on davis9001.com and the sky on starspace.group, in this site's motif:
	 * stars, and the dust of the nebula gathered along the wash behind them.
	 *
	 * **Two layers.** The SVG is server-rendered and needs no script: the still
	 * field, painted before any JavaScript runs. On mount a canvas draws the
	 * same seeded points and takes over, and from there the field arrives once,
	 * answers the pointer and the scroll by depth, and wanders on its own.
	 *
	 * **Under prefers-reduced-motion the canvas never starts.** The SVG is the
	 * still version of the field, so that path is the layer that was there
	 * first, not a degraded copy.
	 *
	 * Colours are `--hero-field-*` tokens in `app.css`, read off the element on
	 * mount and on a theme change — never in the frame loop. Decorative, and
	 * hidden from assistive technology: the hero's words say what this is.
	 */
	const particles = nebulaField();
	const stars = particles.filter((p) => p.kind === 'star');
	const dust = particles.filter((p) => p.kind === 'dust');

	/** The arrival, once: about a second, left to right, near layers last. */
	const INTRO_MS = 900;
	/** A touch screen keeps drawing this long after a scroll, then sleeps. */
	const SETTLE_MS = 500;

	let root: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let live = false;

	onMount(() => {
		const still = matchMedia('(prefers-reduced-motion: reduce)');
		const fine = matchMedia('(pointer: fine)');
		// No canvas (an old browser, a test DOM): the still SVG is the whole field.
		const ctx = canvas?.getContext?.('2d');
		if (!ctx || still.matches) return;

		/* The hero listens, not the field: the copy and buttons sit above the
		   field as its siblings, and a pointer over them never reaches it. On the
		   hero those moves bubble up, and pointerleave fires only on leaving it. */
		const hero = root.parentElement?.parentElement ?? root;

		let w = 0;
		let h = 0;
		let heroTop = 0;
		let heroLeft = 0;
		let heroWidth = 1;
		let heroHeight = 1;
		let raf = 0;
		let introAt = 0;
		let awakeUntil = 0;

		// Pointer, eased: px/py is where it is, tx/ty where the field has got to.
		let px = 0;
		let py = 0;
		let tx = 0;
		let ty = 0;
		let scroll = 0;

		let star = '#ffffff';
		let tints = ['#3b82f6', '#8b5cf6'];
		let starAlpha = 1;
		let dustAlpha = 1;
		let haloAlpha = 1;

		const tint = (colour: string, alpha: number) =>
			`color-mix(in srgb, ${colour} ${Math.round(clamp01(alpha) * 100)}%, transparent)`;

		function readTheme() {
			const style = getComputedStyle(root);
			const read = (name: string, fallback: string) =>
				style.getPropertyValue(name).trim() || fallback;
			star = read('--hero-field-star', star);
			tints = [read('--hero-field-dust-a', tints[0]), read('--hero-field-dust-b', tints[1])];
			starAlpha = Number(read('--hero-field-star-opacity', '1'));
			dustAlpha = Number(read('--hero-field-dust-opacity', '1'));
			haloAlpha = Number(read('--hero-field-halo-opacity', '1'));
		}

		/* Both rectangles once per resize. Reading them in pointermove would
		   force a layout hundreds of times a second for a box that has not moved. */
		function size() {
			const heroRect = hero.getBoundingClientRect();
			heroTop = heroRect.top + window.scrollY;
			heroLeft = heroRect.left + window.scrollX;
			heroWidth = Math.max(heroRect.width, 1);
			heroHeight = Math.max(heroRect.height, 1);

			const rect = canvas.getBoundingClientRect();
			w = rect.width;
			h = rect.height;
			// Soft points: a 3x ratio triples the fill cost for nothing visible.
			const dpr = Math.min(window.devicePixelRatio || 1, fine.matches ? 2 : 1.5);
			canvas.width = Math.round(w * dpr);
			canvas.height = Math.round(h * dpr);
			ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
			readTheme();
		}

		function draw(t: number) {
			ctx!.clearRect(0, 0, w, h);
			tx += (px - tx) * 0.07;
			ty += (py - ty) * 0.07;
			const intro = introAt ? clamp01((t - introAt) / (INTRO_MS * (1 + INTRO_STAGGER))) : 0;
			const state = { t, tx, ty, scroll, intro, pointer: fine.matches, width: w, height: h };

			// A pool of the nebula's own colour where the cursor is, under the field.
			if (fine.matches) {
				const gx = (tx + 0.5) * w;
				const gy = (ty + 0.5) * h;
				const pool = ctx!.createRadialGradient(gx, gy, 0, gx, gy, 380);
				pool.addColorStop(0, tint(tints[0], 0.08 * dustAlpha));
				pool.addColorStop(1, tint(tints[0], 0));
				ctx!.fillStyle = pool;
				ctx!.fillRect(0, 0, w, h);
			}

			// Dust first, so the stars sit in front of the cloud.
			for (const p of dust) {
				const at = place(p, state);
				if (!at) continue;
				const outer = at.radius * 3;
				const glow = ctx!.createRadialGradient(at.x, at.y, 0, at.x, at.y, outer);
				glow.addColorStop(0, tint(tints[p.tint], at.alpha * dustAlpha));
				glow.addColorStop(1, tint(tints[p.tint], 0));
				ctx!.fillStyle = glow;
				ctx!.beginPath();
				ctx!.arc(at.x, at.y, outer, 0, Math.PI * 2);
				ctx!.fill();
			}

			for (const p of stars) {
				const at = place(p, state);
				if (!at) continue;
				const alpha = at.alpha * starAlpha;
				// The bright few carry a halo, and a star the cursor lifts earns one.
				const halo = ((p.r >= 1.8 ? 1 : 0) + at.lift * 0.9) * haloAlpha;
				if (halo > 0.01) {
					const outer = at.radius * 7;
					const g = ctx!.createRadialGradient(at.x, at.y, 0, at.x, at.y, outer);
					g.addColorStop(0, tint(star, 0.45 * halo * alpha));
					g.addColorStop(0.4, tint(star, 0.12 * halo * alpha));
					g.addColorStop(1, tint(star, 0));
					ctx!.fillStyle = g;
					ctx!.beginPath();
					ctx!.arc(at.x, at.y, outer, 0, Math.PI * 2);
					ctx!.fill();
				}
				ctx!.fillStyle = tint(star, alpha);
				ctx!.beginPath();
				ctx!.arc(at.x, at.y, at.radius, 0, Math.PI * 2);
				ctx!.fill();
			}
		}

		function frame(t: number) {
			if (!introAt) introAt = t;
			draw(t);
			if (fine.matches) {
				raf = requestAnimationFrame(frame);
				return;
			}
			// Touch: finish arriving, then sleep until the page moves.
			const arrived = t - introAt > INTRO_MS * (1 + INTRO_STAGGER) + 120;
			if (arrived && t > awakeUntil) {
				stop();
				return;
			}
			raf = requestAnimationFrame(frame);
		}

		function start() {
			if (!raf) raf = requestAnimationFrame(frame);
		}

		function stop() {
			if (raf) cancelAnimationFrame(raf);
			raf = 0;
		}

		size();
		// The SVG stays until the canvas has a frame to show; then the canvas
		// starts its arrival from an empty field.
		live = true;

		const onResize = () => {
			size();
			draw(performance.now());
		};
		const onMove = (e: PointerEvent) => {
			px = (e.clientX - (heroLeft - window.scrollX)) / heroWidth - 0.5;
			py = (e.clientY - (heroTop - window.scrollY)) / heroHeight - 0.5;
		};
		const onLeave = () => {
			px = 0;
			py = 0;
		};
		// No layout read: scrollY - heroTop is the same number as -rect.top.
		const onScroll = () => {
			scroll = clamp01((window.scrollY - heroTop) / heroHeight);
			if (!fine.matches) {
				awakeUntil = performance.now() + SETTLE_MS;
				start();
			}
		};

		// Nothing draws off screen or in a background tab.
		const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
		io.observe(canvas);
		const onVisibility = () => (document.hidden ? stop() : start());
		const theme = new MutationObserver(() => {
			readTheme();
			draw(performance.now());
		});
		theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

		window.addEventListener('resize', onResize, { passive: true });
		window.addEventListener('scroll', onScroll, { passive: true });
		document.addEventListener('visibilitychange', onVisibility);
		if (fine.matches) {
			hero.addEventListener('pointermove', onMove, { passive: true });
			hero.addEventListener('pointerleave', onLeave, { passive: true });
		}
		onScroll();
		start();

		return () => {
			stop();
			io.disconnect();
			theme.disconnect();
			window.removeEventListener('resize', onResize);
			window.removeEventListener('scroll', onScroll);
			document.removeEventListener('visibilitychange', onVisibility);
			hero.removeEventListener('pointermove', onMove);
			hero.removeEventListener('pointerleave', onLeave);
		};
	});
</script>

<div class="hero-field" class:is-live={live} bind:this={root} aria-hidden="true">
	<canvas class="live" bind:this={canvas}></canvas>
	<svg
		class="still"
		viewBox="0 0 {FIELD.width} {FIELD.height}"
		preserveAspectRatio="xMidYMid slice"
	>
		<defs>
			<radialGradient id="hero-field-dust-a">
				<stop offset="0" class="dust-a" />
				<stop offset="1" class="dust-a" stop-opacity="0" />
			</radialGradient>
			<radialGradient id="hero-field-dust-b">
				<stop offset="0" class="dust-b" />
				<stop offset="1" class="dust-b" stop-opacity="0" />
			</radialGradient>
		</defs>
		<g class="dust">
			{#each dust as p, i (i)}
				<circle
					cx={p.x}
					cy={p.y}
					r={p.r * 3}
					fill="url(#hero-field-dust-{p.tint ? 'b' : 'a'})"
					opacity={p.opacity}
				/>
			{/each}
		</g>
		<g class="stars">
			{#each stars as p, i (i)}
				<circle
					class:twinkle={p.twinkle}
					cx={p.x}
					cy={p.y}
					r={p.r}
					opacity={p.opacity}
					style={p.twinkle ? `--period: ${p.period}s; --delay: ${p.delay}s` : undefined}
				/>
			{/each}
		</g>
	</svg>
</div>

<style>
	.hero-field {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.still,
	.live {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	/* Hidden with opacity, not display: size() measures the canvas before the
	   swap, and a display:none element has a zero rect. */
	.live {
		opacity: 0;
	}

	.hero-field.is-live .live {
		opacity: 1;
	}

	.hero-field.is-live .still {
		display: none;
	}

	.stars {
		fill: var(--hero-field-star);
		opacity: var(--hero-field-star-opacity, 1);
	}

	.dust {
		opacity: var(--hero-field-dust-opacity, 1);
	}

	.dust-a {
		stop-color: var(--hero-field-dust-a);
	}

	.dust-b {
		stop-color: var(--hero-field-dust-b);
	}

	/* A quarter of the stars breathe, each already part-way through its cycle. */
	.twinkle {
		animation: twinkle var(--period) ease-in-out var(--delay) infinite alternate;
	}

	@keyframes twinkle {
		from {
			opacity: 0.15;
		}
		to {
			opacity: 1;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.twinkle {
			animation: none;
		}
	}
</style>
