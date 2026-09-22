/**
 * GET /badge.js — the `<nebulakit-badge>` custom element, as a built asset.
 *
 * This is the one-line option: a host page adds the script and the element, and
 * the badge follows the reader's own colour scheme without the host copying any
 * CSS. The element is defined in `$lib/badge` as a string rather than a module
 * so it ships exactly as written, with no bundler step between here and the
 * page that loads it.
 *
 * The script names no URL of ours but the link target: the mark is inlined, so
 * a preview deployment serves an element that renders identically to production
 * and needs nothing from the origin it came from.
 */
import { badgeElementScript } from '$lib/badge';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
	return new Response(badgeElementScript(), {
		headers: {
			'Content-Type': 'text/javascript; charset=utf-8',
			'Cache-Control': 'public, max-age=86400',
			'Access-Control-Allow-Origin': '*',
			'X-Content-Type-Options': 'nosniff'
		}
	});
};
