/** The daily job: audits, and files the fix brief only when told to. */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { LIGHTHOUSE_JOB } from '../../src/lib/server/scheduler/jobs/lighthouse';

const sweep = vi.hoisted(() => vi.fn());
const publish = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/lighthouse', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/server/lighthouse')>();
	return { ...actual, runLighthouseSweep: sweep };
});
vi.mock('$lib/server/lighthouse-fixes', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/server/lighthouse-fixes')>();
	return { ...actual, publishFixIssue: publish };
});

async function run(env: Record<string, unknown>, query = '') {
	const db = createSqliteD1();
	await db
		.prepare(
			`INSERT INTO lighthouse_findings (path, strategy, category, audit_id, title, description, score, display_value)
			 VALUES ('/', 'mobile', 'performance', 'unused-javascript', 'Unused JS', 'd', 10, '28 KiB')`
		)
		.run();
	return LIGHTHOUSE_JOB.run({ db, env, params: new URLSearchParams(query) } as never);
}

beforeEach(() => {
	sweep.mockReset().mockResolvedValue({ audited: 1, failed: 0 });
	publish.mockReset();
});

describe('LIGHTHOUSE_JOB', () => {
	it('audits and files nothing by default', async () => {
		const result = await run({ GITHUB_TOKEN: 't' }, 'strategy=desktop');
		expect(result).toMatchObject({ strategy: 'desktop', audited: 1, issue: null });
		expect(publish).not.toHaveBeenCalled();
	});

	it('files the brief when LIGHTHOUSE_AUTOFIX=issue and a token is set', async () => {
		publish.mockResolvedValue({ url: 'https://gh/9', created: true });
		const result = await run({ GITHUB_TOKEN: 't', LIGHTHOUSE_AUTOFIX: 'issue' });
		expect(result).toMatchObject({ strategy: 'mobile', issue: 'https://gh/9' });
	});

	it('does not fail the audit when GitHub refuses', async () => {
		publish.mockRejectedValue(new Error('no'));
		const result = await run({ GITHUB_TOKEN: 't', LIGHTHOUSE_AUTOFIX: 'issue' });
		expect(result).toMatchObject({ audited: 1, issue: null });
	});
});
