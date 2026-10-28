/**
 * Example Co., an invented bike shop, as a full landing site config. The live
 * marketing site ships no landing pages; tests use this to run the machinery
 * (audit, routes, JSON-LD, components) against real-shaped content.
 */
import { defineFamilies } from '../../../src/lib/landing/families';
import type { LandingSiteConfig } from '../../../src/lib/landing/types';
import { EXAMPLE_PAGES } from './pages';

export const EXAMPLE_LANDING: LandingSiteConfig = {
	example: true,
	origin: 'https://example.test',
	provider: { name: 'Example Co.', url: 'https://example.test' },
	cta: { primary: { href: '/contact', label: 'Get in touch' } },
	families: defineFamilies({
		who: { legacyPrefixes: ['for'] },
		where: {},
		what: {},
		when: {},
		why: {}
	}),
	pages: EXAMPLE_PAGES
};
