/**
 * The fix brief: stored findings in, one actionable issue out. It never edits
 * code, so the tests pin what it says and what it files.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	buildFixBrief,
	githubTarget,
	publishFixIssue,
	closeFixIssue,
	FIX_RECIPES
} from '../../src/lib/server/lighthouse-fixes';
import type { StoredFinding } from '../../src/lib/server/lighthouse';

function finding(over: Partial<StoredFinding> = {}): StoredFinding {
	return {
		path: '/',
		strategy: 'desktop',
		category: 'performance',
		audit_id: 'render-blocking-insight',
		title: 'Render-blocking requests',
		description: 'desc',
		score: 50,
		display_value: 'Est savings of 40 ms',
		...over
	};
}

describe('buildFixBrief', () => {
	it('is null when nothing is failing', () => {
		expect(buildFixBrief([], 'https://x.test')).toBeNull();
		expect(
			buildFixBrief([finding({ score: 95 }), finding({ score: null })], 'https://x.test')
		).toBeNull();
	});

	it('groups one audit across pages and gives the stock fix', () => {
		const brief = buildFixBrief(
			[
				finding(),
				finding({ path: '/shop' }),
				finding({ audit_id: 'made-up', title: 'New one', score: 20 })
			],
			'https://x.test'
		)!;
		expect(brief.count).toBe(2);
		expect(brief.title).toBe('Lighthouse: 2 audits below 90');
		expect(brief.body).toContain('<!-- lighthouse-autofix -->');
		expect(brief.body).toContain('Pages: / (desktop), /shop (desktop)');
		expect(brief.body).toContain(FIX_RECIPES['render-blocking-insight'].fix);
		expect(brief.body).toContain('No stock recipe. Lighthouse says: desc');
		// worst first
		expect(brief.body.indexOf('made-up')).toBeLessThan(
			brief.body.indexOf('render-blocking-insight')
		);
	});

	it('uses the singular for one audit and tolerates missing detail', () => {
		const brief = buildFixBrief(
			[finding({ audit_id: 'x', description: null, display_value: null })],
			'https://x.test'
		)!;
		expect(brief.title).toBe('Lighthouse: 1 audit below 90');
		expect(brief.body).toContain('see the report');
	});
});

describe('githubTarget', () => {
	it('needs a token and a well-formed repo', () => {
		expect(githubTarget({})).toBeNull();
		expect(githubTarget({ GITHUB_TOKEN: 't', GITHUB_REPO: 'not a repo' })).toBeNull();
		expect(githubTarget({ GITHUB_TOKEN: 't' })).toEqual({
			token: 't',
			repo: 'starspacegroup/nebulakit-site'
		});
		expect(githubTarget({ GITHUB_TOKEN: 't', GITHUB_REPO: 'a/b' })?.repo).toBe('a/b');
	});
});

describe('publishFixIssue', () => {
	const brief = { title: 'T', body: 'B', count: 1 };
	const target = { token: 't', repo: 'a/b' };
	const res = (status: number, body: unknown = {}) =>
		({ ok: status < 400, status, json: async () => body }) as Response;

	it('creates the issue when none is open', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(res(200, []))
			.mockResolvedValueOnce(res(201, { html_url: 'https://gh/1' }));
		expect(await publishFixIssue(brief, target, fetcher as never)).toEqual({
			url: 'https://gh/1',
			created: true
		});
		expect(fetcher.mock.calls[1][1].method).toBe('POST');
		expect(fetcher.mock.calls[1][1].headers.authorization).toBe('Bearer t');
	});

	it('edits the open issue instead of opening another', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(res(200, [{ number: 7, html_url: 'https://gh/7' }]))
			.mockResolvedValueOnce(res(200));
		expect(await publishFixIssue(brief, target, fetcher as never)).toEqual({
			url: 'https://gh/7',
			created: false
		});
		expect(fetcher.mock.calls[1][0]).toContain('/issues/7');
		expect(fetcher.mock.calls[1][1].method).toBe('PATCH');
	});

	it('throws with GitHub status on each failure', async () => {
		await expect(
			publishFixIssue(brief, target, vi.fn().mockResolvedValue(res(401)) as never)
		).rejects.toThrow('lookup (401)');
		await expect(
			publishFixIssue(
				brief,
				target,
				vi
					.fn()
					.mockResolvedValueOnce(res(200, [{ number: 1, html_url: 'u' }]))
					.mockResolvedValueOnce(res(403)) as never
			)
		).rejects.toThrow('update (403)');
		await expect(
			publishFixIssue(
				brief,
				target,
				vi.fn().mockResolvedValueOnce(res(200, [])).mockResolvedValueOnce(res(422)) as never
			)
		).rejects.toThrow('issue (422)');
	});
});

describe('buildFixBrief — units', () => {
	it('reads stored scores as 0-100, so a 75 is flagged and a 90 is not', () => {
		expect(buildFixBrief([finding({ score: 75 })], 'https://x.test')).not.toBeNull();
		expect(buildFixBrief([finding({ score: 90 })], 'https://x.test')).toBeNull();
	});
});

describe('closeFixIssue', () => {
	const target = { token: 't', repo: 'a/b' };
	const res = (status: number, body: unknown = {}) =>
		({ ok: status < 400, status, json: async () => body }) as Response;

	it('does nothing when no fix issue is open', async () => {
		const fetcher = vi.fn().mockResolvedValueOnce(res(200, []));
		expect(await closeFixIssue(target, fetcher as never)).toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('comments, then closes the open issue', async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(res(200, [{ number: 5, html_url: 'https://gh/5' }]))
			.mockResolvedValueOnce(res(201))
			.mockResolvedValueOnce(res(200));
		expect(await closeFixIssue(target, fetcher as never)).toBe('https://gh/5');
		expect(fetcher.mock.calls[1][0]).toContain('/issues/5/comments');
		expect(JSON.parse(fetcher.mock.calls[2][1].body)).toMatchObject({ state: 'closed' });
	});

	it('throws with the status on each refusal', async () => {
		await expect(
			closeFixIssue(target, vi.fn().mockResolvedValue(res(401)) as never)
		).rejects.toThrow('(401)');
		const open = res(200, [{ number: 1, html_url: 'u' }]);
		await expect(
			closeFixIssue(
				target,
				vi.fn().mockResolvedValueOnce(open).mockResolvedValueOnce(res(403)) as never
			)
		).rejects.toThrow('comment (403)');
		await expect(
			closeFixIssue(
				target,
				vi
					.fn()
					.mockResolvedValueOnce(open)
					.mockResolvedValueOnce(res(201))
					.mockResolvedValueOnce(res(422)) as never
			)
		).rejects.toThrow('close the issue (422)');
	});
});
