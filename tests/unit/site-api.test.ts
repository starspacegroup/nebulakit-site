import '../helpers/server-response';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { createApiKey, sha256Hex, type ApiScope } from '@nebulakit/security';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { PACKAGE_VERSIONS } from '../../src/lib/server/site-info';
import * as site from '../../src/routes/api/v1/site/+server';
import * as updates from '../../src/routes/api/v1/site/updates/+server';
import * as pages from '../../src/routes/api/v1/pages/+server';
import * as page from '../../src/routes/api/v1/pages/[slug]/+server';
import * as revisions from '../../src/routes/api/v1/pages/[slug]/revisions/+server';
import * as revision from '../../src/routes/api/v1/pages/[slug]/revisions/[id]/+server';
import * as openapi from '../../src/routes/api/v1/openapi.json/+server';

type Handler = (event: never) => Promise<Response>;

let db: D1Database;
let env: Record<string, unknown>;

beforeEach(() => {
	db = createSqliteD1();
	env = { DB: db };
});

interface CallOptions {
	method?: string;
	path?: string;
	params?: Record<string, string>;
	body?: unknown;
	rawBody?: string;
	key?: string;
	headers?: Record<string, string>;
	user?: App.Locals['user'];
	noDb?: boolean;
}

async function call(handler: unknown, options: CallOptions = {}) {
	const method = options.method ?? 'GET';
	const url = new URL(options.path ?? '/api/v1/x', 'https://shop.test');
	const headers: Record<string, string> = { ...options.headers };
	if (options.key) headers.authorization = `Bearer ${options.key}`;
	let body: string | undefined = options.rawBody;
	if (options.body !== undefined) {
		body = JSON.stringify(options.body);
		headers['content-type'] ??= 'application/json';
	}
	const request = new Request(url, { method, headers, body });
	const event = {
		request,
		url,
		params: options.params ?? {},
		locals: { user: options.user },
		platform: { env: options.noDb ? {} : env }
	};
	const response = await (handler as Handler)(event as never);
	const text = await response.text();
	return { status: response.status, json: text ? JSON.parse(text) : null };
}

async function key(...scopes: ApiScope[]) {
	return (await createApiKey(db, { name: 'test', scopes })).key;
}

const owner = { id: 'o', login: 'owner', email: 'o@x', isOwner: true };
const admin = { id: 'a', login: 'admin', email: 'a@x', isOwner: false, isAdmin: true };
const member = { id: 'm', login: 'member', email: 'm@x', isOwner: false };

describe('site API authentication', () => {
	it('refuses without a database', async () => {
		expect((await call(site.GET, { noDb: true })).status).toBe(503);
	});

	it('needs credentials for scoped endpoints and the right scope', async () => {
		expect((await call(site.GET)).status).toBe(401);
		expect((await call(site.GET, { key: 'nk_not-a-real-key' })).status).toBe(401);
		const reader = await key('products:read');
		const res = await call(site.GET, { key: reader });
		expect(res).toEqual({ status: 403, json: { error: 'This key lacks the site:read scope' } });
	});

	it('refuses a bad key even on a public endpoint', async () => {
		expect((await call(pages.GET, { key: 'nk_wrong' })).status).toBe(401);
	});

	it('accepts the orchestrator key from the environment and logs its calls', async () => {
		const orchestrator = 'nk_orchestrator_for_tests';
		env.ORCHESTRATOR_KEY_SHA256 = await sha256Hex(orchestrator);
		const res = await call(site.GET, { key: orchestrator, path: '/api/v1/site' });
		expect(res.status).toBe(200);
		expect(res.json).toMatchObject({
			template: { name: 'nebulakit' },
			// Not pinned: a forced security bump must not fail every site's tests.
			packages: PACKAGE_VERSIONS,
			updates: { autoApplyFeatures: false, optedIn: [], updatedAt: null }
		});
		const logged = await db.prepare('SELECT * FROM api_key_calls').all();
		expect(logged.results).toEqual([
			expect.objectContaining({ key_id: null, method: 'GET', path: '/api/v1/site', status: 200 })
		]);
	});

	it('keeps answering when the call log cannot be written', async () => {
		const reader = await key('site:read');
		await db.prepare('DROP TABLE api_key_calls').run();
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		expect((await call(site.GET, { key: reader })).status).toBe(200);
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});

	it('treats owner and admin sessions as API callers, with owner-only kept owner-only', async () => {
		const prefs = { autoApplyFeatures: true, optedIn: ['builder@0.2.0'] };
		expect((await call(site.GET, { user: owner })).status).toBe(200);
		expect((await call(site.GET, { user: member })).status).toBe(401);
		expect((await call(updates.PUT, { method: 'PUT', user: admin, body: prefs })).status).toBe(403);
		const saved = await call(updates.PUT, { method: 'PUT', user: owner, body: prefs });
		expect(saved.status).toBe(200);
		expect(saved.json).toMatchObject(prefs);
		expect((await call(updates.GET, { user: admin })).json).toMatchObject(prefs);
	});

	it('requires JSON on session writes (the CSRF guard)', async () => {
		const res = await call(updates.PUT, {
			method: 'PUT',
			user: owner,
			rawBody: 'autoApplyFeatures=true',
			headers: { 'content-type': 'application/x-www-form-urlencoded' }
		});
		expect(res.status).toBe(415);
		const noType = await call(updates.PUT, { method: 'PUT', user: owner, rawBody: '{}' });
		expect(noType.status).toBe(415);
	});
});

describe('site update preferences', () => {
	it('validates and dedupes the owner choice', async () => {
		const adminKey = await key('site:admin');
		const bad = await call(updates.PUT, { method: 'PUT', key: adminKey, body: { optedIn: 'x' } });
		expect(bad.status).toBe(422);
		expect(bad.json.details).toHaveLength(2);
		expect((await call(updates.PUT, { method: 'PUT', key: adminKey, body: [] })).status).toBe(422);
		expect(
			(
				await call(updates.PUT, {
					method: 'PUT',
					key: adminKey,
					rawBody: '{',
					headers: { 'content-type': 'application/json' }
				})
			).status
		).toBe(400);
		const ok = await call(updates.PUT, {
			method: 'PUT',
			key: adminKey,
			body: { autoApplyFeatures: false, optedIn: ['a', 'a', 'b'] }
		});
		expect(ok.json.optedIn).toEqual(['a', 'b']);
		await db.prepare("UPDATE site_update_preferences SET opted_in = '{bad'").run();
		expect((await call(updates.GET, { key: adminKey })).json.optedIn).toEqual([]);
		await db.prepare(`UPDATE site_update_preferences SET opted_in = '{"a":1}'`).run();
		expect((await call(updates.GET, { key: adminKey })).json.optedIn).toEqual([]);
	});
});

describe('pages API', () => {
	const document = {
		version: 2,
		blocks: [{ id: 'h', type: 'heading', props: { text: 'Hi', level: 1, align: 'start' } }]
	};

	it('creates, replaces, reads, lists and deletes pages', async () => {
		const writer = await key('pages:write', 'pages:read');
		const created = await call(page.PUT, {
			method: 'PUT',
			key: writer,
			params: { slug: 'about' },
			body: { title: 'About', document }
		});
		expect(created.status).toBe(201);
		expect(created.json.page).toMatchObject({ slug: 'about', published: false, document });

		expect((await call(page.GET, { params: { slug: 'about' } })).status).toBe(404);
		expect((await call(pages.GET)).json.pages).toEqual([]);
		expect((await call(pages.GET, { key: writer })).json.pages).toHaveLength(1);

		const replaced = await call(page.PUT, {
			method: 'PUT',
			key: writer,
			params: { slug: 'about' },
			body: { title: 'About us', document, published: true }
		});
		expect(replaced.status).toBe(200);
		expect((await call(page.GET, { params: { slug: 'about' } })).json.page.title).toBe('About us');

		expect(
			(await call(page.DELETE, { method: 'DELETE', key: writer, params: { slug: 'about' } })).status
		).toBe(204);
		expect(
			(await call(page.DELETE, { method: 'DELETE', key: writer, params: { slug: 'about' } })).status
		).toBe(404);
	});

	it('refuses unsafe or malformed pages', async () => {
		const writer = await key('pages:write');
		const res = await call(page.PUT, {
			method: 'PUT',
			key: writer,
			params: { slug: 'Bad Slug' },
			body: {
				title: '',
				published: 'yes',
				document: {
					version: 2,
					blocks: [{ id: 'b', type: 'button', props: { label: 'x', href: 'javascript:alert(1)' } }]
				}
			}
		});
		expect(res.status).toBe(422);
		expect(res.json.details).toHaveLength(4);
		const empty = await call(page.PUT, {
			method: 'PUT',
			key: writer,
			params: { slug: 'x' },
			body: null
		});
		expect(empty.status).toBe(422);
	});
});

describe('page revisions API', () => {
	const doc = (text: string) => ({
		version: 2,
		blocks: [{ id: 'h', type: 'heading', props: { text, level: 1, align: 'start' } }]
	});

	it('records each changed save, lists them, and restores one', async () => {
		const writer = await key('pages:write', 'pages:read');
		const put = (title: string, text: string, published = false) =>
			call(page.PUT, {
				method: 'PUT',
				key: writer,
				params: { slug: 'about' },
				body: { title, document: doc(text), published }
			});
		await put('About', 'One');
		await put('About', 'One'); // same content: no new revision
		await put('About', 'Two', true);

		const list = await call(revisions.GET, { key: writer, params: { slug: 'about' } });
		expect(list.status).toBe(200);
		expect(list.json.revisions).toHaveLength(2);
		expect(list.json.revisions[0]).toMatchObject({ title: 'About', blocks: 1, author: 'test' });
		expect(list.json.revisions[0].document).toBeUndefined();

		const oldest = list.json.revisions[1].id as string;
		const one = await call(revision.GET, { key: writer, params: { slug: 'about', id: oldest } });
		expect(one.json.revision.document).toEqual(doc('One'));

		const restored = await call(revision.POST, {
			method: 'POST',
			key: writer,
			params: { slug: 'about', id: oldest }
		});
		expect(restored.status).toBe(200);
		expect(restored.json.page.document).toEqual(doc('One'));
		expect(restored.json.page.published).toBe(true); // visibility is not rewound

		const after = await call(revisions.GET, { key: writer, params: { slug: 'about' } });
		expect(after.json.revisions).toHaveLength(3);
	});

	it('keeps the newest 50 and removes them with the page', async () => {
		const writer = await key('pages:write', 'pages:read');
		for (let i = 0; i < 53; i++) {
			await call(page.PUT, {
				method: 'PUT',
				key: writer,
				params: { slug: 'busy' },
				body: { title: 'Busy', document: doc(`v${i}`) }
			});
		}
		const list = await call(revisions.GET, { key: writer, params: { slug: 'busy' } });
		expect(list.json.revisions).toHaveLength(50);
		await call(page.DELETE, { method: 'DELETE', key: writer, params: { slug: 'busy' } });
		const left = await db
			.prepare('SELECT COUNT(*) AS n FROM builder_page_revisions')
			.first<{ n: number }>();
		expect(left?.n).toBe(0);
	});

	it('needs scopes and finds nothing for an unknown page or revision', async () => {
		const reader = await key('pages:read');
		const writer = await key('pages:write');
		expect((await call(revisions.GET, { params: { slug: 'x' } })).status).toBe(401);
		expect((await call(revisions.GET, { key: reader, params: { slug: 'none' } })).status).toBe(404);
		expect(
			(await call(revision.GET, { key: reader, params: { slug: 'none', id: 'zz' } })).status
		).toBe(404);
		expect(
			(await call(revision.POST, { method: 'POST', key: reader, params: { slug: 'a', id: 'b' } }))
				.status
		).toBe(403);
		expect(
			(await call(revision.POST, { method: 'POST', key: writer, params: { slug: 'a', id: 'b' } }))
				.status
		).toBe(404);
	});
});

describe('OpenAPI document', () => {
	it('is served publicly and names the scope of each operation', async () => {
		const response = await openapi.GET();
		const doc = await response.json();
		expect(doc.openapi).toBe('3.1.0');
		expect(doc.paths['/api/v1/orders'].get['x-required-scope']).toBe('orders:read');
		expect(doc.paths['/api/v1/checkout'].post.security).toEqual([]);
		expect(doc.paths['/api/v1/pages/{slug}'].put.requestBody).toBeDefined();
		expect(doc.paths['/api/v1/pages/{slug}/revisions/{id}'].post['x-required-scope']).toBe(
			'pages:write'
		);
	});
});
