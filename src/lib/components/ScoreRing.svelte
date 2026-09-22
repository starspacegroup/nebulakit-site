<script lang="ts">
	/**
	 * A Lighthouse-style score dial: a ring whose arc is the score, with the
	 * number in the middle.
	 *
	 * The arc trick is a circle of radius 15.9155 — circumference 2πr ≈ 100 — so
	 * `stroke-dasharray: {value} 100` draws exactly `value` percent without any
	 * arithmetic. Changing the radius silently breaks that, which is why it is
	 * a constant here rather than a prop.
	 *
	 * Colour follows Lighthouse's own bands (90+ green, 50–89 amber, below 50
	 * red) but is never the only carrier: the number is the value, and the arc
	 * length says the same thing again for anyone who cannot separate the hues.
	 */

	/** The score, 0–100. */
	export let value: number;
	/**
	 * What the score is *of*, for assistive technology. Leave unset inside a
	 * table, where the column header already names the category — otherwise a
	 * screen reader reads "Performance, Performance: 100 out of 100".
	 */
	export let label: string = '';

	const RADIUS = 15.9155;

	// Clamped because the ring is drawn from this directly. A value outside
	// 0–100 would render an arc longer than the circle, which reads as a full
	// ring — the most flattering possible way to display bad data.
	$: arc = Math.max(0, Math.min(100, value));
	$: band = arc >= 90 ? 'good' : arc >= 50 ? 'average' : 'poor';
</script>

<div
	class="ring {band}"
	role="img"
	aria-label={label ? `${label}: ${value} out of 100` : `${value} out of 100`}
>
	<svg viewBox="0 0 36 36" aria-hidden="true" focusable="false">
		<circle class="track" cx="18" cy="18" r={RADIUS} />
		<circle class="arc" cx="18" cy="18" r={RADIUS} stroke-dasharray="{arc} 100" />
	</svg>
	<span class="num">{value}</span>
</div>

<style>
	.ring {
		position: relative;
		display: grid;
		place-items: center;
		width: var(--ring-size, 3rem);
		height: var(--ring-size, 3rem);
	}

	svg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		/* Start the arc at twelve o'clock instead of three. */
		transform: rotate(-90deg);
	}

	circle {
		fill: none;
		stroke-width: 3;
		stroke-linecap: round;
	}

	.track {
		stroke: var(--color-border);
	}

	.arc {
		transition: stroke-dasharray var(--transition-base, 250ms) ease-out;
	}

	.num {
		position: relative;
		/* Scales with the dial: stroke-width is in viewBox units and follows the
		   size on its own, but the number is real text and does not. */
		font-size: var(--ring-font, 0.875rem);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-text);
		line-height: 1;
	}

	.good .arc {
		stroke: var(--color-success);
	}

	.average .arc {
		stroke: var(--color-warning);
	}

	.poor .arc {
		stroke: var(--color-error);
	}

	/* The tint behind the number, at the same hue as the arc but far enough back
	   to keep --color-text at full contrast on top of it. */
	.good {
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--color-success) 14%, transparent) 55%,
			transparent 70%
		);
	}

	.average {
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--color-warning) 14%, transparent) 55%,
			transparent 70%
		);
	}

	.poor {
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--color-error) 14%, transparent) 55%,
			transparent 70%
		);
	}

	@media (prefers-reduced-motion: reduce) {
		.arc {
			transition: none;
		}
	}
</style>
