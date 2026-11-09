import { settleDueAuctions } from '@nebulakit/commerce';
import { auctionPricing } from '$lib/server/auction-pricing';
import type { CommerceEnv } from '$lib/server/site-info';
import type { ScheduledJob } from '../types';

/**
 * Close every auction whose time is up and give each sold one its order, so a
 * winner is billed even if nobody opens the page. Idempotent: an auction closes
 * once and has one order, so a retried or overlapping tick changes nothing.
 */
export const SETTLE_AUCTIONS_JOB: ScheduledJob = {
	id: 'settle-auctions',
	cron: '*/5 * * * *',
	path: '/api/cron/settle-auctions',
	description: 'Close auctions that have ended and create an order for each winner.',
	timeoutMs: 30_000,
	async run({ db, env, now }) {
		const report = await settleDueAuctions(db, {
			now: now * 1000,
			pricing: auctionPricing(env as unknown as CommerceEnv),
			limit: 200
		});
		return { ...report };
	}
};
