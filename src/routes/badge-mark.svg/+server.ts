/**
 * GET /badge-mark.svg — the nebula mark on its own.
 *
 * None of the badge forms need this; every one of them inlines the mark. It is
 * here for the cases the badge does not cover — a favicon for a fan project, a
 * slide, an avatar, a README that wants the mark without the words — so that
 * people reach for the real artwork instead of screenshotting the pill.
 *
 * Unlike the copies inside the badge this one carries an accessible name, since
 * there are no words beside it to supply one.
 */
import { BADGE_BRAND, markSvg } from '$lib/badge';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	// `Number(null)` and `Number('')` are both 0, which is finite — so a missing
	// parameter would clamp to the minimum instead of taking the default. The
	// raw string is tested first for exactly that reason.
	const raw = url.searchParams.get('size');
	const requested = raw === null || raw.trim() === '' ? NaN : Number(raw);
	// Clamped rather than rejected: the mark is vector and scales anyway, so the
	// parameter is a convenience and a silly value should not be an error page.
	const size = Number.isFinite(requested) ? Math.min(512, Math.max(16, Math.round(requested))) : 64;

	return new Response(markSvg(size, `role="img" aria-label="${BADGE_BRAND}"`), {
		headers: {
			'Content-Type': 'image/svg+xml; charset=utf-8',
			'Cache-Control': 'public, max-age=86400',
			'Access-Control-Allow-Origin': '*',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
