import { utcHourKey } from '$lib/utils/page-views';
import { error } from '@sveltejs/kit';
import { assertCanViewStats } from '$lib/server/stats-guard';
import { loadStatsSummary, parseTrafficWindow } from '$lib/server/stats-summary';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url, locals }) => {
	// Gated on the stats permission: owner always, plain admins only when
	// granted can_view_stats. The admin layout guard has already run.
	assertCanViewStats(locals.user);

	if (!platform?.env?.DB) {
		// Local dev without D1 — return a fully-shaped empty payload rather than
		// throwing, so the page still renders and explains itself.
		return {
			stats: null,
			traffic: null,
			usage: null,
			trafficWindow: 30,
			trafficNowHour: utcHourKey(new Date())
		};
	}

	// The window is a query param so the UI can toggle it with a plain link —
	// shareable, and it survives a reload. The assembly itself is shared with
	// /api/stats/summary (src/lib/server/stats-summary.ts).
	try {
		return await loadStatsSummary(
			platform.env.DB,
			parseTrafficWindow(url.searchParams.get('window'))
		);
	} catch {
		throw error(500, 'Failed to load stats');
	}
};
