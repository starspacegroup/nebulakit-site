/**
 * From a failing Lighthouse finding to a fix someone can act on.
 *
 * The site does NOT rewrite itself. A fix changes code that serves production,
 * and a bad automatic change would ship straight to it with nobody looking. So
 * the loop stops one step short: this turns the stored findings into a brief
 * (what failed, where, the usual cure, where in this repo to look) and, when a
 * GitHub token is set, files it as one issue. A person or an agent picks it up
 * and the change goes through review like any other.
 *
 * One issue, updated in place, never one per run: each brief carries a marker
 * in its title, and an open issue with that marker is edited instead of
 * duplicated.
 */
import type { StoredFinding } from './lighthouse';

export interface FixRecipe {
	/** The usual cure, in a sentence. */
	fix: string;
	/** Where to look in this repo. */
	where: string;
}

/** Audit id -> cure. Ids Lighthouse adds later fall back to its own description. */
export const FIX_RECIPES: Record<string, FixRecipe> = {
	'render-blocking-insight': {
		fix: 'Inline the CSS the page needs, or defer the rest.',
		where:
			'`kit.inlineStyleThreshold` in svelte.config.js; stylesheets imported by the root layout.'
	},
	'network-dependency-tree-insight': {
		fix: 'Shorten the request chain: start non-essential fetches after `load`, preload what is needed first.',
		where: 'src/routes/+layout.svelte (client fetches at hydration); `kit.output.preloadStrategy`.'
	},
	'unused-javascript': {
		fix: 'Split the large chunk, lazy-load what is below the fold, drop an unused dependency.',
		where:
			'Dynamic `import()` in the page that pulls it in; check the heaviest chunk in `.svelte-kit/output/client`.'
	},
	'unused-css-rules': {
		fix: 'Move component-only rules into the component; delete dead global rules.',
		where: 'src/app.css and src/lib/ui/*.svelte.'
	},
	'cache-insight': {
		fix: 'Give static assets a long `Cache-Control`. Third-party scripts are outside this repo.',
		where:
			'`_headers` at the repo root. Cloudflare Web Analytics is toggled in the Pages dashboard.'
	},
	'legacy-javascript-insight': {
		fix: 'Raise the build target so no polyfills ship. Third-party scripts are outside this repo.',
		where: '`build.target` in vite.config.ts.'
	},
	'image-delivery-insight': {
		fix: 'Serve images at their display size in a modern format, with width and height set.',
		where: 'The `<img>` tags on the page; static/ assets.'
	},
	'largest-contentful-paint': {
		fix: 'Make the largest element render sooner: preload it, do not lazy-load it, shrink it.',
		where: 'The hero section of the page named below.'
	},
	'cumulative-layout-shift': {
		fix: 'Reserve space for images, embeds and late-loading content.',
		where: 'Give media explicit `width`/`height` or `aspect-ratio`.'
	},
	'color-contrast': {
		fix: 'Raise text/background contrast to 4.5:1. Change the CSS variable, never a hardcoded color.',
		where: 'Theme tokens in src/app.css; `bun run validate:contrast`.'
	},
	'meta-description': {
		fix: 'Add a unique meta description.',
		where: '`SharingMeta` props on the page.'
	},
	'document-title': { fix: 'Give the page a `<title>`.', where: '`<svelte:head>` in the page.' },
	'is-crawlable': {
		fix: 'Remove the noindex or the robots.txt rule that blocks this page.',
		where: 'src/routes/robots.txt and the `X-Robots-Tag` header.'
	},
	'link-name': {
		fix: 'Give every link text or an aria-label.',
		where: 'The link named in the report.'
	},
	label: { fix: 'Associate each form control with a label.', where: 'The form in the report.' }
};

const MARKER = 'lighthouse-autofix';
export const FIX_ISSUE_LABEL = MARKER;

export interface FixBrief {
	title: string;
	body: string;
	/** How many distinct failing audits the brief covers. */
	count: number;
}

/**
 * The brief for the current findings, or null when nothing is failing.
 * Grouped by audit so a problem on six pages is one item, not six.
 */
export function buildFixBrief(findings: StoredFinding[], siteUrl: string): FixBrief | null {
	// Stored scores are 0-100, the same bands as the report (under 90 is flagged).
	const failing = findings.filter((f) => f.score !== null && f.score < 90);
	if (failing.length === 0) return null;

	const byAudit = new Map<string, StoredFinding[]>();
	for (const finding of failing) {
		const list = byAudit.get(finding.audit_id) ?? [];
		list.push(finding);
		byAudit.set(finding.audit_id, list);
	}

	const sections = [...byAudit.entries()]
		.sort(
			(a, b) =>
				Math.min(...a[1].map((f) => f.score ?? 0)) - Math.min(...b[1].map((f) => f.score ?? 0))
		)
		.map(([auditId, list]) => {
			const recipe = FIX_RECIPES[auditId];
			const pages = [...new Set(list.map((f) => `${f.path} (${f.strategy})`))].join(', ');
			const first = list[0];
			return [
				`### ${first.title} \`${auditId}\``,
				first.display_value ? `Measured: ${first.display_value}` : null,
				`Pages: ${pages}`,
				recipe
					? `Usual fix: ${recipe.fix}\nLook in: ${recipe.where}`
					: `No stock recipe. Lighthouse says: ${(first.description ?? 'see the report').slice(0, 300)}`
			]
				.filter(Boolean)
				.join('\n');
		});

	const body = [
		`<!-- ${MARKER} -->`,
		`Lighthouse flagged ${byAudit.size} audit${byAudit.size === 1 ? '' : 's'} on ${siteUrl}.`,
		'',
		'Fix what is in this repo, run `bun run check` and the tests, and open a PR. Do not push to main. Leave the third-party items alone and say so.',
		'',
		...sections.flatMap((s) => [s, '']),
		'This issue is edited in place on every run. It closes when nothing is flagged.'
	].join('\n');

	return {
		title: `Lighthouse: ${byAudit.size} audit${byAudit.size === 1 ? '' : 's'} below 90`,
		body,
		count: byAudit.size
	};
}

export interface GithubTarget {
	token: string;
	/** `owner/name` */
	repo: string;
}

export interface FixIssueResult {
	url: string;
	created: boolean;
}

async function github(
	fetcher: typeof fetch,
	target: GithubTarget,
	path: string,
	init: { method?: string; body?: unknown } = {}
): Promise<Response> {
	return fetcher(`https://api.github.com/repos/${target.repo}${path}`, {
		method: init.method ?? 'GET',
		headers: {
			authorization: `Bearer ${target.token}`,
			accept: 'application/vnd.github+json',
			'user-agent': 'nebulakit-lighthouse-autofix',
			...(init.body ? { 'content-type': 'application/json' } : {})
		},
		body: init.body ? JSON.stringify(init.body) : undefined,
		signal: AbortSignal.timeout(15_000)
	});
}

/**
 * File the brief, or edit the open issue that already holds one. Throws with
 * GitHub's status on failure; callers decide whether that is fatal.
 */
export async function publishFixIssue(
	brief: FixBrief,
	target: GithubTarget,
	fetcher: typeof fetch = fetch
): Promise<FixIssueResult> {
	const open = await github(
		fetcher,
		target,
		`/issues?state=open&labels=${FIX_ISSUE_LABEL}&per_page=1`
	);
	if (!open.ok) throw new Error(`GitHub refused the issue lookup (${open.status})`);
	const [existing] = (await open.json()) as { number: number; html_url: string }[];

	if (existing) {
		const edit = await github(fetcher, target, `/issues/${existing.number}`, {
			method: 'PATCH',
			body: { title: brief.title, body: brief.body }
		});
		if (!edit.ok) throw new Error(`GitHub refused the issue update (${edit.status})`);
		return { url: existing.html_url, created: false };
	}

	const create = await github(fetcher, target, '/issues', {
		method: 'POST',
		body: { title: brief.title, body: brief.body, labels: [FIX_ISSUE_LABEL] }
	});
	if (!create.ok) throw new Error(`GitHub refused the issue (${create.status})`);
	const made = (await create.json()) as { html_url: string };
	return { url: made.html_url, created: true };
}

/**
 * Close the open fix issue, with a comment, once nothing is flagged. Returns the
 * issue URL when it closed one, null when there was none. Throws like
 * {@link publishFixIssue}.
 */
export async function closeFixIssue(
	target: GithubTarget,
	fetcher: typeof fetch = fetch
): Promise<string | null> {
	const open = await github(
		fetcher,
		target,
		`/issues?state=open&labels=${FIX_ISSUE_LABEL}&per_page=1`
	);
	if (!open.ok) throw new Error(`GitHub refused the issue lookup (${open.status})`);
	const [existing] = (await open.json()) as { number: number; html_url: string }[];
	if (!existing) return null;

	const note = await github(fetcher, target, `/issues/${existing.number}/comments`, {
		method: 'POST',
		body: { body: 'The latest Lighthouse run flagged nothing. Closing.' }
	});
	if (!note.ok) throw new Error(`GitHub refused the comment (${note.status})`);
	const close = await github(fetcher, target, `/issues/${existing.number}`, {
		method: 'PATCH',
		body: { state: 'closed', state_reason: 'completed' }
	});
	if (!close.ok) throw new Error(`GitHub refused to close the issue (${close.status})`);
	return existing.html_url;
}

/** The GitHub target from the environment, or null when no token is set. */
export function githubTarget(env: {
	GITHUB_TOKEN?: string;
	GITHUB_REPO?: string;
}): GithubTarget | null {
	if (!env.GITHUB_TOKEN) return null;
	const repo = env.GITHUB_REPO ?? 'starspacegroup/nebulakit-site';
	return /^[\w.-]+\/[\w.-]+$/.test(repo) ? { token: env.GITHUB_TOKEN, repo } : null;
}
