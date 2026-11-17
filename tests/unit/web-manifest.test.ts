import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { site } from '../../src/lib/site.config';

const manifest = JSON.parse(readFileSync('static/site.webmanifest', 'utf8'));
const appHtml = readFileSync('src/app.html', 'utf8');

describe('static/site.webmanifest', () => {
	it('matches the site identity', () => {
		expect(manifest.name).toBe(site.name);
		expect(manifest.short_name).toBe(site.shortName);
		expect(manifest.description).toBe(site.description);
	});

	it('is installable as a standalone app', () => {
		expect(manifest.display).toBe('standalone');
		expect(manifest.start_url).toBe('/');
		expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i);
		expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i);
	});

	it('points every icon at a file that exists', () => {
		expect(manifest.icons.length).toBeGreaterThan(0);
		for (const icon of manifest.icons) {
			expect(existsSync(`static${icon.src}`)).toBe(true);
		}
	});

	it('is linked from app.html with a matching theme-color', () => {
		expect(appHtml).toContain('rel="manifest"');
		expect(appHtml).toContain('site.webmanifest');
		expect(appHtml).toContain(`<meta name="theme-color" content="${manifest.theme_color}"`);
		expect(appHtml).toContain(`content="${site.shortName}"`);
	});
});
