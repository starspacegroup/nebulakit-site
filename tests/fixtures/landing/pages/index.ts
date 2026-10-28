// Example Co. pages, kept out of src/ so the live site never publishes them.
// Tests use them to exercise the landing machinery. See docs/SEO_LANDING_PAGES.md.
import type { LandingPage } from '../../../../src/lib/landing/types';
import what_tune_ups from './what/tune-ups';
import when_flat_tire from './when/flat-tire';
import where_exampleton from './where/exampleton';
import where_north_example_county from './where/north-example-county';
import who_commuters from './who/commuters';
import who_families_with_kids from './who/families-with-kids';
import why_plain_prices from './why/plain-prices';

export const EXAMPLE_PAGES: LandingPage[] = [
	what_tune_ups,
	when_flat_tire,
	where_exampleton,
	where_north_example_county,
	who_commuters,
	who_families_with_kids,
	why_plain_prices
];
