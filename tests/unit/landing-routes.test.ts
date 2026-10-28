/**
 * Route loads against the Example Co. fixture. The live site has no landing
 * content, so its own loads only ever 404 (see landing-module.test.ts); this
 * file swaps the fixture in for `content/site` to cover the found-page, hub and
 * 301 paths of the same load functions.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/landing/content/site', async () => {
	const { EXAMPLE_LANDING } = await import('../fixtures/landing/example-site');
	return { LANDING: EXAMPLE_LANDING };
});

import { LANDING } from '../../src/lib/landing';
import { match } from '../../src/params/landingFamily';
import { load as hubLoad } from '../../src/routes/[family=landingFamily]/+page';
import { load as pageLoad } from '../../src/routes/[family=landingFamily]/[slug]/+page';

const shipped = LANDING.pages[0];
const prefix = LANDING.families.find((f) => f.key === shipped.family)!.prefix;
const url = (path: string) => new URL(`https://example.test${path}`);
const call = (fn: unknown, event: object) =>
	(fn as (e: object) => unknown)(event) as Record<string, any>;

describe('landing routes with example content', () => {
	it('matches configured and legacy prefixes only', () => {
		expect(match(prefix)).toBe(true);
		expect(match('for')).toBe(true);
		expect(match('admin')).toBe(false);
	});

	it('loads a hub and a page', () => {
		expect(
			call(hubLoad, { params: { family: prefix }, url: url(`/${prefix}`) }).family.prefix
		).toBe(prefix);
		const found = call(pageLoad, {
			params: { family: prefix, slug: shipped.slug },
			url: url(`/${prefix}/${shipped.slug}`)
		});
		expect(found.page).toBe(shipped);
	});

	it('404s an unknown page and 301s a legacy path', () => {
		expect(() =>
			call(pageLoad, { params: { family: prefix, slug: 'nope' }, url: url(`/${prefix}/nope`) })
		).toThrow();
		try {
			call(hubLoad, { params: { family: 'for' }, url: url('/for') });
			expect.unreachable();
		} catch (e) {
			expect(e).toMatchObject({ status: 301, location: '/who' });
		}
		try {
			call(pageLoad, { params: { family: 'for', slug: 'x' }, url: url('/for/x') });
			expect.unreachable();
		} catch (e) {
			expect(e).toMatchObject({ status: 301, location: '/who/x' });
		}
	});

	it('404s a family with no published pages', () => {
		const empty = LANDING.families.find(
			(f) => !LANDING.pages.some((p) => p.family === f.key && !p.draft)
		);
		if (empty)
			expect(() =>
				call(hubLoad, { params: { family: empty.prefix }, url: url(`/${empty.prefix}`) })
			).toThrow();
	});
});
