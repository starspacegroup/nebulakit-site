import { utcDay, utcHourKey } from '$lib/utils/page-views';
import { error } from '@sveltejs/kit';
import { assertCanViewStats } from '$lib/server/stats-guard';
import { loadStatsSummary, parseTrafficWindow } from '$lib/server/stats-summary';
import { dayKey } from '$lib/utils/timezone';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url, locals, parent }) => {
	// Gated on the stats permission: owner always, plain admins only when
	// granted can_view_stats. The admin layout guard has already run.
	assertCanViewStats(locals.user);

	// The admin clock resolved by the layout (user, site setting, browser cookie, UTC).
	const { timeZone } = await parent();

	if (!platform?.env?.DB) {
		// Local dev without D1 — return a fully-shaped empty payload rather than
		// throwing, so the page still renders and explains itself.
		return {
			stats: null,
			traffic: null,
			usage: null,
			trafficWindow: 30,
			trafficToday: dayKey(new Date(), timeZone),
			trafficNowHour: utcHourKey(new Date()),
			usageToday: utcDay(new Date())
		};
	}

	// The window is a query param so the UI can toggle it with a plain link —
	// shareable, and it survives a reload. The assembly itself is shared with
	// /api/stats/summary (src/lib/server/stats-summary.ts).
	try {
		return await loadStatsSummary(
			platform.env.DB,
			parseTrafficWindow(url.searchParams.get('window')),
			new Date(),
			timeZone
		);
	} catch {
		throw error(500, 'Failed to load stats');
	}
};
