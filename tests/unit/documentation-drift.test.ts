import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * /documentation must not fall behind the build (AGENTS.md section 7).
 *
 * These tests read the repo, not the rendered page, and fail when something a
 * user or operator can reach has no mention on the page. To fix a failure, add
 * the thing to src/routes/documentation/+page.svelte. Add it to an allow list
 * below only when it is internal, and say why.
 */

const PAGE = readFileSync('src/routes/documentation/+page.svelte', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts: Record<string, string> };

// Internal, or not something a user runs.
const SCRIPT_ALLOW = new Set([
	'prepare', // npm lifecycle hook, runs on install
	'predev', // runs before dev; check:bindings is documented
	'prebuild' // runs before build; check:bindings is documented
]);

// Routes with no page of their own to document, or documented under another name.
const ROUTE_ALLOW = new Set([
	'api', // documented per endpoint
	'admin', // documented by area in "Roles and Permissions"
	'auth', // documented in "Authentication and Setup Flow"
	'setup', // documented in "Authentication and Setup Flow"
	'reset', // documented in "Authentication and Setup Flow"
	'documentation', // this page
	'components', // the UI kit gallery, documented in "UI Kit"
	'modules', // documented in "Modules"
	'p', // CMS pages, documented in "Shop, Pages and the Site API"
	'profile', // the signed-in user's own page
	'contact', // documented in "What You Get Out of the Box"
	'showcase', // 301 redirect to /components
	'chat' // documented in "What You Get Out of the Box"
]);

function topLevelRoutes(): string[] {
	return readdirSync('src/routes')
		.filter((n) => statSync(join('src/routes', n)).isDirectory())
		.filter((n) => /^[a-z][a-z0-9-]*$/.test(n)); // skip (groups), [params], and dotfile routes
}

function sectionIds(): string[] {
	return [...PAGE.matchAll(/<section[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
}

function groupedIds(): string[] {
	const start = PAGE.indexOf('const docsGroups');
	const block = PAGE.slice(start, PAGE.indexOf('];', start));
	return [...block.matchAll(/\{ id: '([^']+)', name:/g)].map((m) => m[1]);
}

describe('documentation drift', () => {
	it('mentions every package.json script', () => {
		const missing = Object.keys(pkg.scripts)
			.filter((s) => !SCRIPT_ALLOW.has(s))
			.filter((s) => !PAGE.includes(s));
		expect(missing, `scripts with no mention on /documentation: ${missing.join(', ')}`).toEqual([]);
	});

	it('mentions every top-level public route', () => {
		const missing = topLevelRoutes()
			.filter((r) => !ROUTE_ALLOW.has(r))
			.filter((r) => !PAGE.includes(`/${r}`));
		expect(missing, `routes with no mention on /documentation: ${missing.join(', ')}`).toEqual([]);
	});

	it('mentions every Cloudflare binding declared in wrangler.toml', () => {
		const wrangler = readFileSync('wrangler.toml', 'utf8');
		const bindings = [...wrangler.matchAll(/^\s*binding\s*=\s*"([A-Z_]+)"/gm)].map((m) => m[1]);
		expect(bindings.length).toBeGreaterThan(0);
		const missing = bindings.filter((b) => !PAGE.includes(b));
		expect(missing, `bindings with no mention on /documentation: ${missing.join(', ')}`).toEqual(
			[]
		);
	});

	it('lists every section in the sidebar, once, in page order', () => {
		expect(groupedIds()).toEqual(sectionIds());
	});

	it('has an h2 for every section', () => {
		for (const id of sectionIds()) {
			const section = PAGE.slice(PAGE.search(new RegExp(`<section[^>]*\\sid="${id}"`)));
			const end = section.indexOf('</section>');
			expect(section.slice(0, end), `#${id} has no <h2>`).toMatch(/<h2[ >]/);
		}
	});
});
