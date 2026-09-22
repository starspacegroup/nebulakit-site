/**
 * The "Proudly built with NebulaKit" badge, in every form someone might need it.
 *
 * This module is the single source for the badge: its wording, its colours, its
 * geometry, the SVG that READMEs embed, and every copy-paste snippet the
 * `/badge` page hands out. Change it here and the page, the image endpoint and
 * all six snippets move together.
 *
 * Two constraints shape everything below, and both are easy to forget:
 *
 * 1. **The badge lands on sites we do not own.** It cannot reference a NebulaKit
 *    theme token, a font, a stylesheet or an image URL and expect it to resolve.
 *    Every colour is a literal. That is the opposite of the rule inside this
 *    app, and it is deliberate.
 *
 * 2. **An SVG used as an `<img>` may not fetch anything external.** A README
 *    badge is exactly that. A referenced mark would fail silently — a blank
 *    space with nothing to explain it.
 *
 * The sibling badge at *Space solves (2) by inlining its mark as a base64 PNG,
 * because its master artwork is a photograph of carved wood. Ours is vector, so
 * the mark travels as real SVG elements nested in the badge: a few hundred bytes
 * instead of four kilobytes, crisp at any size, and no generated file to keep in
 * step. The one rule that buys is below — the mark may not use `id`.
 *
 * Kept dependency-free so the image endpoint, the page and the tests can all
 * import it without dragging `$app` or Node APIs into a Worker.
 */

import lighthouse from './lighthouse-results.json';

/** Where the badge points, and what it calls itself. */
export const BADGE_HREF = 'https://nebulakit.starspace.group';
export const BADGE_BRAND = 'NebulaKit';

/**
 * The wordings on offer.
 *
 * Three, not one, because the badge has three honest uses: a product someone is
 * pleased to have built on the template, a plain statement of what it was built
 * with, and a thing that merely runs on it. A single wording would have people
 * editing the snippet to say something slightly untrue.
 */
export const BADGE_VARIANTS = {
	proudly: 'Proudly built with',
	built: 'Built with',
	powered: 'Powered by'
} as const;

export type BadgeVariant = keyof typeof BADGE_VARIANTS;
export type BadgeTheme = 'dark' | 'light';

export const BADGE_VARIANT_KEYS = Object.keys(BADGE_VARIANTS) as readonly BadgeVariant[];

/**
 * True for a value that names one of the wordings above.
 *
 * `hasOwnProperty`, not `in`: `in` walks the prototype chain, so `'toString'`
 * and `'constructor'` would pass this guard and then index `BADGE_VARIANTS` to a
 * function, which the SVG would happily render as its label. `/badge.svg` takes
 * its variant straight from the query string, so that is reachable by URL.
 */
export function isBadgeVariant(value: unknown): value is BadgeVariant {
	return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BADGE_VARIANTS, value);
}

/** True for a value that names one of the two grounds. */
export function isBadgeTheme(value: unknown): value is BadgeTheme {
	return value === 'dark' || value === 'light';
}

/**
 * Literal colours, not theme tokens.
 *
 * `src/app.css` owns this app's palette, but a token is a promise about a
 * stylesheet the host page has never loaded. These are chosen to clear WCAG AA
 * against their own ground: the label reaches 10.7:1 on the dark pill and 6.3:1
 * on the light one, the brand text 17:1 on both.
 */
export const BADGE_THEMES: Record<
	BadgeTheme,
	{
		background: string;
		border: string;
		label: string;
		brand: string;
	}
> = {
	dark: {
		background: '#14162b',
		border: '#2e3150',
		label: '#c3c8dd',
		brand: '#ffffff'
	},
	light: {
		background: '#ffffff',
		border: '#dee2e6',
		label: '#5a6169',
		brand: '#1a1a1a'
	}
};

/**
 * The nebula mark, as SVG elements on a 24-unit grid.
 *
 * A simplification of `static/favicon.svg`, not a copy of it. The favicon has a
 * glow filter, a radial gradient and six background stars, all of which turn to
 * mud at 16px and every one of which needs an `id`. This has flat fills, thicker
 * strokes and nothing smaller than a pixel — and, because it carries no `id`, it
 * can be nested inside a host page's inline SVG without two badges on the same
 * page colliding over a gradient name.
 *
 * The dark tile is part of the mark rather than the ground. It is what lets one
 * mark sit on both the dark and the light pill without a second variant.
 */
export const MARK_VIEWBOX = '0 0 24 24';

const MARK_BODY = [
	'<rect width="24" height="24" rx="6" fill="#12142a"/>',
	'<g fill="none" stroke-width="1.4">',
	'<ellipse cx="12" cy="12" rx="9" ry="3.2" stroke="#7c3aed"',
	' transform="rotate(-20 12 12)"/>',
	'<ellipse cx="12" cy="12" rx="7.6" ry="2.7" stroke="#06b6d4" stroke-width="1.1"',
	' opacity="0.8" transform="rotate(22 12 12)"/>',
	'</g>',
	'<circle cx="12" cy="12" r="3.1" fill="#a855f7"/>',
	'<circle cx="12" cy="12" r="1.7" fill="#e9d5ff"/>'
].join('');

/**
 * The mark as a standalone `<svg>` of a given size.
 *
 * `role="presentation"` because every place this is used puts the badge's words
 * beside it: an accessible name here would have a screen reader read the brand
 * twice. The standalone `/badge-mark.svg` endpoint overrides that.
 */
export function markSvg(size = 16, attrs = 'role="presentation"'): string {
	return (
		`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"` +
		` viewBox="${MARK_VIEWBOX}" ${attrs}>${MARK_BODY}</svg>`
	);
}

/**
 * The mark nested inside a larger SVG, placed at (x, y).
 *
 * No `xmlns` and no `role`: it is a child element of a document that already
 * declared the namespace, and the badge around it carries the label.
 */
function nestedMark(x: number, y: number, size: number): string {
	return (
		`<svg x="${x}" y="${y}" width="${size}" height="${size}"` +
		` viewBox="${MARK_VIEWBOX}">${MARK_BODY}</svg>`
	);
}

/**
 * Geometry for the standalone SVG.
 *
 * The SVG has to state its own size in pixels because a README renders it at
 * intrinsic size with no CSS to help, and there is no text metrics API in a
 * Worker to measure with. So the width is estimated from the advance tables
 * below — and, separately, the label and the brand are laid out by the renderer
 * rather than by us.
 *
 * Both halves of that matter. Placing each run at a computed x from one average
 * advance per glyph is wrong in opposite directions for different words:
 * "POWERED BY" is full of wide capitals while "BUILT WITH" is narrow, so one
 * collides with the brand and the other leaves a gulf. They are two tspans in
 * one text element instead, so the renderer puts the second exactly after the
 * first, and the whole run is centred in the space the mark leaves. The estimate
 * therefore only decides how wide the pill is, and being a few pixels out shows
 * as slightly uneven padding rather than as a collision.
 */
const SVG = {
	height: 28,
	padX: 10,
	gap: 6,
	markSize: 16,
	labelSize: 10.5,
	brandSize: 12,
	/** Extra tracking applied to the uppercase label. */
	labelTracking: 0.8,
	/** Slack on the estimate, so a narrow font pads rather than overflows. */
	slack: 1.02
};

/**
 * Advance widths per 1000 units of font size.
 *
 * Helvetica/Arial metrics. The badge renders in whatever UI font the reader
 * has, which is not Helvetica — but every UI sans is close enough for a pill
 * width, and the alternative is one number for `M` and `I` alike.
 */
export const UPPERCASE_ADVANCE: Record<string, number> = {
	A: 667,
	B: 667,
	C: 722,
	D: 722,
	E: 667,
	F: 611,
	G: 778,
	H: 722,
	I: 278,
	J: 500,
	K: 667,
	L: 556,
	M: 833,
	N: 722,
	O: 778,
	P: 667,
	Q: 778,
	R: 722,
	S: 667,
	T: 611,
	U: 722,
	V: 667,
	W: 944,
	X: 667,
	Y: 667,
	Z: 611,
	' ': 278
};

/** The same, for the mixed-case semibold brand. */
export const BRAND_ADVANCE: Record<string, number> = {
	N: 722,
	e: 556,
	b: 611,
	u: 611,
	l: 278,
	a: 556,
	K: 667,
	i: 278,
	t: 333
};

/**
 * Digits and the separator, for the score badge.
 *
 * Helvetica gives every digit the same 556 advance on purpose — it is what
 * makes tabular figures line up — so a score of 100 and a score of 89 reserve
 * the same width and the pill does not resize as the number changes.
 */
export const DIGIT_ADVANCE: Record<string, number> = {
	'0': 556,
	'1': 556,
	'2': 556,
	'3': 556,
	'4': 556,
	'5': 556,
	'6': 556,
	'7': 556,
	'8': 556,
	'9': 556,
	'·': 278,
	' ': 278
};

/** Advance for a glyph no table names — the average of the ones they do. */
export const FALLBACK_ADVANCE = 600;

/**
 * Estimated width of a run of text at a given size, tracking included.
 *
 * Exported for the test that pins the advance tables: every glyph in the three
 * wordings and in the brand is measured, and `FALLBACK_ADVANCE` is the net under
 * a fourth wording that one day carries a digit or a hyphen.
 */
export function textWidth(
	text: string,
	size: number,
	advance: Record<string, number>,
	tracking = 0
): number {
	let total = 0;
	for (const character of text) {
		total += ((advance[character] ?? FALLBACK_ADVANCE) / 1000) * size + tracking;
	}
	return total;
}

/** Escape for XML text nodes and attribute values. */
export function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** The full sentence a badge reads out, e.g. "Proudly built with NebulaKit". */
export function badgeText(variant: BadgeVariant): string {
	return `${BADGE_VARIANTS[variant]} ${BADGE_BRAND}`;
}

/** Estimated pixel width of the rendered badge, used to size the SVG. */
export function badgeWidth(variant: BadgeVariant): number {
	const label = BADGE_VARIANTS[variant].toUpperCase();
	const labelW = textWidth(label, SVG.labelSize, UPPERCASE_ADVANCE, SVG.labelTracking);
	const brandW = textWidth(BADGE_BRAND, SVG.brandSize, BRAND_ADVANCE);
	const content = SVG.markSize + SVG.gap + labelW + SVG.gap + brandW;
	return Math.round(SVG.padX * 2 + content * SVG.slack);
}

/**
 * The badge as a standalone SVG — what `/badge.svg` serves and what a README
 * embeds. Self-contained: no external font, no external image, no CSS.
 *
 * Fonts are named as a stack and will resolve to whatever the viewer has; a
 * badge that renders in the reader's own UI font looks intentional, whereas an
 * embedded webfont would bloat every README that uses it.
 */
export function renderBadgeSvg(variant: BadgeVariant = 'proudly', theme: BadgeTheme = 'dark') {
	const c = BADGE_THEMES[theme];
	const w = badgeWidth(variant);
	const h = SVG.height;
	const label = BADGE_VARIANTS[variant].toUpperCase();
	const markX = SVG.padX;
	const markY = (h - SVG.markSize) / 2;
	/* The text runs as one chunk, centred in what the mark leaves. Anchoring it
	   in the middle is what turns an inaccurate estimate into even padding. */
	const textStart = markX + SVG.markSize + SVG.gap;
	const textX = textStart + (w - SVG.padX - textStart) / 2;
	const font =
		'-apple-system,BlinkMacSystemFont,&apos;Segoe UI&apos;,Roboto,Helvetica,Arial,sans-serif';
	const alt = escapeXml(badgeText(variant));

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"`,
		` role="img" aria-label="${alt}">`,
		`<title>${alt}</title>`,
		`<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${(h - 1) / 2}"`,
		` fill="${c.background}" stroke="${c.border}"/>`,
		nestedMark(markX, markY, SVG.markSize),
		`<text x="${textX}" y="${h / 2}" text-anchor="middle" dominant-baseline="central"`,
		` font-family="${font}">`,
		`<tspan font-size="${SVG.labelSize}" letter-spacing="${SVG.labelTracking}"`,
		` fill="${c.label}">${escapeXml(label)}</tspan>`,
		`<tspan dx="${SVG.gap}" font-size="${SVG.brandSize}" font-weight="600"`,
		` fill="${c.brand}">${escapeXml(BADGE_BRAND)}</tspan>`,
		`</text>`,
		`</svg>`
	].join('');
}

/** Absolute URL of the SVG endpoint for a given variant and theme. */
export function badgeSvgUrl(origin: string, variant: BadgeVariant, theme: BadgeTheme): string {
	return `${origin.replace(/\/$/, '')}/badge.svg?variant=${variant}&theme=${theme}`;
}

/**
 * The copy-paste snippets.
 *
 * `auto` themes follow the reader's own `prefers-color-scheme`. The HTML and
 * web-component forms can do that honestly; Markdown cannot — a README has no
 * media queries — so the Markdown snippet always names a fixed theme, and the
 * page says so rather than leaving the reader to discover it.
 */
export interface SnippetOptions {
	variant: BadgeVariant;
	theme: BadgeTheme;
	/** Origin the snippet should point at, e.g. "https://nebulakit.starspace.group". */
	origin: string;
}

export interface Snippets {
	html: string;
	webComponent: string;
	react: string;
	svelte: string;
	vue: string;
	markdown: string;
}

const CLASS = 'nebulakit-badge';

/** Inline CSS shared by the framework snippets, as one class block. */
function styleBlock(theme: BadgeTheme): string {
	const c = BADGE_THEMES[theme];
	const other = BADGE_THEMES[theme === 'dark' ? 'light' : 'dark'];
	return `.${CLASS}{display:inline-flex;align-items:center;gap:.5rem;padding:.4rem .75rem;
  border:1px solid ${c.border};border-radius:999px;background:${c.background};
  font:500 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:${c.label};text-decoration:none}
.${CLASS} svg{width:16px;height:16px;flex:none}
.${CLASS} b{font-weight:600;color:${c.brand}}
.${CLASS} span{letter-spacing:.08em;text-transform:uppercase;font-size:10.5px}
@media (prefers-color-scheme:${theme === 'dark' ? 'light' : 'dark'}){
  .${CLASS}{border-color:${other.border};background:${other.background};color:${other.label}}
  .${CLASS} b{color:${other.brand}}
}`;
}

export function badgeSnippets({ variant, theme, origin }: SnippetOptions): Snippets {
	const base = origin.replace(/\/$/, '');
	const label = BADGE_VARIANTS[variant];
	const alt = badgeText(variant);
	const style = styleBlock(theme);
	/* The mark is inlined into each snippet rather than linked. A linked image
	   is one more request against this origin from someone else's page, and it
	   breaks the moment we move the file; the markup is 300 bytes. */
	const mark = markSvg(16, 'aria-hidden="true"');

	const html = `<!-- ${alt} -->
<style>
${style}
</style>
<a class="${CLASS}" href="${BADGE_HREF}" target="_blank" rel="noopener">
  ${mark}
  <span>${label}</span>
  <b>${BADGE_BRAND}</b>
</a>`;

	const webComponent = `<!-- One line. Follows the reader's colour scheme on its own. -->
<script src="${base}/badge.js" async></script>
<nebulakit-badge variant="${variant}"></nebulakit-badge>`;

	const react = `export function NebulaKitBadge() {
  return (
    <a
      className="${CLASS}"
      href="${BADGE_HREF}"
      target="_blank"
      rel="noopener noreferrer"
    >
      <svg
        width="16"
        height="16"
        viewBox="${MARK_VIEWBOX}"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: ${JSON.stringify(MARK_BODY)} }}
      />
      <span>${label}</span>
      <b>${BADGE_BRAND}</b>
    </a>
  );
}

/* Pair with this CSS (a module, Tailwind layer, or a plain stylesheet):
${style}
*/`;

	const svelte = `<a class="${CLASS}" href="${BADGE_HREF}" target="_blank" rel="noopener">
  ${mark}
  <span>${label}</span>
  <b>${BADGE_BRAND}</b>
</a>

<style>
${style}
</style>`;

	const vue = `<template>
  <a class="${CLASS}" href="${BADGE_HREF}" target="_blank" rel="noopener">
    ${mark}
    <span>${label}</span>
    <b>${BADGE_BRAND}</b>
  </a>
</template>

<style scoped>
${style}
</style>`;

	const markdown = `[![${alt}](${badgeSvgUrl(base, variant, theme)})](${BADGE_HREF})`;

	return { html, webComponent, react, svelte, vue, markdown };
}

/**
 * The custom element served at `/badge.js`.
 *
 * Shadow DOM so the host page's CSS cannot reach in and the badge's CSS cannot
 * leak out — on someone else's site both directions matter. It is a string
 * rather than a real module because it is served as a built asset, not bundled.
 */
export function badgeElementScript(): string {
	const variants = JSON.stringify(BADGE_VARIANTS);
	const themes = JSON.stringify(BADGE_THEMES);
	const mark = JSON.stringify(markSvg(16, 'aria-hidden="true"'));
	return `/* <nebulakit-badge> — ${BADGE_HREF} */
(function () {
  if (customElements.get('nebulakit-badge')) return;
  var VARIANTS = ${variants};
  var THEMES = ${themes};
  var MARK = ${mark};
  customElements.define(
    'nebulakit-badge',
    class extends HTMLElement {
      connectedCallback() {
        var variant = this.getAttribute('variant');
        // hasOwnProperty, not truthiness: VARIANTS['toString'] is a function,
        // and the badge would print it. Same trap as isBadgeVariant.
        if (!Object.prototype.hasOwnProperty.call(VARIANTS, variant)) variant = 'proudly';
        var forced = this.getAttribute('theme');
        var root = this.attachShadow({ mode: 'open' });
        var d = THEMES.dark;
        var l = THEMES.light;
        // Default: dark ground with a light-scheme override. A forced theme
        // pins the ground and drops the media query entirely.
        var base_ = forced === 'light' ? l : d;
        var alt = forced === 'light' ? d : l;
        root.innerHTML =
          '<style>' +
          ':host{display:inline-block}' +
          'a{display:inline-flex;align-items:center;gap:.5rem;padding:.4rem .75rem;' +
          'border:1px solid ' + base_.border + ';border-radius:999px;background:' + base_.background + ';' +
          'font:500 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;' +
          'color:' + base_.label + ';text-decoration:none}' +
          'svg{width:16px;height:16px;flex:none}' +
          'b{font-weight:600;color:' + base_.brand + '}' +
          'span{letter-spacing:.08em;text-transform:uppercase;font-size:10.5px}' +
          (forced
            ? ''
            : '@media (prefers-color-scheme:light){' +
              'a{border-color:' + alt.border + ';background:' + alt.background + ';color:' + alt.label + '}' +
              'b{color:' + alt.brand + '}}') +
          '</style>' +
          '<a href="${BADGE_HREF}" target="_blank" rel="noopener">' +
          MARK +
          '<span>' + VARIANTS[variant] + '</span><b>${BADGE_BRAND}</b></a>';
      }
    }
  );
})();
`;
}

/* ── The Lighthouse badge ──────────────────────────────────────────────────
 *
 * The same pill, the same mark, the same two grounds — saying the thing the
 * home page says: every audited page scores 100.
 *
 * The number is NOT a constant. It is read out of lighthouse-results.json,
 * which scripts/lighthouse.mjs writes, so the badge is the audit rather than a
 * claim about it. If a score drops, every README carrying this badge starts
 * showing the lower number in amber on the next fetch, without anyone
 * remembering to go and change it. A badge that cannot become wrong is the
 * only kind worth handing out.
 */

export const LIGHTHOUSE_LABEL = 'Lighthouse';

/** Category keys in the order the audit reports them. */
const LIGHTHOUSE_KEYS = lighthouse.categories as readonly string[];

type Scores = Record<string, number>;

/** Every audited score, flattened across both targets and all their pages. */
function lighthouseScores(): number[] {
	return lighthouse.targets.flatMap((target) =>
		target.pages.flatMap((page) => LIGHTHOUSE_KEYS.map((key) => (page.scores as Scores)[key]))
	);
}

/**
 * The lowest score anywhere — what the badge shows.
 *
 * A floor, not an average, for the same reason the home page leads with one:
 * an average of 100 and a floor of 100 are the same number until they are not,
 * and only the floor cannot hide a single bad page behind ten good ones.
 */
export function lighthouseFloor(): number {
	return Math.min(...lighthouseScores());
}

/** The lowest score in each category, in report order. */
export function lighthouseCategoryFloors(): number[] {
	return LIGHTHOUSE_KEYS.map((key) =>
		Math.min(...lighthouse.targets.flatMap((t) => t.pages.map((p) => (p.scores as Scores)[key])))
	);
}

export const LIGHTHOUSE_BADGE_VARIANTS = {
	overall: 'the lowest score across every audited page and category',
	categories: 'the lowest score in each of the four categories'
} as const;

export type LighthouseBadgeVariant = keyof typeof LIGHTHOUSE_BADGE_VARIANTS;

export const LIGHTHOUSE_BADGE_VARIANT_KEYS = Object.keys(
	LIGHTHOUSE_BADGE_VARIANTS
) as readonly LighthouseBadgeVariant[];

/** True for a value naming one of the two. `hasOwnProperty`, for the reason in {@link isBadgeVariant}. */
export function isLighthouseBadgeVariant(value: unknown): value is LighthouseBadgeVariant {
	return (
		typeof value === 'string' &&
		Object.prototype.hasOwnProperty.call(LIGHTHOUSE_BADGE_VARIANTS, value)
	);
}

/**
 * Lighthouse's own bands, and the same ones ScoreRing.svelte draws with: 90 and
 * up is green, 50 to 89 amber, below that red. Literals rather than the theme's
 * success/warning/error tokens, because this SVG renders on pages that never
 * loaded our stylesheet.
 */
const SCORE_COLOURS = { good: '#0cce6b', average: '#ffa400', poor: '#ff4e42' };

export function scoreColour(score: number): string {
	if (score >= 90) return SCORE_COLOURS.good;
	if (score >= 50) return SCORE_COLOURS.average;
	return SCORE_COLOURS.poor;
}

/** What the badge prints as its value, for a given variant. */
export function lighthouseBadgeValue(variant: LighthouseBadgeVariant): string {
	return variant === 'categories'
		? lighthouseCategoryFloors().join(' · ')
		: String(lighthouseFloor());
}

/** The sentence the badge reads out to a screen reader. */
export function lighthouseBadgeText(variant: LighthouseBadgeVariant): string {
	if (variant === 'categories') {
		const named = LIGHTHOUSE_KEYS.map(
			(key, i) => `${key.replace(/-/g, ' ')} ${lighthouseCategoryFloors()[i]}`
		);
		return `Lighthouse: ${named.join(', ')}, out of 100`;
	}
	return `Lighthouse ${lighthouseFloor()} out of 100`;
}

/** Estimated pixel width of the score badge. */
export function lighthouseBadgeWidth(variant: LighthouseBadgeVariant): number {
	const label = LIGHTHOUSE_LABEL.toUpperCase();
	const labelW = textWidth(label, SVG.labelSize, UPPERCASE_ADVANCE, SVG.labelTracking);
	const valueW = textWidth(lighthouseBadgeValue(variant), SVG.brandSize, DIGIT_ADVANCE);
	const content = SVG.markSize + SVG.gap + labelW + SVG.gap + valueW;
	return Math.round(SVG.padX * 2 + content * SVG.slack);
}

/**
 * The Lighthouse badge as a standalone SVG. Self-contained, like the brand
 * badge: no external font, no external image, no CSS, no `id`.
 */
export function renderLighthouseBadgeSvg(
	variant: LighthouseBadgeVariant = 'overall',
	theme: BadgeTheme = 'dark'
): string {
	const c = BADGE_THEMES[theme];
	const w = lighthouseBadgeWidth(variant);
	const h = SVG.height;
	const label = LIGHTHOUSE_LABEL.toUpperCase();
	const value = lighthouseBadgeValue(variant);
	const markX = SVG.padX;
	const markY = (h - SVG.markSize) / 2;
	const textStart = markX + SVG.markSize + SVG.gap;
	const textX = textStart + (w - SVG.padX - textStart) / 2;
	const font =
		'-apple-system,BlinkMacSystemFont,&apos;Segoe UI&apos;,Roboto,Helvetica,Arial,sans-serif';
	const alt = escapeXml(lighthouseBadgeText(variant));
	// The worst of the printed numbers decides the colour, so a badge showing
	// four scores goes amber on the strength of its weakest one.
	const worst =
		variant === 'categories' ? Math.min(...lighthouseCategoryFloors()) : lighthouseFloor();

	return [
		`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"`,
		` role="img" aria-label="${alt}">`,
		`<title>${alt}</title>`,
		`<rect x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="${(h - 1) / 2}"`,
		` fill="${c.background}" stroke="${c.border}"/>`,
		nestedMark(markX, markY, SVG.markSize),
		`<text x="${textX}" y="${h / 2}" text-anchor="middle" dominant-baseline="central"`,
		` font-family="${font}">`,
		`<tspan font-size="${SVG.labelSize}" letter-spacing="${SVG.labelTracking}"`,
		` fill="${c.label}">${escapeXml(label)}</tspan>`,
		`<tspan dx="${SVG.gap}" font-size="${SVG.brandSize}" font-weight="700"`,
		` fill="${scoreColour(worst)}">${escapeXml(value)}</tspan>`,
		`</text>`,
		`</svg>`
	].join('');
}

/** Absolute URL of the Lighthouse badge endpoint. */
export function lighthouseBadgeUrl(
	origin: string,
	variant: LighthouseBadgeVariant,
	theme: BadgeTheme
): string {
	return `${origin.replace(/\/$/, '')}/badge-lighthouse.svg?variant=${variant}&theme=${theme}`;
}

/**
 * Snippets for the score badge.
 *
 * Two, not six. The brand badge offers a component for every framework because
 * it is chrome that lives in a footer and should be real text; this one is a
 * measurement, its value changes when the audit changes, and a README is where
 * it belongs. A hand-copied component would freeze the number at the moment
 * somebody pasted it, which is exactly the failure this badge exists to avoid.
 */
export function lighthouseBadgeSnippets(options: {
	variant: LighthouseBadgeVariant;
	theme: BadgeTheme;
	origin: string;
}): { markdown: string; html: string } {
	const base = options.origin.replace(/\/$/, '');
	const url = lighthouseBadgeUrl(base, options.variant, options.theme);
	const alt = lighthouseBadgeText(options.variant);

	return {
		markdown: `[![${alt}](${url})](${BADGE_HREF})`,
		html: `<a href="${BADGE_HREF}" target="_blank" rel="noopener">
  <img src="${url}" alt="${alt}" height="28" />
</a>`
	};
}
