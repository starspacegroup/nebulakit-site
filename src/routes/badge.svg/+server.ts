/**
 * GET /badge.svg — the badge as an image, for READMEs and anywhere else an
 * `<img>` is the only thing that fits.
 *
 * `?variant=proudly|built|powered` and `?theme=dark|light` pick the wording and
 * the ground. Both are read through the type guards in `$lib/badge` and fall
 * back to the defaults, so an unknown value renders the default badge rather
 * than a 400 — a broken image in someone else's README tells them nothing, and
 * the query string is usually copied by hand.
 *
 * Nothing from the request reaches the document. The two parameters are matched
 * against fixed key sets before use, so there is no path by which a crafted URL
 * can put markup or script into an SVG this origin serves.
 *
 * The body is self-contained: the mark is nested SVG and the colours are
 * literals, because an SVG used as an `<img>` may not fetch anything.
 */
import { isBadgeTheme, isBadgeVariant, renderBadgeSvg } from '$lib/badge';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const variant = url.searchParams.get('variant');
	const theme = url.searchParams.get('theme');

	const body = renderBadgeSvg(
		isBadgeVariant(variant) ? variant : 'proudly',
		isBadgeTheme(theme) ? theme : 'dark'
	);

	return new Response(body, {
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			// A day. GitHub re-fetches through its image proxy on its own schedule,
			// so a shorter window buys nothing and a longer one outlives a brand change.
			'Cache-Control': 'public, max-age=86400',
			// The badge is embedded cross-origin by definition.
			'Access-Control-Allow-Origin': '*',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
