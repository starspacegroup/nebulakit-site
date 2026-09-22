import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readdirSync } from 'node:fs';

/**
 * Cloudflare Pages serves static/lighthouse/foo.html and redirects the .html URL
 * to /lighthouse/foo. '<all>' excludes the file by its real name, but not that
 * redirect target — so the extensionless URL reached the worker and fell through
 * to the [contentType]/[slug] route as a 404.
 *
 * A '/lighthouse/*' splat would cover both, but _routes.json rejects a splat that
 * overlaps another rule, and '<all>' has already named every file. So the
 * extensionless twin of each report is listed instead. The list is read from disk
 * rather than written out, so adding a report needs no edit here.
 */
const lighthouseReports = readdirSync('static/lighthouse')
	.filter((name) => name.endsWith('.html'))
	.map((name) => `/lighthouse/${name.slice(0, -'.html'.length)}`);

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: adapter({
			routes: {
				include: ['/*'],
				exclude: ['<all>', ...lighthouseReports]
			}
		})
	}
};

export default config;
