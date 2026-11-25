import { expect, test, type Page } from '@playwright/test';

/**
 * Layout audit. Walks the public pages at phone, tablet and desktop widths and
 * fails on the spacing faults that are visible without taste: sideways
 * scrolling, text touching the screen edge, a prose block aligned differently from the block next to it, and a gap
 * between blocks far larger than the spacing scale allows.
 *
 * It cannot judge whether a page looks good. It catches the mechanical faults
 * so a person only has to judge the rest.
 */

const PAGES = [
	'/',
	'/documentation',
	'/badge',
	'/showcase',
	'/contact',
	'/privacy',
	'/terms',
	'/shop',
	'/cart'
];
const WIDTHS = [
	{ name: 'phone', width: 360, height: 800 },
	{ name: 'phone-large', width: 430, height: 900 },
	{ name: 'tablet', width: 768, height: 1024 },
	{ name: 'desktop', width: 1280, height: 800 }
];

/** Largest allowed vertical gap between two stacked blocks, in px. */
const MAX_GAP_PHONE = 112;
/** Text closer to the screen edge than this reads as cramped. */
const MIN_EDGE = 12;

interface Fault {
	kind: string;
	detail: string;
}

async function audit(page: Page, isPhone: boolean): Promise<Fault[]> {
	return page.evaluate(
		({ isPhone, maxGap, minEdge }) => {
			const faults: { kind: string; detail: string }[] = [];
			const vw = document.documentElement.clientWidth;
			const label = (el: Element) =>
				`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}`;
			const visible = (el: Element) => {
				const r = el.getBoundingClientRect();
				const s = getComputedStyle(el);
				return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
			};

			if (document.documentElement.scrollWidth > vw + 1) {
				faults.push({
					kind: 'overflow-x',
					detail: `page is ${document.documentElement.scrollWidth}px wide in a ${vw}px viewport`
				});
			}

			// Text that touches the screen edge.
			const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
			for (let n = walker.nextNode(); n; n = walker.nextNode()) {
				if (!n.textContent?.trim() || !n.parentElement || !visible(n.parentElement)) continue;
				// Screen-reader-only text and text inside a scroller are meant to overflow.
				if (n.parentElement.closest('.sr-only, [class*="sr-only"], pre')) continue;
				let scrolls = false;
				for (
					let e: Element | null = n.parentElement;
					e && e !== document.body;
					e = e.parentElement
				) {
					const ox = getComputedStyle(e).overflowX;
					if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') {
						scrolls = true;
						break;
					}
				}
				if (scrolls) continue;
				const range = document.createRange();
				range.selectNodeContents(n);
				for (const r of range.getClientRects()) {
					if (r.width === 0) continue;
					if (r.left < minEdge - 0.5 || r.right > vw - minEdge + 0.5) {
						// Only the first offender per element, and not off-screen menus.
						if (r.right < 0 || r.left > vw) continue;
						faults.push({
							kind: 'text-at-edge',
							detail: `${label(n.parentElement)} "${n.textContent.trim().slice(0, 40)}" at ${Math.round(r.left)}..${Math.round(r.right)} of ${vw}`
						});
						break;
					}
				}
			}

			// A multi-line paragraph aligned unlike its neighbour paragraph.
			for (const p of document.querySelectorAll('p')) {
				if (!visible(p)) continue;
				const sib = p.nextElementSibling;
				if (!sib || sib.tagName !== 'P' || !visible(sib)) continue;
				const a = getComputedStyle(p).textAlign;
				const b = getComputedStyle(sib).textAlign;
				const norm = (x: string) => (x === 'start' ? 'left' : x);
				const multi = (el: Element) => {
					const lh = parseFloat(getComputedStyle(el).lineHeight) || 20;
					return el.getBoundingClientRect().height > lh * 1.6;
				};
				if (norm(a) !== norm(b) && (multi(p) || multi(sib))) {
					faults.push({
						kind: 'mixed-alignment',
						detail: `${label(p)} is ${a} but the next paragraph ${label(sib)} is ${b}`
					});
				}
			}

			// Oversized gaps between stacked blocks inside a section (phone only).
			if (isPhone) {
				for (const section of document.querySelectorAll('main section, main > div')) {
					const kids = [...section.querySelectorAll(':scope > *')].filter(
						(k) => visible(k) && getComputedStyle(k).position !== 'absolute'
					);
					for (let i = 1; i < kids.length; i++) {
						const prev = kids[i - 1].getBoundingClientRect();
						const cur = kids[i].getBoundingClientRect();
						const gap = cur.top - prev.bottom;
						if (
							gap > maxGap &&
							cur.top >= prev.top &&
							!kids[i].contains(kids[i - 1]) &&
							!kids[i - 1].contains(kids[i])
						) {
							faults.push({
								kind: 'gap-too-big',
								detail: `${Math.round(gap)}px between ${label(kids[i - 1])} and ${label(kids[i])}`
							});
						}
					}
				}
			}
			return faults;
		},
		{ isPhone, maxGap: MAX_GAP_PHONE, minEdge: MIN_EDGE }
	);
}

for (const size of WIDTHS) {
	test.describe(`layout at ${size.name} (${size.width}px)`, () => {
		test.use({ viewport: { width: size.width, height: size.height } });

		for (const path of PAGES) {
			test(`${path} has no spacing faults`, async ({ page }) => {
				// A cold dev server can answer a route before it has compiled it.
				let res = await page.goto(path);
				for (let i = 0; i < 3 && res && res.status() >= 400; i++) {
					await page.waitForTimeout(1500);
					res = await page.goto(path);
				}
				// A page in the list that does not exist is a fault, not a skip.
				expect(res?.status(), `${path} should be served`).toBeLessThan(400);
				await page.waitForLoadState('networkidle');
				// Lazy sections only lay out once scrolled to.
				await page.evaluate(async () => {
					for (let y = 0; y < document.body.scrollHeight; y += 600) {
						window.scrollTo(0, y);
						await new Promise((r) => setTimeout(r, 40));
					}
					window.scrollTo(0, 0);
				});
				const faults = await audit(page, size.width <= 480);
				expect(faults, JSON.stringify(faults, null, 2)).toEqual([]);
			});
		}
	});
}
