<script lang="ts">
	import { page } from '$app/stores';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import { site } from '$lib/site.config';
	import {
		BADGE_THEMES,
		BADGE_VARIANTS,
		BADGE_VARIANT_KEYS,
		badgeSnippets,
		badgeSvgUrl,
		badgeText,
		lighthouseBadgeSnippets,
		lighthouseBadgeText,
		lighthouseBadgeUrl,
		LIGHTHOUSE_BADGE_VARIANTS,
		LIGHTHOUSE_BADGE_VARIANT_KEYS,
		type BadgeTheme,
		type BadgeVariant,
		type LighthouseBadgeVariant
	} from '$lib/badge';

	const description =
		'The NebulaKit badge for your README, your site or your app. Pick the wording, pick the ground, copy the snippet.';

	let variant: BadgeVariant = 'proudly';
	let theme: BadgeTheme = 'dark';
	let scoreVariant: LighthouseBadgeVariant = 'overall';

	/* The origin of the request, not site.config.url, so a preview deployment
	   hands out snippets that point at itself and can actually be tested. */
	$: origin = $page.url.origin;
	$: svgUrl = badgeSvgUrl(origin, variant, theme);
	$: snippets = badgeSnippets({ variant, theme, origin });
	$: scoreUrl = lighthouseBadgeUrl(origin, scoreVariant, theme);
	$: scoreSnippets = lighthouseBadgeSnippets({ variant: scoreVariant, theme, origin });
	$: scoreForms = [
		{
			id: 'lh-markdown',
			title: 'Markdown',
			note: 'For a README on GitHub. The image is fetched each time the page is viewed, so the number stays current on its own.',
			code: scoreSnippets.markdown
		},
		{
			id: 'lh-html',
			title: 'HTML',
			note: 'Same image, for anywhere Markdown is not an option.',
			code: scoreSnippets.html
		}
	];

	/* What each wording is honestly for. The badge offers three because a single
	   one would have people editing the snippet to say something slightly untrue. */
	const VARIANT_HELP: Record<BadgeVariant, string> = {
		proudly: 'You started from the template and you are glad you did. Say so.',
		built: 'The plain statement, for a footer that is already busy.',
		powered: 'Something that runs on NebulaKit rather than something built from it.'
	};

	$: forms = [
		{
			id: 'markdown',
			title: 'Markdown',
			note: 'For a README on GitHub. It embeds the image above, so it stays fixed to the ground you picked — a README has no media queries to follow.',
			code: snippets.markdown
		},
		{
			id: 'html',
			title: 'HTML',
			note: 'Real text rather than an image, so it scales with the page and reads to a screen reader. Follows the reader’s colour scheme on its own.',
			code: snippets.html
		},
		{
			id: 'webComponent',
			title: 'Web component',
			note: 'Two lines, no CSS to paste. The badge renders in a shadow root, so your styles cannot reach it and its styles cannot leak out.',
			code: snippets.webComponent
		},
		{
			id: 'react',
			title: 'React',
			note: 'A component and the CSS it needs.',
			code: snippets.react
		},
		{
			id: 'svelte',
			title: 'Svelte',
			note: 'Drop it in anywhere. An app generated from the template already has this one in its footer.',
			code: snippets.svelte
		},
		{ id: 'vue', title: 'Vue', note: 'Single-file component, scoped styles.', code: snippets.vue }
	];

	let copied: string | null = null;
	let copyTimer: ReturnType<typeof setTimeout>;

	async function copy(id: string, code: string) {
		try {
			await navigator.clipboard.writeText(code);
			copied = id;
			clearTimeout(copyTimer);
			copyTimer = setTimeout(() => (copied = null), 2000);
		} catch {
			/* Clipboard refused — an insecure origin, or the reader said no. The
			   snippet is on screen and selectable, so there is nothing to repair
			   and nothing worth interrupting them about. */
			copied = null;
		}
	}
</script>

<SharingMeta
	title="Badge"
	{description}
	image="/og-image.png"
	imageAlt={`${site.name} — the badge`}
	imageWidth={1200}
	imageHeight={630}
/>

<div class="page">
	<header class="page-header">
		<h1>Wear the badge</h1>
		<p class="page-lede">{description}</p>
	</header>

	<section class="builder" aria-labelledby="builder-heading">
		<h2 id="builder-heading" class="visually-hidden">Build your badge</h2>

		<div class="controls">
			<fieldset class="control">
				<legend>Wording</legend>
				<div class="chips">
					{#each BADGE_VARIANT_KEYS as key (key)}
						<label class="chip" class:selected={variant === key}>
							<input type="radio" name="variant" value={key} bind:group={variant} />
							<span>{badgeText(key)}</span>
						</label>
					{/each}
				</div>
				<p class="control-help">{VARIANT_HELP[variant]}</p>
			</fieldset>

			<fieldset class="control">
				<legend>Ground</legend>
				<div class="chips">
					{#each [{ key: 'dark', label: 'Dark' }, { key: 'light', label: 'Light' }] as option (option.key)}
						<label class="chip" class:selected={theme === option.key}>
							<input type="radio" name="theme" value={option.key} bind:group={theme} />
							<span>{option.label}</span>
						</label>
					{/each}
				</div>
				<p class="control-help">
					The HTML and web-component badges follow the reader’s own colour scheme whatever you pick
					here. This sets the image, and the side each of those starts from.
				</p>
			</fieldset>
		</div>

		<!-- The panel stands in for the page the badge will land on, so it takes the
		     badge's own ground rather than this site's surface. The value comes from
		     BADGE_THEMES so the preview cannot drift from the image inside it. -->
		<div class="preview" style="background: {BADGE_THEMES[theme].background}">
			<img src={svgUrl} alt={badgeText(variant)} />
		</div>

		<p class="preview-note">
			That is the real image, served from
			<a href={svgUrl}><code>/badge.svg</code></a> — link it wherever you like; it needs nothing
			from this site to render. The mark on its own lives at
			<a href="/badge-mark.svg"><code>/badge-mark.svg</code></a>.
		</p>
	</section>

	<section class="forms" aria-labelledby="forms-heading">
		<div class="section-head">
			<h2 id="forms-heading">Copy one</h2>
			<p class="section-lede">
				Every one of these points at <a href={origin}>{origin}</a>. Nothing loads a font, a
				stylesheet or a tracker from us — the mark is drawn inline, so the only request any of these
				makes is the one you can see.
			</p>
		</div>

		{#each forms as form (form.id)}
			<article class="form">
				<div class="form-head">
					<h3>{form.title}</h3>
					<button type="button" class="copy" on:click={() => copy(form.id, form.code)}>
						{copied === form.id ? 'Copied' : 'Copy'}
					</button>
				</div>
				<p class="form-note">{form.note}</p>
				<pre><code>{form.code}</code></pre>
			</article>
		{/each}
	</section>

	<section class="forms" aria-labelledby="score-heading">
		<div class="section-head">
			<h2 id="score-heading">The Lighthouse badge</h2>
			<p class="section-lede">
				The other badge says what you built with. This one says how it scores. The number is read
				from the last audit rather than typed in, so it is the measurement rather than a claim about
				it — and if a page ever slips, every README carrying this badge shows the lower number, in
				amber, on its next fetch.
			</p>
		</div>

		<fieldset class="control">
			<legend>Detail</legend>
			<div class="chips">
				{#each LIGHTHOUSE_BADGE_VARIANT_KEYS as key (key)}
					<label class="chip" class:selected={scoreVariant === key}>
						<input type="radio" name="score-variant" value={key} bind:group={scoreVariant} />
						<span>{key === 'categories' ? 'Four categories' : 'One number'}</span>
					</label>
				{/each}
			</div>
			<p class="control-help">{LIGHTHOUSE_BADGE_VARIANTS[scoreVariant]}</p>
		</fieldset>

		<div class="preview" style="background: {BADGE_THEMES[theme].background}">
			<img src={scoreUrl} alt={lighthouseBadgeText(scoreVariant)} />
		</div>

		<p class="preview-note">
			Served from <a href={scoreUrl}><code>/badge-lighthouse.svg</code></a>, on the ground you
			picked above. Reproduce the run behind it with <code>bun run lighthouse</code>.
		</p>

		{#each scoreForms as form (form.id)}
			<article class="form">
				<div class="form-head">
					<h3>{form.title}</h3>
					<button type="button" class="copy" on:click={() => copy(form.id, form.code)}>
						{copied === form.id ? 'Copied' : 'Copy'}
					</button>
				</div>
				<p class="form-note">{form.note}</p>
				<pre><code>{form.code}</code></pre>
			</article>
		{/each}
	</section>

	<section class="terms" aria-labelledby="terms-heading">
		<h2 id="terms-heading">Using it</h2>
		<p>
			The badge is yours to use on anything built with NebulaKit, at no cost and with nothing to
			sign. Link it back to <a href={origin}>{origin}</a> and leave the wording as it comes — those are
			the only two asks.
		</p>
		<p>
			It is never required. NebulaKit is MIT-licensed, apps generated from the template ship the
			badge switched on as a courtesy, and
			<code>showBuiltWithBadge: false</code> in <code>src/lib/site.config.ts</code> removes it with no
			hard feelings.
		</p>
	</section>
</div>

<style>
	.page {
		max-width: var(--layout-feature-grid-max-width);
		margin: 0 auto;
		padding: var(--spacing-2xl) var(--spacing-md);
	}

	.page-header {
		max-width: 46rem;
		margin: 0 auto var(--spacing-2xl);
		text-align: center;
	}

	.page-header h1 {
		margin: 0 0 var(--spacing-sm);
		font-size: clamp(2.25rem, 6vw, 3.25rem);
		font-weight: 800;
		letter-spacing: -0.02em;
	}

	.page-lede {
		margin: 0;
		font-size: 1.15rem;
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.builder {
		max-width: 60rem;
		margin: 0 auto var(--spacing-2xl);
		padding: var(--spacing-xl);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.controls {
		display: grid;
		gap: var(--spacing-xl);
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
		align-items: start;
	}

	.control {
		border: 0;
		padding: 0;
		margin: 0;
	}

	.control legend {
		padding: 0;
		margin-bottom: var(--spacing-sm);
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-text);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
	}

	.chip {
		display: inline-flex;
		align-items: center;
		padding: 0.45rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-background);
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		cursor: pointer;
		transition:
			border-color var(--transition-fast),
			color var(--transition-fast);
	}

	.chip:hover {
		border-color: var(--color-primary);
	}

	.chip.selected {
		border-color: var(--color-primary);
		color: var(--color-text);
		font-weight: 600;
	}

	/* The radio itself is hidden but still focusable, so the keyboard ring has to
	   be drawn on the label it lives in. */
	.chip input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}

	.chip:focus-within {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.control-help {
		margin: var(--spacing-sm) 0 0;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	.preview {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-top: var(--spacing-xl);
		padding: var(--spacing-2xl) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.preview img {
		max-width: 100%;
	}

	.preview-note {
		margin: var(--spacing-sm) 0 0;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	.forms {
		max-width: 60rem;
		margin: 0 auto;
	}

	.section-head {
		margin-bottom: var(--spacing-xl);
	}

	.section-head h2,
	.terms h2 {
		margin: 0 0 var(--spacing-sm);
		font-size: 1.75rem;
		font-weight: 700;
		letter-spacing: -0.01em;
	}

	.section-lede {
		margin: 0;
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.form {
		margin-bottom: var(--spacing-xl);
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface);
	}

	.form-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-md);
	}

	.form-head h3 {
		margin: 0;
		font-size: 1.05rem;
		font-weight: 600;
	}

	.copy {
		padding: 0.35rem 0.85rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		color: var(--color-text-secondary);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			border-color var(--transition-fast),
			color var(--transition-fast);
	}

	.copy:hover {
		border-color: var(--color-primary);
		color: var(--color-text);
	}

	.form-note {
		margin: var(--spacing-sm) 0 var(--spacing-md);
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	pre {
		margin: 0;
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-background);
		overflow-x: auto;
	}

	code {
		font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
		font-size: 0.8125rem;
		line-height: 1.6;
	}

	.terms {
		max-width: 60rem;
		margin: 0 auto;
		padding-top: var(--spacing-xl);
		border-top: 1px solid var(--color-border);
	}

	.terms p {
		margin: 0 0 var(--spacing-md);
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.terms code {
		padding: 0.1rem 0.3rem;
		border-radius: var(--radius-sm);
		background: var(--color-surface);
	}

	a {
		color: var(--color-primary);
	}
</style>
