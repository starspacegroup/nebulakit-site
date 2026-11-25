import { expect, test, type Page } from '@playwright/test';

/**
 * Light-mode audit. Loads the public pages with the light theme forced and
 * fails on the faults that make light mode look broken without anyone choosing
 * it: text below WCAG AA contrast against the colour it sits on, a dark
 * surface left behind in light mode, and an element that still follows the OS
 * dark scheme after the user chose light.
 *
 * The dark surface check is the one that finds the mixed-theme bugs: a card
 * with a hard-coded dark background, or a component that reads
 * prefers-color-scheme instead of data-theme (AGENTS.md section 10).
 */

const PAGES = [
	'/',
	'/documentation',
	'/badge',
	'/components',
	'/contact',
	'/privacy',
	'/terms',
	'/auth/login',
	'/auth/signup',
	'/shop',
	'/cart'
];

/** Signed in through the local dev simulator, which only answers on localhost. */
const ADMIN_PAGES = [
	'/admin',
	'/admin/stats',
	'/admin/products',
	'/admin/auctions',
	'/admin/orders',
	'/admin/users',
	'/admin/status',
	'/admin/scheduled-jobs',
	'/admin/settings/pricing',
	'/admin/cms',
	'/admin/pages',
	'/admin/lighthouse',
	'/admin/sign-ins',
	'/admin/api-keys',
	'/admin/auth-keys',
	'/admin/ai-keys',
	'/admin/redirects',
	'/admin/audit',
	'/admin/analytics',
	'/admin/contact-form-submissions'
];

interface Fault {
	kind: string;
	detail: string;
}

async function audit(page: Page): Promise<Fault[]> {
	return page.evaluate(() => {
		const faults: { kind: string; detail: string }[] = [];

		type RGBA = [number, number, number, number];
		const parse = (c: string): RGBA | null => {
			const m = c.match(/rgba?\(([^)]+)\)/);
			if (!m) return null;
			const p = m[1]
				.split(/[ ,/]+/)
				.filter(Boolean)
				.map(Number);
			return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
		};
		const over = (top: RGBA, under: [number, number, number]): [number, number, number] => [
			top[0] * top[3] + under[0] * (1 - top[3]),
			top[1] * top[3] + under[1] * (1 - top[3]),
			top[2] * top[3] + under[2] * (1 - top[3])
		];
		const lum = ([r, g, b]: number[]) => {
			const f = (v: number) => {
				const s = v / 255;
				return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
			};
			return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
		};
		const ratio = (a: number[], b: number[]) => {
			const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
			return (hi + 0.05) / (lo + 0.05);
		};
		const label = (el: Element) =>
			`${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;

		/** The colour behind an element, or null when an image or gradient sits there. */
		const backdrop = (el: Element): [number, number, number] | null => {
			const layers: RGBA[] = [];
			for (let e: Element | null = el; e; e = e.parentElement) {
				const s = getComputedStyle(e);
				if (s.backgroundImage !== 'none') return null;
				const c = parse(s.backgroundColor);
				if (c && c[3] > 0) {
					layers.push(c);
					if (c[3] >= 1) break;
				}
			}
			let base: [number, number, number] = [255, 255, 255];
			for (const layer of layers.reverse()) base = over(layer, base);
			return base;
		};

		const visible = (el: Element) => {
			const r = el.getBoundingClientRect();
			const s = getComputedStyle(el);
			return (
				r.width > 0 &&
				r.height > 0 &&
				s.visibility !== 'hidden' &&
				s.display !== 'none' &&
				Number(s.opacity) > 0
			);
		};

		if (document.documentElement.getAttribute('data-theme') !== 'light') {
			faults.push({
				kind: 'not-light',
				detail: `data-theme is ${document.documentElement.getAttribute('data-theme')}`
			});
		}

		const seen = new Set<Element>();
		const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
		for (let n = walker.nextNode(); n; n = walker.nextNode()) {
			const el = n.parentElement;
			if (!el || seen.has(el) || !n.textContent?.trim() || !visible(el)) continue;
			if (el.closest('.sr-only, [class*="sr-only"], pre, svg, script, style')) continue;
			seen.add(el);
			const s = getComputedStyle(el);
			const fg = parse(s.color);
			const bg = backdrop(el);
			if (!fg || !bg) continue;
			const text = over(fg, bg);
			const size = parseFloat(s.fontSize);
			const bold = Number(s.fontWeight) >= 700;
			const large = size >= 24 || (size >= 18.66 && bold);
			const need = large ? 3 : 4.5;
			const got = ratio(text, bg);
			if (got < need) {
				faults.push({
					kind: 'low-contrast',
					detail: `${label(el)} "${n.textContent.trim().slice(0, 36)}" is ${got.toFixed(2)}:1, needs ${need}:1`
				});
			}
		}

		// A big dark block in light mode: a surface that did not switch.
		for (const el of document.querySelectorAll('body *')) {
			if (!visible(el)) continue;
			const r = el.getBoundingClientRect();
			if (r.width < 160 || r.height < 60) continue;
			const s = getComputedStyle(el);
			if (s.backgroundImage !== 'none') continue;
			const c = parse(s.backgroundColor);
			if (!c || c[3] < 0.95) continue;
			if (
				lum(c) < 0.06 &&
				!el.closest(
					'pre, code, [class*="terminal"], [class*="code"], [class*="shot"], [class*="hero-field"], [class*="nebula"], .preview'
				)
			) {
				faults.push({
					kind: 'dark-surface',
					detail: `${label(el)} is ${s.backgroundColor} (${Math.round(r.width)}x${Math.round(r.height)}) in light mode`
				});
			}
		}
		return faults;
	});
}

async function checkPage(page: Page, path: string) {
	// The OS asks for dark; the person chose light. Light has to win.
	await page.addInitScript(() => {
		try {
			localStorage.setItem('theme-preference', 'light');
		} catch {
			// no storage: the test then fails on data-theme, which is the point
		}
	});
	let res = await page.goto(path);
	for (let i = 0; i < 3 && res && res.status() >= 400; i++) {
		await page.waitForTimeout(1500);
		res = await page.goto(path);
	}
	expect(res?.status(), `${path} should be served`).toBeLessThan(400);
	await page.waitForLoadState('networkidle');
	await page.evaluate(async () => {
		for (let y = 0; y < document.body.scrollHeight; y += 600) {
			window.scrollTo(0, y);
			await new Promise((r) => setTimeout(r, 40));
		}
		window.scrollTo(0, 0);
	});
	const faults = await audit(page);
	expect(faults, JSON.stringify(faults, null, 2)).toEqual([]);
}

test.describe('light mode', () => {
	test.use({ colorScheme: 'dark' });

	for (const path of PAGES) {
		test(`${path} is correct in light mode, even when the OS is dark`, async ({ page }) => {
			await checkPage(page, path);
		});
	}

	for (const path of ADMIN_PAGES) {
		test(`${path} (signed in) is correct in light mode, even when the OS is dark`, async ({
			page
		}) => {
			await page.goto('/api/auth/dev-simulate?provider=github&role=superadmin');
			await checkPage(page, path);
		});
	}
});
