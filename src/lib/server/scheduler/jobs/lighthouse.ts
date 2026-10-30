import { isStrategy, listFindings, runLighthouseSweep } from '$lib/server/lighthouse';
import { buildFixBrief, githubTarget, publishFixIssue } from '$lib/server/lighthouse-fixes';
import { site } from '$lib/site.config';
import type { ScheduledJob } from '../types';

/**
 * Re-audit every public page through PageSpeed Insights and store the results.
 * `?strategy=desktop` audits the desktop form factor instead of mobile.
 *
 * Daily is plenty: PSI's keyless rate limit will not tolerate much more, and
 * the scores do not move hourly. The sweep is sequential, so it is slow on
 * purpose and the timeout is generous.
 */
export const LIGHTHOUSE_JOB: ScheduledJob = {
	id: 'lighthouse',
	cron: '43 4 * * *',
	path: '/api/cron/lighthouse',
	description: 'Re-audit every public page with PageSpeed Insights (Lighthouse).',
	timeoutMs: 300_000,
	async run({ db, env, params }) {
		const requested = params.get('strategy');
		const strategy = isStrategy(requested) ? requested : 'mobile';
		const result = await runLighthouseSweep(db, {
			strategy,
			// Optional. Without it PSI still answers, at a much lower rate limit.
			apiKey: env.PAGESPEED_API_KEY
		});
		// Opt-in (LIGHTHOUSE_AUTOFIX=issue): file the fix brief. An issue, never a
		// code change. A GitHub failure must not fail the audit that just succeeded.
		let issue: string | null = null;
		const target = env.LIGHTHOUSE_AUTOFIX === 'issue' ? githubTarget(env) : null;
		if (target) {
			const brief = buildFixBrief(await listFindings(db), site.url);
			if (brief) issue = await publishFixIssue(brief, target).then((r) => r.url, () => null);
		}
		return { strategy, ...result, issue };
	}
};
