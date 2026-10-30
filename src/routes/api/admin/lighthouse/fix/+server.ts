import { error, json } from '@sveltejs/kit';
import { requirePermission } from '$lib/server/auth-guards';
import { listFindings } from '$lib/server/lighthouse';
import {
	buildFixBrief,
	closeFixIssue,
	githubTarget,
	publishFixIssue
} from '$lib/server/lighthouse-fixes';
import { site } from '$lib/site.config';
import type { RequestHandler } from './$types';

/**
 * Turn the stored findings into a fix brief. With `GITHUB_TOKEN` set it files
 * (or updates) one issue and returns its URL; without, it returns the brief to
 * copy. Nothing here edits code or deploys: see `$lib/server/lighthouse-fixes`.
 *
 * Session-guarded like the run endpoint, and for the same reason.
 */
export const POST: RequestHandler = async ({ locals, platform }) => {
	requirePermission(locals, 'lighthouse');

	const db = platform?.env?.DB;
	if (!db) {
		throw error(503, 'Database not available');
	}

	const brief = buildFixBrief(await listFindings(db), site.url);
	const target = githubTarget(platform?.env ?? {});
	if (!brief) {
		// Nothing flagged: close the open fix issue, if there is one.
		const closed = target ? await closeFixIssue(target).catch(() => null) : null;
		return json({ brief: null, issue: null, closed });
	}
	if (!target) return json({ brief, issue: null });

	try {
		return json({ brief, issue: await publishFixIssue(brief, target) });
	} catch (cause) {
		// The brief is still useful when GitHub says no, so it goes back with the reason.
		return json({
			brief,
			issue: null,
			warning: cause instanceof Error ? cause.message : 'GitHub request failed'
		});
	}
};
