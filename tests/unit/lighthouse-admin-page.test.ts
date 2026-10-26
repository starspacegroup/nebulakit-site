import { describe, expect, it } from 'vitest';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { load } from '../../src/routes/admin/lighthouse/+page.server';

const owner = { id: '1', isOwner: true };

function run(user: unknown, env: Record<string, unknown> = { DB: createSqliteD1() }) {
	return (load as (event: unknown) => Promise<Record<string, unknown>>)({
		locals: { user },
		platform: { env }
	});
}

describe('/admin/lighthouse load', () => {
	it('returns the stored audits and findings, empty on a fresh database', async () => {
		const data = await run(owner);
		expect(data.audits).toEqual([]);
		expect(data.findings).toEqual([]);
		expect(typeof data.siteUrl).toBe('string');
		expect(typeof data.urlLooksPlaceholder).toBe('boolean');
	});

	it('is closed to an admin without the lighthouse permission', async () => {
		await expect(run({ id: '2', isAdmin: true, permissions: ['cms'] })).rejects.toMatchObject({
			status: 403
		});
	});

	it('is open to an admin who holds it', async () => {
		await expect(
			run({ id: '2', isAdmin: true, permissions: ['lighthouse'] })
		).resolves.toBeDefined();
	});

	it('answers 503 without a database', async () => {
		await expect(run(owner, {})).rejects.toMatchObject({ status: 503 });
	});
});
