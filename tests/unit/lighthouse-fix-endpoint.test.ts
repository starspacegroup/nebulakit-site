import { describe, expect, it, vi } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { POST } from '../../src/routes/api/admin/lighthouse/fix/+server';

const publish = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/lighthouse-fixes', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../src/lib/server/lighthouse-fixes')>();
	return { ...actual, publishFixIssue: publish };
});

const admin = { id: '1', isAdmin: true, permissions: ['lighthouse'] };

async function seeded(env: Record<string, unknown> = {}) {
	const DB = createSqliteD1();
	await DB.prepare(
		`INSERT INTO lighthouse_findings (path, strategy, category, audit_id, title, description, score, display_value)
		 VALUES ('/', 'desktop', 'performance', 'render-blocking-insight', 'Render-blocking requests', 'd', 0.5, '40 ms')`
	).run();
	return { DB, ...env };
}

const event = (user: unknown, env: Record<string, unknown>) =>
	({ locals: { user }, platform: { env } }) as never;

describe('POST /api/admin/lighthouse/fix', () => {
	it('refuses non-admins and anonymous callers', async () => {
		await expect(POST(event({ id: '2' }, await seeded()))).rejects.toMatchObject({ status: 403 });
		await expect(POST(event(null, await seeded()))).rejects.toMatchObject({ status: 401 });
	});

	it('503s without a database', async () => {
		await expect(POST(event(admin, {}))).rejects.toMatchObject({ status: 503 });
	});

	it('says nothing to fix when nothing fails', async () => {
		const response = await POST(event(admin, { DB: createSqliteD1() }));
		expect(await response.json()).toEqual({ brief: null, issue: null });
	});

	it('returns the brief to copy when no token is set', async () => {
		const body = await (await POST(event(admin, await seeded()))).json();
		expect(body.brief.count).toBe(1);
		expect(body.issue).toBeNull();
		expect(publish).not.toHaveBeenCalled();
	});

	it('files the issue when a token is set', async () => {
		publish.mockResolvedValueOnce({ url: 'https://gh/1', created: true });
		const body = await (await POST(event(admin, await seeded({ GITHUB_TOKEN: 't' })))).json();
		expect(body.issue).toEqual({ url: 'https://gh/1', created: true });
	});

	it('still returns the brief, with a warning, when GitHub refuses', async () => {
		publish.mockRejectedValueOnce(new Error('GitHub refused the issue (403)'));
		const body = await (await POST(event(admin, await seeded({ GITHUB_TOKEN: 't' })))).json();
		expect(body.brief.count).toBe(1);
		expect(body.warning).toContain('403');
		publish.mockRejectedValueOnce('boom');
		const again = await (await POST(event(admin, await seeded({ GITHUB_TOKEN: 't' })))).json();
		expect(again.warning).toBe('GitHub request failed');
	});
});
