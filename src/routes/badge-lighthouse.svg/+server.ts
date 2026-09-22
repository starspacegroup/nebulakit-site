/**
 * GET /badge-lighthouse.svg — the audited scores as an image, for READMEs.
 *
 * `?variant=overall|categories` picks one number or four, and `?theme=dark|light`
 * picks the ground. Both go through the type guards in `$lib/badge` and fall
 * back to the defaults, so a hand-edited query string renders the shipped badge
 * rather than a 400 — a broken image in someone else's README tells them
 * nothing, and nothing from the request reaches the document.
 *
 * The numbers come from lighthouse-results.json, so this endpoint reports the
 * last audit rather than a claim about it. That is also why the cache window is
 * shorter than the brand badge's day: this one is expected to change, and a
 * stale perfect score is the one wrong answer worth avoiding.
 */
import { isBadgeTheme, isLighthouseBadgeVariant, renderLighthouseBadgeSvg } from '$lib/badge';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const variant = url.searchParams.get('variant');
	const theme = url.searchParams.get('theme');

	const body = renderLighthouseBadgeSvg(
		isLighthouseBadgeVariant(variant) ? variant : 'overall',
		isBadgeTheme(theme) ? theme : 'dark'
	);

	return new Response(body, {
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			// An hour, not a day: this badge is a measurement and is meant to move.
			'Cache-Control': 'public, max-age=3600',
			'Access-Control-Allow-Origin': '*',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
