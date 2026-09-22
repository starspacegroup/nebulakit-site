/**
 * Lighthouse audit runner for the public pages of the NebulaKit template and of
 * this marketing site.
 *
 * It writes two things:
 *
 *   static/lighthouse/<target>-<slug>.html   the full Lighthouse report, served
 *                                            at /lighthouse/<target>-<slug> and
 *                                            linked from
 *                                            the "Measured, not claimed" section
 *                                            on the home page
 *   src/lib/lighthouse-results.json          the score summary that section
 *                                            renders from
 *
 * Both are committed. The section reads the JSON at build time, so regenerating
 * the reports is the only way to change the numbers on the page — there is no
 * second place to edit them, and a stale run is visible in the date it stamps.
 *
 * Usage (both apps must already be built and served):
 *
 *   bun run build && bunx wrangler pages dev .svelte-kit/cloudflare --port 8810
 *   # ...and the same for the template repo on 8820
 *   bun run lighthouse
 *
 * Override the origins with --site and --template, e.g. to audit production:
 *
 *   bun run lighthouse --site https://nebulakit.dev --template https://demo.nebulakit.dev
 *
 * Each page is audited three times and the median run is the one published.
 * Lighthouse measures real wall-clock time with no CPU throttling in the desktop
 * preset, so a single run reports whatever else the machine happened to be doing
 * — the same page measured 0.6s and 1.9s LCP minutes apart here. Raise it with
 * --runs if a machine is noisier still; an even count rounds down.
 *
 * Auth routes are deliberately absent. robots.txt disallows /auth/, which
 * Lighthouse scores as "page is blocked from indexing" — a real SEO failure for
 * a page meant to be found, and the correct configuration for a login form. The
 * conflict has no resolution, so those pages are not audited or published here.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, rmSync, renameSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pinned: scores move between Lighthouse majors, so the reports on the site
 *  should all come from one version rather than whatever npm resolved today. */
const LIGHTHOUSE = 'lighthouse@13.5.0';

const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'];

const TARGETS = [
	{
		key: 'template',
		label: 'NebulaKit template',
		note: 'What you get when you click "Use this template".',
		defaultOrigin: 'http://127.0.0.1:8820',
		pages: [
			{ path: '/', title: 'Home' },
			{ path: '/documentation', title: 'Documentation' },
			{ path: '/contact', title: 'Contact' },
			{ path: '/privacy', title: 'Privacy' },
			{ path: '/terms', title: 'Terms' }
		]
	},
	{
		key: 'site',
		label: 'This site',
		note: 'nebulakit.dev itself, built on the template.',
		defaultOrigin: 'http://127.0.0.1:8810',
		pages: [
			{ path: '/', title: 'Home' },
			{ path: '/showcase', title: 'Showcase' },
			{ path: '/documentation', title: 'Documentation' },
			{ path: '/contact', title: 'Contact' },
			{ path: '/privacy', title: 'Privacy' },
			{ path: '/terms', title: 'Terms' }
		]
	}
];

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const reportDir = join(root, 'static', 'lighthouse');
const summaryFile = join(root, 'src', 'lib', 'lighthouse-results.json');

function arg(name, fallback) {
	const i = process.argv.indexOf(`--${name}`);
	return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const RUNS = Math.max(1, Number(arg('runs', '3')));

function slugOf(path) {
	const s = path.replace(/^\//, '').replace(/\//g, '-');
	return s === '' ? 'home' : s;
}

/** Median by performance score. An even count takes the lower middle, which is
 *  the pessimistic half — better to under-report than to publish a lucky run. */
function medianIndex(scores) {
	const order = scores.map((score, i) => [score, i]).sort((a, b) => a[0] - b[0]);
	return order[Math.floor((order.length - 1) / 2)][1];
}

function runLighthouse(url, outBase) {
	execFileSync(
		'bunx',
		[
			LIGHTHOUSE,
			url,
			'--output=json',
			'--output=html',
			`--output-path=${outBase}`,
			`--only-categories=${CATEGORIES.join(',')}`,
			'--preset=desktop',
			'--quiet',
			// Headless, and never a window on anybody's screen.
			'--chrome-flags=--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage'
		],
		{ stdio: ['ignore', 'ignore', 'inherit'] }
	);
}

mkdirSync(reportDir, { recursive: true });

const results = [];
let lighthouseVersion = null;
let failed = 0;

for (const target of TARGETS) {
	const origin = arg(target.key, target.defaultOrigin).replace(/\/$/, '');
	const pages = [];

	for (const page of target.pages) {
		const slug = `${target.key}-${slugOf(page.path)}`;
		const outBase = join(reportDir, slug);
		const url = `${origin}${page.path}`;

		process.stdout.write(`  ${url} ... `);

		const runs = [];
		for (let i = 0; i < RUNS; i++) {
			// No dot in the per-run suffix: Lighthouse strips a trailing extension
			// from --output-path, so `foo.run0` became `foo` again.
			const base = `${outBase}--run${i}`;
			runLighthouse(url, base);

			// Lighthouse appends .report.json / .report.html when more than one
			// output format is asked for.
			const jsonFile = `${base}.report.json`;
			const report = JSON.parse(readFileSync(jsonFile, 'utf8'));
			rmSync(jsonFile);
			runs.push({ html: `${base}.report.html`, report });
			process.stdout.write('.');
		}

		const keep = medianIndex(runs.map((r) => r.report.categories.performance?.score ?? 0));
		const report = runs[keep].report;

		// The published name carries a single extension: Cloudflare Pages serves
		// foo.html at /foo, and a second dot in the name breaks that rewrite.
		renameSync(runs[keep].html, `${outBase}.html`);
		runs.forEach((r, i) => i !== keep && rmSync(r.html));

		lighthouseVersion ??= report.lighthouseVersion;

		const scores = {};
		for (const key of CATEGORIES) {
			scores[key] = Math.round((report.categories[key]?.score ?? 0) * 100);
		}
		const lowest = Math.min(...Object.values(scores));
		if (lowest < 100) failed++;

		pages.push({
			path: page.path,
			title: page.title,
			report: `/lighthouse/${slug}`,
			scores
		});
		console.log(` ${Object.values(scores).join(' / ')}`);
	}

	results.push({ key: target.key, label: target.label, note: target.note, pages });
}

const summary = {
	generatedAt: new Date().toISOString().slice(0, 10),
	lighthouseVersion,
	formFactor: 'desktop',
	runsPerPage: RUNS,
	categories: CATEGORIES,
	targets: results
};
writeFileSync(summaryFile, `${JSON.stringify(summary, null, '\t')}\n`);

console.log(`\nwrote ${summaryFile}`);
console.log(`wrote ${results.reduce((n, t) => n + t.pages.length, 0)} reports to ${reportDir}`);

if (failed > 0) {
	console.error(`\n${failed} page(s) scored below 100.`);
	process.exit(1);
}
if (!existsSync(summaryFile)) process.exit(1);
console.log('every audited page scored 100 in all four categories.');
