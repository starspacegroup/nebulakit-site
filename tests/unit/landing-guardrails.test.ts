/**
 * The anti-doorway guardrails, run against THIS site's landing content
 * (src/lib/landing/content) and against the Example Co. fixture
 * (tests/fixtures/landing), so the audit is exercised even while the live site
 * has no pages. It fails when pages repeat each other, cross a type with a
 * region, claim a place with no tie, or state a figure nobody verified. Open
 * TODO(owner) markers are printed, not failed. See docs/SEO_LANDING_PAGES.md.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
	LANDING,
	auditLanding,
	canonicalUrl,
	familyByKey,
	formatAudit,
	landingPaths,
	landingSitemapRoutes,
	pageJsonLd,
	pagePath,
	publishedPages
} from '../../src/lib/landing';
import { SITEMAP_ROUTES } from '../../src/lib/agent-discovery';
import { EXAMPLE_LANDING } from '../fixtures/landing/example-site';

describe('the live site publishes no placeholder landing pages', () => {
	const walk = (dir: string): string[] =>
		readdirSync(dir).flatMap((f) =>
			statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]
		);

	it('has no pages, is not in example mode, and lists nothing in the sitemap', () => {
		expect(LANDING.pages).toEqual([]);
		expect(LANDING.example).toBe(false);
		expect(landingPaths(LANDING)).toEqual([]);
		const sitemap = SITEMAP_ROUTES.map((r) => r.path);
		for (const prefix of ['who', 'where', 'what', 'when', 'why']) {
			expect(sitemap.some((p) => p === `/${prefix}` || p.startsWith(`/${prefix}/`))).toBe(false);
		}
	});

	it('keeps Example Co. text out of src/', () => {
		for (const file of walk('src/lib/landing/content')) {
			expect(readFileSync(file, 'utf8'), file).not.toMatch(/Example Co\./);
		}
	});

	it('passes the audit with no content', () => {
		expect(auditLanding(LANDING).errors).toEqual([]);
	});
});

describe.each([
	['live site', LANDING],
	['Example Co. fixture', EXAMPLE_LANDING]
])('landing content guardrails: %s', (_name, LANDING) => {
	const report = auditLanding(LANDING);

	it('passes the audit', () => {
		if (report.todos.length) console.info(formatAudit({ errors: [], todos: report.todos }));
		expect(report.errors, formatAudit(report)).toEqual([]);
	});

	it('builds each FAQPage from the visible FAQ, word for word', () => {
		for (const page of publishedPages(LANDING)) {
			const family = familyByKey(LANDING, page.family)!;
			const faq = pageJsonLd(LANDING, family, page).find((b) => b['@type'] === 'FAQPage') as {
				mainEntity: { name: string; acceptedAnswer: { text: string } }[];
			};
			expect(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
				page.faq.map((f) => [f.question, f.answer])
			);
		}
	});

	it('publishes no postal address unless one is public on the site', () => {
		const ld = JSON.stringify(
			publishedPages(LANDING).map((p) => pageJsonLd(LANDING, familyByKey(LANDING, p.family)!, p))
		);
		if (!LANDING.publicAddress) expect(ld).not.toMatch(/PostalAddress|LocalBusiness/);
	});

	it('lists every page in the sitemap once real content is in place', () => {
		const sitemap = SITEMAP_ROUTES.map((r) => r.path);
		if (LANDING.example) {
			expect(landingSitemapRoutes(LANDING)).toEqual([]);
		} else {
			for (const path of landingPaths(LANDING)) expect(sitemap).toContain(path);
		}
	});

	it('keeps canonical URLs on the production origin', () => {
		for (const page of publishedPages(LANDING)) {
			expect(canonicalUrl(LANDING, pagePath(LANDING, page))).toMatch(/^https:\/\//);
		}
	});
});
