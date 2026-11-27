#!/usr/bin/env node
/**
 * Capture light and dark screenshots of the admin interface for the home
 * page's "admin tour" (src/lib/admin-shots.ts).
 *
 * Headless, against the LOCAL dev server only, signed in through the dev
 * simulator (which refuses non-local hosts), with the demo data from
 * `bun run seed:demo`. Start the app first (`bun run dev`).
 *
 *   bun run capture:admin              # every screen
 *   bun run capture:admin stats users  # only the slugs named
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { adminShots } from '../src/lib/admin-shots.ts';
import { site } from '../src/lib/site.config.ts';

const BASE = process.env.CAPTURE_BASE || `http://localhost:${site.devPort}`;
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
	throw new Error(`Refusing to sign in to ${BASE}: the simulator is for local development only.`);
}
const OUT = 'static/admin-shots';
const VIEWPORT = { width: 1440, height: 900 };

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const only = process.argv.slice(2);

for (const mode of ['light', 'dark']) {
	const context = await browser.newContext({ viewport: VIEWPORT, colorScheme: mode });
	await context.addInitScript((theme) => {
		try {
			localStorage.setItem('theme-preference', theme);
		} catch {}
	}, mode);
	const page = await context.newPage();
	await page.goto(`${BASE}/api/auth/dev-simulate?provider=github&role=superadmin`);
	for (const shot of adminShots.filter((s) => only.length === 0 || only.includes(s.slug))) {
		await page.goto(BASE + shot.path, { waitUntil: 'networkidle', timeout: 45_000 });
		// The dev simulator marks its session; that badge is not part of the product.
		await page.addStyleTag({
			content: '[class*="pretend" i], [data-pretend] { display: none !important; }'
		});
		if (shot.scrollY) await page.evaluate((y) => window.scrollTo(0, y), shot.scrollY);
		await page.waitForTimeout(900);
		const png = join(OUT, `${shot.slug}-${mode}.png`);
		await page.screenshot({ path: png });
		execFileSync('magick', [png, '-quality', '80', join(OUT, `${shot.slug}-${mode}.webp`)]);
		rmSync(png);
		console.log(`captured ${shot.slug} (${mode})`);
	}
	await context.close();
}
await browser.close();
