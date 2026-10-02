#!/usr/bin/env node
/**
 * Capture light and dark screenshots of sites built with NebulaKit, for the
 * "Built with NebulaKit" section on the home page (AGENTS.md §10).
 *
 * Headless only. Each site gets both modes at one viewport, so the image does
 * not change size when the theme toggles. NebulaKit sites read
 * `theme-preference` from localStorage, and fall back to the OS scheme, so
 * the script sets both.
 *
 *   bun run capture:built-with
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { builtWith } from '../src/lib/built-with.ts';

const OUT = 'static/built-with';
const VIEWPORT = { width: 1280, height: 800 };

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

for (const entry of builtWith) {
	for (const mode of ['light', 'dark']) {
		const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: mode });
		await context.addInitScript((theme) => {
			try {
				localStorage.setItem('theme-preference', theme);
			} catch {}
		}, mode);
		const page = await context.newPage();
		await page.goto(entry.url, { waitUntil: 'networkidle', timeout: 45_000 });
		// Let entrance animations settle.
		await page.waitForTimeout(1500);
		const png = join(OUT, `${entry.slug}-${mode}.png`);
		await page.screenshot({ path: png });
		// WebP at 1280x800 is a fraction of the PNG, which keeps Lighthouse at 100.
		execFileSync('magick', [png, '-quality', '78', join(OUT, `${entry.slug}-${mode}.webp`)]);
		rmSync(png);
		console.log(`captured ${entry.slug} (${mode})`);
		await context.close();
	}
}

await browser.close();
