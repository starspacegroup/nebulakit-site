<!--
	/showcase — the drag-and-drop component library, running.

	Everything below the fold is prose about the board. The board itself is the
	argument: a real WidgetBoard with this site's own registered widgets, saving
	to localStorage, with counters that show what it does and does not write.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import SharingMeta from '$lib/components/SharingMeta.svelte';
	import WidgetBoard from '$lib/components/WidgetBoard.svelte';
	import { site } from '$lib/site.config';
	import { parseLayout } from '$lib/utils/board-layout';
	import { widgetManifest } from '$lib/widgets/manifest';
	import type { BoardColumn, BoardWidget } from '$lib/widgets/types';

	const STORAGE_KEY = 'nebulakit-showcase-layout';

	const columns: BoardColumn[] = [
		{ id: 'overview', title: 'Overview' },
		{ id: 'activity', title: 'Activity' },
		{ id: 'scratch', title: 'Scratch' }
	];

	/** The layout a first-time visitor sees, and what Reset goes back to. */
	function defaultLayout(): BoardWidget[] {
		return [
			{ id: 'clock', type: 'clock', group: 'overview', order: 0, props: { label: 'your time' } },
			{
				id: 'views',
				type: 'stat',
				group: 'overview',
				order: 1,
				title: 'Page views',
				props: {
					label: 'last 7 days',
					value: '24,802',
					delta: 12,
					accent: 'views',
					series: [18, 21, 19, 24, 22, 27, 31]
				}
			},
			{
				id: 'signups',
				type: 'stat',
				group: 'activity',
				order: 0,
				title: 'Signups',
				props: {
					label: 'last 7 days',
					value: '312',
					delta: -4,
					accent: 'users',
					series: [42, 39, 44, 37, 35, 33, 31]
				}
			},
			{
				id: 'uptime',
				type: 'stat',
				group: 'activity',
				order: 1,
				title: 'Uptime',
				props: {
					label: 'rolling 30 days',
					value: '99.98%',
					delta: 0,
					accent: 'usage',
					series: [100, 100, 99.9, 100, 100, 99.9, 100]
				}
			},
			{
				id: 'notes',
				type: 'notes',
				group: 'scratch',
				order: 0,
				title: 'Scratch pad',
				props: { text: 'Drag a widget by its handle. Or focus one and press space.' }
			}
		];
	}

	let widgets: BoardWidget[] = defaultLayout();
	/** Display-only titles. Never persisted, never part of `widgets`. */
	let live: Record<string, string> = {};
	let layoutWrites = 0;
	let liveUpdates = 0;
	let editable = true;

	onMount(() => {
		widgets = parseLayout(localStorage.getItem(STORAGE_KEY), {
			groups: columns.map((column) => column.id),
			types: widgetManifest.map((widget) => widget.name),
			fallback: defaultLayout()
		});
	});

	function persist(next: BoardWidget[]) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
		layoutWrites += 1;
	}

	function handleChange(event: CustomEvent<{ widgets: BoardWidget[] }>) {
		persist(event.detail.widgets);
	}

	// The clock ticks once a second and lands here. Nothing in `widgets` moves,
	// so the write counter above stays exactly where it was.
	function handleLive(event: CustomEvent<{ id: string; value: string }>) {
		live = { ...live, [event.detail.id]: event.detail.value };
		liveUpdates += 1;
	}

	function reset() {
		widgets = defaultLayout();
		live = {};
		localStorage.removeItem(STORAGE_KEY);
		layoutWrites = 0;
		liveUpdates = 0;
	}

	const boardUsage = `<WidgetBoard
  bind:widgets
  {columns}
  {live}
  on:change={(e) => save(e.detail.widgets)}
  on:live={(e) => (live = { ...live, [e.detail.id]: e.detail.value })}
/>`;

	const actionUsage = `<ul use:dropzone={{ group: 'list' }}>
  {#each items as item (item.id)}
    <li use:draggable={{ id: item.id, group: 'list', onDrop }}>
      <button data-drag-handle>Drag</button> {item.name}
    </li>
  {/each}
</ul>`;
</script>

<SharingMeta
	title="Drag-and-drop showcase"
	description="The NebulaKit widget board, running: pointer, touch and keyboard dragging, a widget registry, and a reorder engine that cannot corrupt its own ordering."
	url={`${site.url}/showcase`}
/>

<main class="showcase">
	<div class="showcase__shell">
		<header class="showcase__header">
			<p class="showcase__eyebrow">Component library</p>
			<h1>Drag it. Type in it. Or never touch the mouse.</h1>
			<p class="showcase__lede">
				This is the real <code>&lt;WidgetBoard&gt;</code> from {site.name}, with this site's own
				widgets registered in it. Rearrange it however you like — your layout is saved in this
				browser, and nothing here is a screenshot.
			</p>
		</header>

		<section class="showcase__board-section" aria-labelledby="board-title">
			<div class="showcase__toolbar">
				<h2 id="board-title" class="showcase__toolbar-title">Try it</h2>
				<div class="showcase__meters">
					<p class="meter">
						<span class="meter__value">{layoutWrites}</span>
						<span class="meter__label">layout writes</span>
					</p>
					<p class="meter">
						<span class="meter__value">{liveUpdates}</span>
						<span class="meter__label">live title updates</span>
					</p>
				</div>
				<div class="showcase__controls">
					<label class="showcase__toggle">
						<input type="checkbox" bind:checked={editable} />
						Draggable
					</label>
					<button type="button" class="showcase__reset" on:click={reset}>Reset layout</button>
				</div>
			</div>

			<WidgetBoard
				bind:widgets
				{columns}
				{live}
				{editable}
				board="showcase"
				emptyMessage="Drop a widget here"
				on:change={handleChange}
				on:live={handleLive}
			/>

			<p class="showcase__note">
				The clock rewrites its own title every second, and the layout has been written
				<strong>{layoutWrites}</strong>
				{layoutWrites === 1 ? 'time' : 'times'} — only when you actually moved something. That split is
				deliberate; see rule four below.
			</p>
		</section>

		<section class="showcase__section" aria-labelledby="keyboard-title">
			<h2 id="keyboard-title">It works without a mouse</h2>
			<p>
				Tab to any widget's drag handle and the whole board opens up. Every move is announced to a
				screen reader as it happens.
			</p>
			<dl class="keys">
				<div class="keys__row">
					<dt><kbd>Space</kbd> or <kbd>Enter</kbd></dt>
					<dd>Pick the widget up, and put it down again</dd>
				</div>
				<div class="keys__row">
					<dt><kbd>↑</kbd> <kbd>↓</kbd></dt>
					<dd>Move it within its column</dd>
				</div>
				<div class="keys__row">
					<dt><kbd>←</kbd> <kbd>→</kbd></dt>
					<dd>Move it to the column either side</dd>
				</div>
				<div class="keys__row">
					<dt><kbd>Esc</kbd></dt>
					<dd>Cancel, and put it back where it started</dd>
				</div>
			</dl>
			<p class="showcase__aside">
				On a phone, hold a handle for a moment before dragging — a swipe stays a swipe, so the page
				still scrolls. Drag near the top or bottom edge and the page scrolls with you.
			</p>
		</section>

		<section class="showcase__section" aria-labelledby="usage-title">
			<h2 id="usage-title">What it costs you to use</h2>
			<p>A board is one component and a list of columns:</p>
			<pre class="showcase__code"><code>{boardUsage}</code></pre>
			<p>
				Registering a widget is a manifest entry, a line in the component map, and the component
				itself. It never means editing the board. This site registers {widgetManifest.length} of them:
			</p>
			<ul class="registry" aria-label="Registered widgets">
				{#each widgetManifest as widget (widget.name)}
					<li class="registry__item">
						<code>{widget.name}</code>
						<span>{widget.description}</span>
					</li>
				{/each}
			</ul>
			<p>
				The board is not the only way in. The two actions underneath it work on any markup, so a
				sortable list or a nav reorder needs no board at all:
			</p>
			<pre class="showcase__code"><code>{actionUsage}</code></pre>
		</section>

		<section class="showcase__section" aria-labelledby="rules-title">
			<h2 id="rules-title">Four rules, each one paid for</h2>
			<p>
				This did not come out of a library. It came out of a dashboard that shipped a widget board
				and then spent months finding out how it was wrong. Every rule below is a defect somebody
				already paid for.
			</p>
			<ol class="rules">
				<li class="rules__item">
					<h3>Order is derived, never patched</h3>
					<p>
						Reordering is a pure function: remove, clamp, splice, renumber. The version that
						adjusted each widget's position with a chain of conditionals gave two widgets the same
						slot, and they took turns winning — so a widget would jump back, or swap with a
						neighbour, or refuse to move.
					</p>
				</li>
				<li class="rules__item">
					<h3>Carry identity, never position</h3>
					<p>
						A drop reports the column's id, which the actions stamp themselves. The version that
						reported the column's <em>index</em> agreed with the id only until someone moved a column;
						after that, drops landed in the wrong one — or vanished until reload.
					</p>
				</li>
				<li class="rules__item">
					<h3>Hit-test in the space you mutate</h3>
					<p>
						While you drag, the widget is still in the page — only a ghost moves. The insertion
						point is worked out with it taken out of the list, which is the same list the reorder
						writes into. Skip that and every downward move lands one slot too high.
					</p>
				</li>
				<li class="rules__item">
					<h3>Persisted state must be inert</h3>
					<p>
						Live values go through a separate channel, never into stored state. The version that put
						a live price in a widget's title rewrote the entire dashboard on every tick: about 650
						writes a day against a 1,000-a-day account limit, from one open tab.
					</p>
				</li>
			</ol>
		</section>

		<section class="showcase__section showcase__section--last" aria-labelledby="more-title">
			<h2 id="more-title">Read the rest</h2>
			<p>
				<a href="/documentation#drag-and-drop">The documentation page</a> covers it in the context
				of the rest of the template. The full reference — the layer map, the component contract, and
				every rule in detail — is
				<a
					href="https://github.com/starspacegroup/NebulaKit/blob/main/docs/WIDGET_BOARD.md"
					target="_blank"
					rel="noopener noreferrer">docs/WIDGET_BOARD.md</a
				> in the template.
			</p>
		</section>
	</div>
</main>

<style>
	.showcase {
		min-height: 100vh;
		padding: var(--spacing-xl) var(--spacing-md);
		background-color: var(--color-background);
	}

	.showcase__shell {
		max-width: 1100px;
		margin: 0 auto;
	}

	.showcase__header {
		max-width: 46rem;
		margin-bottom: var(--spacing-2xl);
	}

	.showcase__eyebrow {
		margin: 0 0 var(--spacing-sm);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--color-primary);
	}

	.showcase__header h1 {
		margin: 0 0 var(--spacing-md);
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1.15;
		color: var(--color-text);
	}

	.showcase__lede {
		margin: 0;
		font-size: 1.125rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	.showcase__board-section {
		margin-bottom: var(--spacing-2xl);
		padding: var(--spacing-lg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background-color: color-mix(in srgb, var(--color-surface) 55%, var(--color-background));
	}

	.showcase__toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-md);
		margin-bottom: var(--spacing-lg);
	}

	.showcase__toolbar-title {
		flex: 1 1 auto;
		margin: 0;
		font-size: 1.25rem;
		color: var(--color-text);
	}

	.showcase__meters {
		display: flex;
		gap: var(--spacing-lg);
	}

	.meter {
		display: flex;
		flex-direction: column;
		margin: 0;
		line-height: 1.2;
	}

	.meter__value {
		font-size: 1.25rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		color: var(--color-primary);
	}

	.meter__label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-text-secondary);
	}

	.showcase__controls {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}

	.showcase__toggle {
		display: flex;
		align-items: center;
		gap: var(--spacing-xs);
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.showcase__reset {
		padding: var(--spacing-xs) var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background-color: var(--color-surface);
		color: var(--color-text);
		font-size: 0.875rem;
		cursor: pointer;
		transition: border-color var(--transition-fast);
	}

	.showcase__reset:hover {
		border-color: var(--color-primary);
	}

	.showcase__note {
		margin: var(--spacing-lg) 0 0;
		font-size: 0.875rem;
		line-height: 1.6;
		color: var(--color-text-secondary);
	}

	.showcase__section {
		max-width: 46rem;
		margin-bottom: var(--spacing-2xl);
		padding-bottom: var(--spacing-xl);
		border-bottom: 1px solid var(--color-border);
	}

	.showcase__section--last {
		border-bottom: none;
	}

	.showcase__section h2 {
		margin: 0 0 var(--spacing-md);
		font-size: 1.5rem;
		color: var(--color-text);
	}

	.showcase__section p {
		margin: 0 0 var(--spacing-md);
		line-height: 1.7;
		color: var(--color-text-secondary);
	}

	.showcase__aside {
		font-size: 0.9375rem;
	}

	.keys {
		margin: 0 0 var(--spacing-md);
	}

	.keys__row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) 0;
		border-bottom: 1px solid var(--color-border);
	}

	.keys__row dt {
		flex: 0 0 10rem;
		margin: 0;
	}

	.keys__row dd {
		flex: 1 1 12rem;
		margin: 0;
		color: var(--color-text-secondary);
	}

	kbd {
		display: inline-block;
		padding: 0.1rem 0.4rem;
		border: 1px solid var(--color-border);
		border-bottom-width: 2px;
		border-radius: var(--radius-sm);
		background-color: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-mono, monospace);
		font-size: 0.8125rem;
	}

	.showcase__code {
		margin: 0 0 var(--spacing-md);
		padding: var(--spacing-md);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface);
		color: var(--color-text);
		font-size: 0.8125rem;
		line-height: 1.6;
		overflow-x: auto;
	}

	.registry {
		margin: 0 0 var(--spacing-md);
		padding: 0;
		list-style: none;
	}

	.registry__item {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-sm);
		padding: var(--spacing-sm) 0;
		border-bottom: 1px solid var(--color-border);
		color: var(--color-text-secondary);
	}

	.registry__item code {
		flex: 0 0 5rem;
		color: var(--color-primary);
	}

	.rules {
		margin: 0;
		padding-left: var(--spacing-lg);
	}

	.rules__item {
		margin-bottom: var(--spacing-lg);
	}

	.rules__item h3 {
		margin: 0 0 var(--spacing-xs);
		font-size: 1.0625rem;
		color: var(--color-text);
	}

	.rules__item p {
		margin: 0;
	}

	@media (min-width: 48rem) {
		.showcase {
			padding: var(--spacing-2xl);
		}

		.showcase__header h1 {
			font-size: 3rem;
		}
	}
</style>
