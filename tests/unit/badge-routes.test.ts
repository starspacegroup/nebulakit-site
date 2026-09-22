/**
 * The three endpoints the badge is actually reachable through.
 *
 * All of them are loaded from sites this one does not own, so the things worth
 * asserting are the ones a broken deploy would hide from us entirely: the media
 * types, the cross-origin header, and that a hand-edited query string degrades
 * to the shipped badge instead of rendering something strange.
 */
import { describe, expect, it } from 'vitest';

import {
	BADGE_VARIANT_KEYS,
	badgeElementScript,
	LIGHTHOUSE_BADGE_VARIANT_KEYS,
	markSvg,
	renderBadgeSvg,
	renderLighthouseBadgeSvg
} from '../../src/lib/badge';
import { GET as badgeSvgGet } from '../../src/routes/badge.svg/+server';
import { GET as badgeJsGet } from '../../src/routes/badge.js/+server';
import { GET as badgeMarkGet } from '../../src/routes/badge-mark.svg/+server';
import { GET as lighthouseGet } from '../../src/routes/badge-lighthouse.svg/+server';

const ORIGIN = 'https://example.test';

/** Minimal event stub — every handler reads nothing but `url`. */
function event(path: string) {
	return { url: new URL(`${ORIGIN}${path}`) } as never;
}

const svg = async (query = '') => await (await badgeSvgGet(event(`/badge.svg${query}`))).text();

/** Headers every one of these has to carry to work on somebody else's page. */
function expectEmbeddable(response: Response, contentType: string) {
	expect(response.status).toBe(200);
	expect(response.headers.get('content-type')).toBe(contentType);
	expect(response.headers.get('access-control-allow-origin')).toBe('*');
	expect(response.headers.get('cache-control')).toContain('max-age=');
	expect(response.headers.get('x-content-type-options')).toBe('nosniff');
}

describe('GET /badge.svg', () => {
	it('serves an SVG a README can embed', async () => {
		expectEmbeddable(await badgeSvgGet(event('/badge.svg')), 'image/svg+xml; charset=utf-8');
	});

	it('defaults to "Proudly built with NebulaKit" on the dark ground', async () => {
		expect(await svg()).toBe(renderBadgeSvg('proudly', 'dark'));
	});

	it('renders the wording and ground the query string asks for', async () => {
		expect(await svg('?variant=built&theme=light')).toBe(renderBadgeSvg('built', 'light'));
		expect(await svg('?variant=powered&theme=dark')).toBe(renderBadgeSvg('powered', 'dark'));
	});

	it('takes each parameter on its own', async () => {
		expect(await svg('?theme=light')).toBe(renderBadgeSvg('proudly', 'light'));
		expect(await svg('?variant=powered')).toBe(renderBadgeSvg('powered', 'dark'));
	});

	it('falls back to the default rather than 400ing on a value it does not know', async () => {
		// The query string gets copied by hand and edited. A broken image in
		// somebody else's README tells them nothing; the shipped badge does.
		const response = await badgeSvgGet(event('/badge.svg?variant=shipping&theme=sepia'));
		expect(response.status).toBe(200);
		expect(await response.text()).toBe(renderBadgeSvg('proudly', 'dark'));
	});

	it('never renders an inherited property as the label', async () => {
		// `variant in BADGE_VARIANTS` walks the prototype chain, so this URL would
		// put "function toString() { [native code] }" inside the badge.
		for (const probe of ['toString', 'constructor', 'hasOwnProperty', '__proto__']) {
			const body = await svg(`?variant=${encodeURIComponent(probe)}`);
			expect(body).toBe(renderBadgeSvg('proudly', 'dark'));
			expect(body).not.toContain('native code');
		}
	});

	it('puts nothing from the request into the document', async () => {
		// Both parameters are matched against fixed key sets before use, so there
		// is no crafted URL that gets markup or script into an SVG this origin
		// serves — which matters because it is served cross-origin on purpose.
		const body = await svg('?variant=%3Cscript%3Ealert(1)%3C/script%3E&theme=%22%3E%3Cscript%3E');
		expect(body).toBe(renderBadgeSvg('proudly', 'dark'));
		expect(body).not.toContain('<script');
		expect(body).not.toContain('alert(1)');
	});

	it('serves every wording it advertises', async () => {
		for (const key of BADGE_VARIANT_KEYS) {
			expect(await svg(`?variant=${key}`)).toBe(renderBadgeSvg(key, 'dark'));
		}
	});
});

describe('GET /badge.js', () => {
	it('serves the custom element as JavaScript', async () => {
		expectEmbeddable(await badgeJsGet(event('/badge.js')), 'text/javascript; charset=utf-8');
	});

	it('serves exactly what the module defines', async () => {
		const response = await badgeJsGet(event('/badge.js'));
		expect(await response.text()).toBe(badgeElementScript());
	});

	it('is identical from any origin, because it fetches nothing', async () => {
		// The mark is inlined, so a preview deployment hands out an element that
		// renders the same as production instead of one pointing back at itself.
		const preview = await (
			await badgeJsGet({ url: new URL('https://preview.test/badge.js') } as never)
		).text();
		expect(preview).toBe(await (await badgeJsGet(event('/badge.js'))).text());
	});
});

describe('GET /badge-mark.svg', () => {
	it('serves the mark on its own', async () => {
		expectEmbeddable(await badgeMarkGet(event('/badge-mark.svg')), 'image/svg+xml; charset=utf-8');
	});

	it('defaults to 64px when no size is asked for', async () => {
		// `Number(null)` is 0 and finite, so a missing parameter used to clamp to
		// the 16px minimum instead of taking this default.
		const body = await (await badgeMarkGet(event('/badge-mark.svg'))).text();
		expect(body).toContain('width="64"');
	});

	it('treats an empty size the same as a missing one', async () => {
		const body = await (await badgeMarkGet(event('/badge-mark.svg?size='))).text();
		expect(body).toContain('width="64"');
	});

	it('honours a size it is given', async () => {
		const body = await (await badgeMarkGet(event('/badge-mark.svg?size=128'))).text();
		expect(body).toBe(markSvg(128, 'role="img" aria-label="NebulaKit"'));
	});

	it('clamps rather than erroring on a silly size', async () => {
		const tiny = await (await badgeMarkGet(event('/badge-mark.svg?size=1'))).text();
		const huge = await (await badgeMarkGet(event('/badge-mark.svg?size=99999'))).text();
		const junk = await (await badgeMarkGet(event('/badge-mark.svg?size=wide'))).text();
		expect(tiny).toContain('width="16"');
		expect(huge).toContain('width="512"');
		expect(junk).toContain('width="64"');
	});

	it('names itself, since there are no words beside it here', async () => {
		const body = await (await badgeMarkGet(event('/badge-mark.svg'))).text();
		expect(body).toContain('role="img"');
		expect(body).toContain('aria-label="NebulaKit"');
	});
});

describe('GET /badge-lighthouse.svg', () => {
	const svg = async (q = '') =>
		await (await lighthouseGet(event(`/badge-lighthouse.svg${q}`))).text();

	it('serves an SVG a README can embed', async () => {
		expectEmbeddable(
			await lighthouseGet(event('/badge-lighthouse.svg')),
			'image/svg+xml; charset=utf-8'
		);
	});

	it('caches for an hour, not a day', async () => {
		// The brand badge is a constant and can sit in a proxy all day. This one
		// is a measurement that is meant to move, and a stale perfect score is
		// the single wrong answer worth avoiding.
		const response = await lighthouseGet(event('/badge-lighthouse.svg'));
		expect(response.headers.get('cache-control')).toBe('public, max-age=3600');
	});

	it('defaults to the single overall number on the dark ground', async () => {
		expect(await svg()).toBe(renderLighthouseBadgeSvg('overall', 'dark'));
	});

	it('serves both levels of detail', async () => {
		for (const key of LIGHTHOUSE_BADGE_VARIANT_KEYS) {
			expect(await svg(`?variant=${key}`)).toBe(renderLighthouseBadgeSvg(key, 'dark'));
		}
	});

	it('falls back rather than 400ing on a value it does not know', async () => {
		expect(await svg('?variant=everything&theme=sepia')).toBe(
			renderLighthouseBadgeSvg('overall', 'dark')
		);
	});

	it('puts nothing from the request into the document', async () => {
		const body = await svg('?variant=%3Cscript%3Ealert(1)%3C/script%3E');
		expect(body).not.toContain('<script');
		expect(body).toBe(renderLighthouseBadgeSvg('overall', 'dark'));
	});
});
