#!/usr/bin/env node
/**
 * Fill the LOCAL D1 database with fictional demo data so the admin pages look
 * alive in marketing screenshots.
 *
 *   npm run seed:demo
 *
 * LOCAL ONLY: `--local` is always passed to wrangler, and the script refuses to
 * run if argv carries `--remote` or any other flag.
 *
 * Idempotent. Rows with their own id use fixed `demo-…` ids with INSERT OR
 * REPLACE, and the cleanup deletes only ids starting with 'demo-' (incidents:
 * created_by = 'demo-seed'). Counter tables keyed by (day, …) have no id to
 * mark, so they use INSERT OR IGNORE and never overwrite a real row.
 * Counts are anchored to today's UTC date, so a re-run on a later day adds the
 * new days and leaves the older ones alone.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const extra = process.argv.slice(2);
if (extra.length > 0) {
	console.error(
		`seed-demo: refusing to run with arguments (${extra.join(' ')}). This script is local-only and takes none.`
	);
	process.exit(1);
}

const toml = readFileSync(join(root, 'wrangler.toml'), 'utf8');
const name = toml.match(/^\s*database_name\s*=\s*"([^"]+)"/m)?.[1];
if (!name) {
	console.error('seed-demo: no database_name in wrangler.toml');
	process.exit(1);
}

const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
const insert = (table, row, mode = 'OR REPLACE') =>
	`INSERT ${mode} INTO ${table} (${Object.keys(row).join(', ')}) VALUES (${Object.values(row)
		.map((v) => (typeof v === 'number' ? v : q(v)))
		.join(', ')});`;

// Small deterministic noise in [0, 1) so every run produces the same numbers.
const noise = (i, salt) => {
	let h = (i + 1) * 374761393 + salt * 668265263;
	h = (h ^ (h >>> 13)) * 1274126177;
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const now = new Date();
const DAY = 86400000;
const dayStr = (d) => d.toISOString().slice(0, 10);
const ts = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
const ago = (ms) => new Date(now.getTime() - ms);
const ahead = (ms) => new Date(now.getTime() + ms);
const today = dayStr(now);

const sql = [];
const add = (s) => sql.push(s);

/* ── cleanup: demo-prefixed rows only ─────────────────────────────────── */
for (const [table, col] of [
	['commerce_auction_bids', 'id'],
	['commerce_auctions', 'id'],
	['commerce_products', 'id'],
	['contact_form_submissions', 'id'],
	['content_items', 'id'],
	['chat_messages', 'id'],
	['scheduled_job_runs', 'id'],
	['users', 'id']
]) {
	add(`DELETE FROM ${table} WHERE ${col} LIKE 'demo-%';`);
}
add(
	`DELETE FROM status_incident_updates WHERE incident_id IN (SELECT id FROM status_incidents WHERE created_by = 'demo-seed');`
);
add(`DELETE FROM status_incidents WHERE created_by = 'demo-seed';`);

/* ── users ────────────────────────────────────────────────────────────── */
const people = [
	['Mira Okafor', 'superadmin', 1, 2],
	['Jonas Weber', 'admin', 1, 9],
	['Priya Raman', 'admin', 1, 15],
	['Tomas Lindqvist', 'user', 0, 24],
	['Aiko Tanaka', 'user', 0, 31],
	['Lucía Fernández', 'user', 0, 40],
	['Dara Quinn', 'user', 0, 52]
];
people.forEach(([n, role, isAdmin, daysOld], i) => {
	const handle = n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '.');
	const created = ago(daysOld * DAY);
	add(
		insert('users', {
			id: `demo-user-${i + 1}`,
			email: `${handle}@example.com`,
			name: n,
			password_hash: null,
			is_admin: isAdmin,
			role,
			github_login: null,
			github_avatar_url: null,
			created_at: ts(created),
			updated_at: ts(created),
			email_verified_at: ts(created),
			last_login_at: ts(ago(Math.floor(noise(i, 1) * 6 * DAY) + 3600000))
		})
	);
});

/* ── content + contact + chat (Overview tiles) ───────────────────────── */
const posts = [
	['Shipping a SvelteKit site on Cloudflare in an afternoon', 'published', 21],
	['What a status page should tell your customers', 'published', 14],
	['Seven small admin features that save an hour a week', 'published', 8],
	['Why we count page views without cookies', 'published', 3],
	['Roadmap: what is next for the shop', 'draft', 0]
];
posts.forEach(([title, status, daysAgo], i) => {
	const slug = title
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60);
	const created = ago(daysAgo * DAY + 7200000);
	add(
		`INSERT OR REPLACE INTO content_items (id, content_type_id, slug, title, status, fields, author_id, published_at, created_at, updated_at)
SELECT ${q(`demo-post-${i + 1}`)}, id, ${q(slug)}, ${q(title)}, ${q(status)}, '{}', ${q(`demo-user-${(i % 3) + 1}`)}, ${status === 'published' ? q(ts(created)) : 'NULL'}, ${q(ts(created))}, ${q(ts(created))} FROM content_types WHERE slug = 'blog';`
	);
});

const contacts = [
	[
		'Helena Voss',
		'helena.voss@example.com',
		'Do you offer an agency licence for multiple client sites?',
		0,
		0
	],
	[
		'Rafael Costa',
		'rafael.costa@example.com',
		'Loving the template. Can the shop take payments in BRL?',
		0,
		1
	],
	['Naomi Clarke', 'naomi.clarke@example.com', 'Is there a way to export the stats as CSV?', 1, 3],
	[
		'Sven Eriksson',
		'sven.eriksson@example.com',
		'Our status page check shows degraded, is that expected?',
		1,
		5
	],
	[
		'Amara Diallo',
		'amara.diallo@example.com',
		'Quick question about custom domains on Pages.',
		1,
		9
	]
];
contacts.forEach(([n, email, message, resolved, daysAgo], i) => {
	add(
		insert('contact_form_submissions', {
			id: `demo-contact-${i + 1}`,
			slug: `demo-contact-${i + 1}`,
			name: n,
			email,
			message,
			is_resolved: resolved,
			created_at: ts(ago(daysAgo * DAY + 3600000 * (i + 1)))
		})
	);
});

const chat = [
	['user', 'How do I add a new content type?'],
	['assistant', 'Open Admin, then Content types, then New. Pick the fields you want and save.'],
	['user', 'Can I schedule a post for next week?'],
	['assistant', 'Set the status to published and choose a future publish date.']
];
chat.forEach(([role, content], i) => {
	add(
		insert('chat_messages', {
			id: `demo-chat-${i + 1}`,
			user_id: `demo-user-${4 + Math.floor(i / 2)}`,
			role,
			content,
			created_at: ts(ago((4 - i) * 3600000))
		})
	);
});

/* ── stats: 30 days ──────────────────────────────────────────────────── */
const pages = [
	['/', 0.34, 0.1],
	['/documentation', 0.22, 0.2],
	['/badge', 0.14, 0.05],
	['/components', 0.13, 0.15],
	['/contact', 0.07, 0.3],
	['/shop', 0.06, 0.25],
	['/status', 0.04, 0.5]
];
const referrers = [
	['(direct)', 0.36],
	['google.com', 0.27],
	['github.com', 0.15],
	['news.ycombinator.com', 0.1],
	['x.com', 0.07],
	['duckduckgo.com', 0.05]
];
const countries = [
	['US', 0.38],
	['GB', 0.12],
	['DE', 0.1],
	['CA', 0.08],
	['IN', 0.1],
	['AU', 0.06],
	['FR', 0.07],
	['BR', 0.09]
];
const dims = {
	os: [
		['Windows', 0.38],
		['macOS', 0.3],
		['Linux', 0.12],
		['Android', 0.12],
		['iOS', 0.08]
	],
	browser: [
		['Chrome', 0.55],
		['Safari', 0.2],
		['Firefox', 0.12],
		['Microsoft Edge', 0.1],
		['Brave', 0.03]
	],
	device: [
		['desktop', 0.64],
		['mobile', 0.31],
		['tablet', 0.05]
	],
	language: [
		['en-US', 0.45],
		['en-GB', 0.12],
		['de', 0.1],
		['fr', 0.08],
		['pt-BR', 0.08],
		['hi', 0.07],
		['en-AU', 0.05],
		['en-CA', 0.05]
	],
	viewport: [
		['under-640', 0.28],
		['640-1023', 0.12],
		['1024-1535', 0.34],
		['1536-plus', 0.26]
	]
};
const split = (total, shares, salt) => {
	const raw = shares.map(([, w], i) => w * (0.85 + noise(i, salt) * 0.3));
	const sum = raw.reduce((a, b) => a + b, 0);
	return shares.map(([key], i) => [key, Math.round((raw[i] / sum) * total)]);
};

for (let back = 29; back >= 0; back--) {
	const d = ago(back * DAY);
	const day = dayStr(d);
	const idx = 29 - back;
	const dow = d.getUTCDay();
	const weekend = dow === 0 || dow === 6;
	const trend = 1 + idx * 0.018;
	const total = Math.round(
		(weekend ? 210 : 340) * trend * (0.9 + noise(idx, 3) * 0.2) * (back === 12 ? 1.9 : 1)
	);

	const pathCounts = split(total, pages, idx * 7 + 1);
	pathCounts.forEach(([path, views], p) => {
		const signedIn = Math.round(views * pages[p][2] * (0.8 + noise(idx, p + 20) * 0.4));
		add(
			insert('page_view_daily', { day, path_key: path, views, signed_in: signedIn }, 'OR IGNORE')
		);
	});
	for (const [host, views] of split(total, referrers, idx * 7 + 2)) {
		add(insert('referrer_daily', { day, referrer_host: host, views }, 'OR IGNORE'));
	}
	for (const [country, views] of split(total, countries, idx * 7 + 3)) {
		add(insert('country_view_daily', { day, country, views }, 'OR IGNORE'));
	}
	let salt = 4;
	for (const [dimension, shares] of Object.entries(dims)) {
		for (const [value, views] of split(total, shares, idx * 7 + salt++)) {
			add(insert('view_dimension_daily', { day, dimension, value, views }, 'OR IGNORE'));
		}
	}

	const requests = Math.round(total * (3.4 + noise(idx, 30)));
	add(
		insert(
			'platform_usage_daily',
			{
				day,
				requests,
				not_found: Math.round(requests * (0.012 + noise(idx, 31) * 0.01)),
				bot: Math.round(requests * (0.18 + noise(idx, 32) * 0.08)),
				updated_at: ts(d)
			},
			'OR IGNORE'
		)
	);
}

// Hourly series for today (up to the current hour), shaped like a working day.
for (let h = 0; h <= now.getUTCHours(); h++) {
	const curve = 0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, Math.max(0, (h - 3) / 18)));
	const views = Math.round(26 * curve * (0.8 + noise(h, 40) * 0.4)) + 3;
	add(
		insert(
			'page_view_hourly',
			{ day: today, hour: h, views, signed_in: Math.round(views * 0.12) },
			'OR IGNORE'
		)
	);
}

/* ── shop ────────────────────────────────────────────────────────────── */
const products = [
	[
		'Ceramic Mug, Nebula Glaze',
		'ceramic-mug',
		1800,
		'physical',
		'A 12oz stoneware mug in deep-space blue.',
		1
	],
	['Orbit Tee', 'orbit-tee', 2800, 'physical', 'Soft ringspun cotton with a small orbit mark.', 1],
	['Sticker Pack (6)', 'sticker-pack', 900, 'physical', 'Six die-cut vinyl stickers.', 1],
	[
		'Star Chart Poster',
		'star-chart-poster',
		2400,
		'physical',
		'An 18x24 print of the northern sky.',
		1
	],
	[
		'Admin Dashboard Template Pack',
		'dashboard-template-pack',
		4900,
		'digital',
		'Twelve ready-made admin layouts.',
		1
	],
	['Icon Set, 400 glyphs', 'icon-set', 1900, 'digital', 'SVG icons in two weights.', 1],
	['Canvas Tote', 'canvas-tote', 2200, 'physical', 'Heavy cotton tote with an inside pocket.', 1],
	['Launch Edition Hoodie', 'launch-hoodie', 5400, 'physical', 'Retired after the launch run.', 0]
];
products.forEach(([n, slug, price, type, description, active], i) => {
	const created = ago((40 - i * 3) * DAY);
	add(
		insert('commerce_products', {
			id: `demo-product-${i + 1}`,
			slug: `demo-${slug}`,
			name: n,
			description,
			price_cents: price,
			currency: 'usd',
			image_url: null,
			type,
			active,
			created_at: ts(created),
			updated_at: ts(created)
		})
	);
});

/* ── auctions ────────────────────────────────────────────────────────── */
const auction = (n, productN, o) => {
	const created = ago(10 * DAY);
	add(
		insert('commerce_auctions', {
			id: `demo-auction-${n}`,
			slug: `demo-auction-${n}`,
			product_id: `demo-product-${productN}`,
			currency: 'usd',
			increment_cents: 100,
			extend_seconds: 120,
			extensions: 0,
			version: o.bid_count,
			created_at: ts(created),
			updated_at: ts(now),
			...o
		})
	);
};
const bid = (a, i, email, max, price, leading, at) =>
	add(
		insert('commerce_auction_bids', {
			id: `demo-bid-${a}-${i}`,
			auction_id: `demo-auction-${a}`,
			bidder_id: `demo-bidder-${email.split('@')[0]}`,
			bidder_email: email,
			max_cents: max,
			price_after_cents: price,
			leading,
			created_at: ts(at)
		})
	);
auction(1, 4, {
	title: 'Signed Star Chart Poster, artist proof',
	starting_cents: 2000,
	reserve_cents: 4000,
	buy_now_cents: 15000,
	starts_at: ts(ago(2 * DAY)),
	ends_at: ts(ahead(1.5 * DAY)),
	status: 'open',
	current_cents: 5600,
	leader_id: 'demo-bidder-tomas.lindqvist',
	leader_email: 'tomas.lindqvist@example.com',
	leader_max_cents: 7500,
	bid_count: 5,
	winner_id: null,
	winner_email: null,
	final_cents: null,
	settled_at: null
});
bid(1, 1, 'aiko.tanaka@example.com', 2500, 2000, 0, ago(1.9 * DAY));
bid(1, 2, 'dara.quinn@example.com', 4000, 2600, 0, ago(1.2 * DAY));
bid(1, 3, 'aiko.tanaka@example.com', 5000, 4100, 0, ago(0.8 * DAY));
bid(1, 4, 'lucia.fernandez@example.com', 5500, 5100, 0, ago(0.3 * DAY));
bid(1, 5, 'tomas.lindqvist@example.com', 7500, 5600, 1, ago(0.1 * DAY));
auction(2, 5, {
	title: 'Admin Dashboard Template Pack, first license',
	starting_cents: 1500,
	reserve_cents: null,
	buy_now_cents: null,
	starts_at: ts(ahead(2 * DAY)),
	ends_at: ts(ahead(6 * DAY)),
	status: 'open',
	current_cents: null,
	leader_id: null,
	leader_email: null,
	leader_max_cents: null,
	bid_count: 0,
	winner_id: null,
	winner_email: null,
	final_cents: null,
	settled_at: null
});
auction(3, 8, {
	title: 'Launch Edition Hoodie, last one',
	starting_cents: 3000,
	reserve_cents: 4500,
	buy_now_cents: null,
	starts_at: ts(ago(9 * DAY)),
	ends_at: ts(ago(2 * DAY)),
	status: 'sold',
	current_cents: 6200,
	leader_id: 'demo-bidder-priya.raman',
	leader_email: 'priya.raman@example.com',
	leader_max_cents: 8000,
	bid_count: 4,
	winner_id: 'demo-bidder-priya.raman',
	winner_email: 'priya.raman@example.com',
	final_cents: 6200,
	settled_at: ts(ago(2 * DAY))
});
bid(3, 1, 'jonas.weber@example.com', 3500, 3000, 0, ago(8 * DAY));
bid(3, 2, 'priya.raman@example.com', 5000, 3600, 0, ago(6 * DAY));
bid(3, 3, 'jonas.weber@example.com', 6000, 5100, 0, ago(3 * DAY));
bid(3, 4, 'priya.raman@example.com', 8000, 6200, 1, ago(2.2 * DAY));

/* ── status page ─────────────────────────────────────────────────────── */
const ids = ['website', 'database'];
for (const [i, c] of ids.entries()) {
	add(
		insert(
			'status_components',
			{
				id: c,
				status: 'operational',
				since: ts(ago(26 * DAY)),
				last_checked: ts(ago(300000)),
				latency_ms: c === 'website' ? 142 : 18 + i,
				detail: c === 'website' ? 'Pages respond normally.' : 'Queries complete in normal time.',
				pending_count: 0
			},
			'OR IGNORE'
		)
	);
	for (let back = 29; back >= 0; back--) {
		const day = dayStr(ago(back * DAY));
		const checks = back === 0 ? Math.max(1, Math.floor(now.getUTCHours() * 12)) : 288;
		const blip = c === 'website' && back === 4;
		const degraded = blip ? 9 : 0;
		const down = blip ? 3 : 0;
		add(
			insert(
				'status_daily',
				{ component: c, day, checks, operational: checks - degraded - down, degraded, down },
				'OR IGNORE'
			)
		);
	}
}
const incStart = ago(4 * DAY + 3600000 * 2);
add(
	`INSERT INTO status_incidents (title, impact, status, components, auto, started_at, resolved_at, created_by) VALUES (${q('Elevated errors on the website')}, 'minor', 'resolved', ${q('["website"]')}, 0, ${q(ts(incStart))}, ${q(ts(new Date(incStart.getTime() + 3300000)))}, 'demo-seed');`
);
[
	['investigating', 'We are seeing elevated error rates on page loads and are looking into it.', 0],
	['resolved', 'A bad deploy was rolled back. Error rates are back to normal.', 3300000]
].forEach(([status, body, off]) => {
	add(
		`INSERT INTO status_incident_updates (incident_id, status, body, created_at, created_by) SELECT id, ${q(status)}, ${q(body)}, ${q(ts(new Date(incStart.getTime() + off)))}, 'demo-seed' FROM status_incidents WHERE created_by = 'demo-seed' ORDER BY id DESC LIMIT 1;`
	);
});

/* ── scheduled job runs ──────────────────────────────────────────────── */
const jobs = [
	['prune-view-stats', 24 * 3600000, { deleted: 0 }],
	['lighthouse', 7 * 24 * 3600000, { audited: 3 }],
	['prune-audit', 24 * 3600000, { deleted: 12 }],
	['settle-auctions', 15 * 60000, { settled: 0 }],
	['status-check', 5 * 60000, { website: 'operational', database: 'operational' }]
];
for (const [job, every, detail] of jobs) {
	const runs = Math.min(8, Math.floor((14 * DAY) / every) || 1);
	for (let r = 0; r < runs; r++) {
		const started = now.getTime() - 60000 - r * every;
		const slot = Math.floor(started / every);
		const failed = job === 'lighthouse' && r === 2;
		add(
			insert('scheduled_job_runs', {
				id: `demo-run-${job}-${r}`,
				job_id: job,
				trigger: 'cron',
				slot,
				attempts: failed ? 2 : 1,
				started_at: started,
				finished_at: started + 400 + Math.floor(noise(r, 50) * 2400),
				status: failed ? 'failed' : 'succeeded',
				error: failed ? 'Timed out waiting for the audit to finish.' : null,
				detail: failed ? null : JSON.stringify(detail),
				lease_until: started + 300000
			})
		);
	}
}

/* ── run ─────────────────────────────────────────────────────────────── */
const dir = join(homedir(), '.tmp');
mkdirSync(dir, { recursive: true });
const file = join(dir, `seed-demo-${process.pid}.sql`);
writeFileSync(file, sql.join('\n') + '\n');
const args = ['wrangler', 'd1', 'execute', name, '--local', '--file', file];
console.log(`seed-demo: npx ${args.join(' ')} (${sql.length} statements)`);
const run = spawnSync('npx', args, {
	cwd: root,
	stdio: 'inherit',
	shell: process.platform === 'win32'
});
rmSync(file, { force: true });
process.exit(run.status ?? 1);
