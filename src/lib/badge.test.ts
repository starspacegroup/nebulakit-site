/**
 * The badge module.
 *
 * The badge is pasted into repositories and sites nobody here controls, so the
 * failures worth guarding against are the ones we would never see: a snippet
 * that quietly points at the wrong origin, an SVG that needs a file it cannot
 * fetch, a mark with an `id` that collides with the host page's own artwork.
 * Those are what this file asserts, ahead of anything cosmetic.
 */
import { describe, expect, it } from 'vitest';

import {
	BADGE_BRAND,
	BADGE_HREF,
	BADGE_THEMES,
	BADGE_VARIANTS,
	BADGE_VARIANT_KEYS,
	badgeElementScript,
	badgeSnippets,
	badgeSvgUrl,
	badgeText,
	badgeWidth,
	escapeXml,
	isBadgeTheme,
	isBadgeVariant,
	markSvg,
	renderBadgeSvg,
	textWidth,
	BRAND_ADVANCE,
	FALLBACK_ADVANCE,
	UPPERCASE_ADVANCE,
	DIGIT_ADVANCE,
	isLighthouseBadgeVariant,
	lighthouseBadgeSnippets,
	lighthouseBadgeText,
	lighthouseBadgeValue,
	lighthouseBadgeWidth,
	lighthouseCategoryFloors,
	lighthouseFloor,
	LIGHTHOUSE_BADGE_VARIANT_KEYS,
	renderLighthouseBadgeSvg,
	scoreColour,
	type BadgeVariant
} from './badge';

const ORIGIN = 'https://example.test';

/** Relative luminance, then the WCAG contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
	const luminance = (hex: string) => {
		const channels = [1, 3, 5]
			.map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
			.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
		return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
	};
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

describe('wordings', () => {
	it('offers the badge this whole thing is named for', () => {
		expect(badgeText('proudly')).toBe('Proudly built with NebulaKit');
	});

	it('spells the brand the way the brand notes require', () => {
		// "NebulaKit" — one word, camel-cased. Never "Nebula Kit" or "nebulakit".
		expect(BADGE_BRAND).toBe('NebulaKit');
		for (const key of BADGE_VARIANT_KEYS) {
			expect(badgeText(key)).toContain('NebulaKit');
			expect(badgeText(key)).not.toMatch(/Nebula Kit|nebulakit/);
		}
	});

	it('points every form at the badge home', () => {
		expect(BADGE_HREF).toBe('https://nebulakit.starspace.group');
	});
});

describe('isBadgeVariant', () => {
	it('accepts the wordings on offer', () => {
		for (const key of BADGE_VARIANT_KEYS) expect(isBadgeVariant(key)).toBe(true);
	});

	it('rejects an inherited property', () => {
		// `value in BADGE_VARIANTS` walks the prototype chain, so these once
		// passed and then indexed the table to a function — which the SVG
		// rendered as its label. `/badge.svg` takes its variant from the query
		// string, so this was reachable by URL.
		for (const probe of ['toString', 'constructor', 'hasOwnProperty', '__proto__', 'valueOf']) {
			expect(isBadgeVariant(probe)).toBe(false);
		}
	});

	it('rejects a non-string', () => {
		for (const probe of [null, undefined, 0, {}, ['proudly']]) {
			expect(isBadgeVariant(probe)).toBe(false);
		}
	});
});

describe('isBadgeTheme', () => {
	it('accepts the two grounds and nothing else', () => {
		expect(isBadgeTheme('dark')).toBe(true);
		expect(isBadgeTheme('light')).toBe(true);
		for (const probe of ['sepia', '', null, undefined, 0]) expect(isBadgeTheme(probe)).toBe(false);
	});
});

describe('colours', () => {
	it('clears WCAG AA on its own ground, both ways round', () => {
		// The badge lands on pages with no stylesheet of ours, so these literals
		// are the only guarantee the text is readable at all.
		for (const theme of Object.values(BADGE_THEMES)) {
			expect(contrast(theme.label, theme.background)).toBeGreaterThanOrEqual(4.5);
			expect(contrast(theme.brand, theme.background)).toBeGreaterThanOrEqual(4.5);
		}
	});

	it('names every colour as a literal, never a theme token', () => {
		// A `var(--…)` here is a promise about a stylesheet the host never loaded.
		for (const theme of Object.values(BADGE_THEMES)) {
			for (const value of Object.values(theme)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
		}
	});
});

describe('the mark', () => {
	it('carries no id, so two badges on one page cannot collide', () => {
		// This is the whole reason the mark is a flat simplification of the
		// favicon rather than the favicon itself: gradients and filters need ids,
		// and an id repeated in a host page's inline SVG resolves to the wrong one.
		expect(markSvg()).not.toMatch(/\bid=/);
		expect(renderBadgeSvg()).not.toMatch(/\bid=/);
	});

	it('fetches nothing', () => {
		// An SVG used as an `<img>` may not load external resources, and a README
		// badge is exactly that. A reference here would fail as a blank space.
		expect(markSvg()).not.toMatch(/href=|url\(|<image/);
	});

	it('takes a size and an accessible name', () => {
		const svg = markSvg(64, 'role="img" aria-label="NebulaKit"');
		expect(svg).toContain('width="64"');
		expect(svg).toContain('height="64"');
		expect(svg).toContain('aria-label="NebulaKit"');
	});

	it('is presentational by default, because the badge says the name beside it', () => {
		expect(markSvg()).toContain('role="presentation"');
	});
});

describe('textWidth', () => {
	it('measures every glyph the badge can actually print', () => {
		// The fallback advance is the net under a fourth wording that one day
		// carries a digit or a hyphen; nothing shipping today should reach it.
		const label = new Set<string>();
		for (const key of BADGE_VARIANT_KEYS) {
			for (const ch of BADGE_VARIANTS[key].toUpperCase()) label.add(ch);
		}
		for (const ch of label) expect(UPPERCASE_ADVANCE).toHaveProperty([ch]);
		for (const ch of BADGE_BRAND) expect(BRAND_ADVANCE).toHaveProperty([ch]);
	});

	it('adds tracking once per glyph', () => {
		expect(textWidth('AA', 1000, { A: 500 }, 10)).toBeCloseTo(1020, 5);
	});

	it('falls back for a glyph no table names', () => {
		expect(textWidth('\u00a7', 1000, {})).toBe(FALLBACK_ADVANCE);
	});
});

describe('badgeWidth', () => {
	it('grows with the wording', () => {
		expect(badgeWidth('proudly')).toBeGreaterThan(badgeWidth('built'));
		expect(badgeWidth('powered')).toBeGreaterThan(badgeWidth('built'));
	});

	it('stays a whole number of pixels', () => {
		for (const key of BADGE_VARIANT_KEYS) expect(badgeWidth(key) % 1).toBe(0);
	});
});

describe('escapeXml', () => {
	it('escapes everything that can close a tag or an attribute', () => {
		expect(escapeXml(`<a href="x" title='y'>&`)).toBe(
			'&lt;a href=&quot;x&quot; title=&apos;y&apos;&gt;&amp;'
		);
	});

	it('escapes the ampersand before the entities it introduces', () => {
		// Replacing `<` first would turn a literal "&lt;" into "&amp;lt;" — right —
		// but replacing `&` last would turn "<" into "&amp;lt;" too, which is wrong.
		expect(escapeXml('&lt;')).toBe('&amp;lt;');
	});
});

describe('renderBadgeSvg', () => {
	it('defaults to the proud wording on the dark ground', () => {
		const svg = renderBadgeSvg();
		expect(svg).toBe(renderBadgeSvg('proudly', 'dark'));
		expect(svg).toContain('PROUDLY BUILT WITH');
		expect(svg).toContain(BADGE_THEMES.dark.background);
	});

	it('states its own size, because a README has no CSS to help', () => {
		for (const key of BADGE_VARIANT_KEYS) {
			const svg = renderBadgeSvg(key);
			expect(svg).toContain(`width="${badgeWidth(key)}"`);
			expect(svg).toContain('height="28"');
			expect(svg).toContain(`viewBox="0 0 ${badgeWidth(key)} 28"`);
		}
	});

	it('names itself to a screen reader', () => {
		const svg = renderBadgeSvg('powered', 'light');
		expect(svg).toContain('role="img"');
		expect(svg).toContain('aria-label="Powered by NebulaKit"');
		expect(svg).toContain('<title>Powered by NebulaKit</title>');
	});

	it('keeps the label and the brand in one text element', () => {
		// Two tspans, so the renderer places the brand exactly after the label.
		// Positioning each run at a computed x put "POWERED BY" hard against the
		// brand and left a gulf after "BUILT WITH".
		const svg = renderBadgeSvg('built');
		expect(svg.match(/<text /g)).toHaveLength(1);
		expect(svg.match(/<tspan /g)).toHaveLength(2);
	});

	it('loads no font, no stylesheet and no image', () => {
		for (const key of BADGE_VARIANT_KEYS) {
			for (const theme of ['dark', 'light'] as const) {
				// The namespace declaration is itself an http:// URL and is not a fetch.
				const svg = renderBadgeSvg(key, theme).replace(/xmlns="[^"]*"/g, '');
				expect(svg).not.toMatch(/<image|@import|xlink:href|https?:\/\//);
			}
		}
	});

	it('declares the SVG namespace exactly once, on the outer element', () => {
		// The mark is nested, not referenced. A second xmlns would be harmless but
		// a missing outer one renders as nothing in an `<img>`.
		expect(renderBadgeSvg().match(/xmlns=/g)).toHaveLength(1);
	});
});

describe('badgeSvgUrl', () => {
	it('builds an absolute URL for the endpoint', () => {
		expect(badgeSvgUrl(ORIGIN, 'proudly', 'dark')).toBe(
			`${ORIGIN}/badge.svg?variant=proudly&theme=dark`
		);
	});

	it('does not double the slash on an origin that has a trailing one', () => {
		expect(badgeSvgUrl(`${ORIGIN}/`, 'built', 'light')).toBe(
			`${ORIGIN}/badge.svg?variant=built&theme=light`
		);
	});
});

describe('badgeSnippets', () => {
	const snippets = (variant: BadgeVariant = 'proudly') =>
		badgeSnippets({ variant, theme: 'dark', origin: ORIGIN });

	it('gives a form for each way someone might paste it', () => {
		expect(Object.keys(snippets()).sort()).toEqual(
			['html', 'markdown', 'react', 'svelte', 'vue', 'webComponent'].sort()
		);
	});

	it('links every form back to the badge home', () => {
		// The web component is the exception: it names neither the link nor the
		// wording, because the element supplies both at runtime. What it must
		// carry instead is asserted below.
		const { webComponent, ...spelled } = snippets();
		for (const code of Object.values(spelled)) expect(code).toContain(BADGE_HREF);
	});

	it('carries the chosen wording into every form that spells one out', () => {
		const { webComponent, ...spelled } = snippets('powered');
		for (const code of Object.values(spelled)) {
			expect(code).toContain('Powered by');
			expect(code).not.toContain('Proudly built with');
		}
		expect(webComponent).toContain('variant="powered"');
	});

	it('asks the host page for nothing but the image in the Markdown form', () => {
		// Markdown is the one form that has to fetch something — a README cannot
		// inline an SVG. Every other form draws the mark itself, so a host page
		// makes no request to this origin at all.
		const { markdown, ...inline } = snippets();
		expect(markdown).toContain(`${ORIGIN}/badge.svg`);
		for (const code of Object.values(inline)) {
			expect(code).not.toContain(`${ORIGIN}/badge.svg`);
			expect(code).not.toMatch(/<img/);
		}
	});

	it('points the web component at this origin, so a preview tests itself', () => {
		expect(snippets().webComponent).toContain(`${ORIGIN}/badge.js`);
	});

	it('ships a light-scheme override with the dark snippet, and the reverse', () => {
		const dark = badgeSnippets({ variant: 'proudly', theme: 'dark', origin: ORIGIN }).html;
		const light = badgeSnippets({ variant: 'proudly', theme: 'light', origin: ORIGIN }).html;
		expect(dark).toContain('prefers-color-scheme:light');
		expect(light).toContain('prefers-color-scheme:dark');
	});

	it('trims a trailing slash off the origin', () => {
		expect(
			badgeSnippets({ variant: 'built', theme: 'dark', origin: `${ORIGIN}/` }).markdown
		).toContain(`${ORIGIN}/badge.svg`);
	});
});

describe('badgeElementScript', () => {
	const script = badgeElementScript();

	it('defines the element once', () => {
		expect(script).toContain("customElements.get('nebulakit-badge')");
		expect(script).toContain('customElements.define(');
	});

	it('guards the variant with hasOwnProperty, like the module does', () => {
		// Without this, `<nebulakit-badge variant="toString">` printed the source
		// of a function into somebody else's footer.
		expect(script).toContain('Object.prototype.hasOwnProperty.call(VARIANTS, variant)');
	});

	it('renders into a shadow root so neither side can style the other', () => {
		expect(script).toContain("attachShadow({ mode: 'open' })");
	});

	it('needs nothing from the origin that served it', () => {
		// The mark is inlined, so the element works from a preview deployment, a
		// cached copy or a self-hosted paste without a second request.
		expect(script).not.toMatch(/src=|fetch\(/);
	});
});

describe('the Lighthouse badge', () => {
	it('reads its number from the audit rather than a constant', () => {
		// The whole point. A hand-written 100 would keep saying 100 after the
		// day it stopped being true, in every README that had ever copied it.
		const floors = lighthouseCategoryFloors();
		expect(floors.length).toBe(4);
		expect(lighthouseFloor()).toBe(Math.min(...floors));
		expect(lighthouseBadgeValue('overall')).toBe(String(lighthouseFloor()));
		expect(lighthouseBadgeValue('categories')).toBe(floors.join(' · '));
	});

	it("colours the score by Lighthouse's own bands", () => {
		// Same thresholds ScoreRing.svelte draws with, as literals rather than
		// theme tokens — this lands on pages with no stylesheet of ours.
		expect(scoreColour(100)).toBe('#0cce6b');
		expect(scoreColour(90)).toBe('#0cce6b');
		expect(scoreColour(89)).toBe('#ffa400');
		expect(scoreColour(50)).toBe('#ffa400');
		expect(scoreColour(49)).toBe('#ff4e42');
		expect(scoreColour(0)).toBe('#ff4e42');
	});

	it('takes its colour from the worst number it prints', () => {
		// A badge showing four scores must not look green on the strength of
		// three of them.
		const svg = renderLighthouseBadgeSvg('categories', 'dark');
		expect(svg).toContain(scoreColour(Math.min(...lighthouseCategoryFloors())));
	});

	it('rejects an inherited property as a variant', () => {
		for (const probe of ['toString', 'constructor', '__proto__', 'valueOf']) {
			expect(isLighthouseBadgeVariant(probe)).toBe(false);
		}
		for (const key of LIGHTHOUSE_BADGE_VARIANT_KEYS) {
			expect(isLighthouseBadgeVariant(key)).toBe(true);
		}
	});

	it('states its own size and fetches nothing', () => {
		for (const key of LIGHTHOUSE_BADGE_VARIANT_KEYS) {
			const svg = renderLighthouseBadgeSvg(key, 'dark').replace(/xmlns="[^"]*"/g, '');
			expect(svg).toContain(`width="${lighthouseBadgeWidth(key)}"`);
			expect(svg).not.toMatch(/<image|@import|xlink:href|https?:\/\//);
			expect(svg).not.toMatch(/\bid=/);
		}
	});

	it('names every category to a screen reader, not just the digits', () => {
		const alt = lighthouseBadgeText('categories');
		for (const word of ['performance', 'accessibility', 'best practices', 'seo']) {
			expect(alt.toLowerCase()).toContain(word);
		}
	});

	it('reserves the same width whatever the digits are', () => {
		// Helvetica gives every digit a 556 advance, which is what keeps the pill
		// from resizing as the score moves.
		expect(textWidth('100', 12, DIGIT_ADVANCE)).toBeCloseTo(textWidth('899', 12, DIGIT_ADVANCE), 5);
	});

	it('offers only the two forms a measurement belongs in', () => {
		const s = lighthouseBadgeSnippets({ variant: 'overall', theme: 'dark', origin: ORIGIN });
		expect(Object.keys(s).sort()).toEqual(['html', 'markdown']);
		// Both fetch the live endpoint. A pasted component would freeze the
		// number at the moment somebody copied it.
		expect(s.markdown).toContain(`${ORIGIN}/badge-lighthouse.svg`);
		expect(s.html).toContain(`${ORIGIN}/badge-lighthouse.svg`);
		expect(s.markdown).toContain(BADGE_HREF);
	});
});
