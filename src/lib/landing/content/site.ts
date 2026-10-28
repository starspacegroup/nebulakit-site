/**
 * This site's landing pages (docs/SEO_LANDING_PAGES.md). The module code beside
 * this file stays generic; this file and `pages/` are the site's own content.
 *
 * The live marketing site ships NO landing pages. `PAGES` is empty, so /who,
 * /where, /what, /when and /why return the normal 404, no hub exists, and the
 * sitemap lists none. The template's placeholder pages live in tests/fixtures/landing/ and
 * only the test suite sees them.
 *
 * To publish a real page: `bun run landing new <family> <slug>`, write it, run
 * `bun run landing report` until it passes, then register it in
 * `src/lib/agent-discovery.ts` if you add a new top-level route.
 */
import { site } from '../../site.config';
import { defineFamilies } from '../families';
import type { LandingSiteConfig } from '../types';
import { PAGES } from './pages';

export const LANDING: LandingSiteConfig = {
	example: false,
	origin: site.url,
	provider: { name: site.name, url: site.url },
	cta: {
		primary: { href: '/contact', label: 'Get in touch' }
	},
	ogImage: site.ogImage,
	families: defineFamilies({
		who: {},
		where: {},
		what: {},
		when: {},
		why: {}
	}),
	pages: PAGES
};
