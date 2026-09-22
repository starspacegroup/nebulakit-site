<script lang="ts">
	/**
	 * The NebulaKit mark — rings and a core, on its rounded tile.
	 *
	 * This is the same artwork as `static/favicon.svg`, redrawn flat: no radial
	 * gradient, no glow filter, no background stars. Two reasons, and both are
	 * the reason the badge mark is drawn this way too:
	 *
	 * 1. Those features all need an `id`. The nav, the mobile menu and the
	 *    footer each render one of these, so a page carries three copies — and
	 *    three `id="glow"` in one document means two of them resolve to the
	 *    wrong element.
	 * 2. At 20–24px the gradient, the glow and the six 2px stars turn to mud.
	 *    They earn their place on a 512px tile and cost legibility here.
	 *
	 * Inline rather than `<img src="/favicon.svg">` so the chrome costs no extra
	 * request and cannot flash an empty box before it loads. It replaced a ✨
	 * emoji, which rendered as whatever the reader's OS supplies.
	 */

	/** Rendered size in px. Matches the text beside it rather than a fixed scale. */
	export let size = 24;
</script>

<svg
	class="logo-mark"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	role="presentation"
	focusable="false"
>
	<rect width="24" height="24" rx="6" fill="#12142a" />
	<g fill="none" stroke-width="1.4">
		<ellipse cx="12" cy="12" rx="9" ry="3.2" stroke="#7c3aed" transform="rotate(-20 12 12)" />
		<ellipse
			cx="12"
			cy="12"
			rx="7.6"
			ry="2.7"
			stroke="#06b6d4"
			stroke-width="1.1"
			opacity="0.8"
			transform="rotate(22 12 12)"
		/>
	</g>
	<circle cx="12" cy="12" r="3.1" fill="#a855f7" />
	<circle cx="12" cy="12" r="1.7" fill="#e9d5ff" />
</svg>

<style>
	.logo-mark {
		display: block;
		flex: none;
		border-radius: 25%;
	}
</style>
