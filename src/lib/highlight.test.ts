/**
 * The snippet highlighter.
 *
 * The output of this module is injected with `{@html}`, so the assertions that
 * matter are about escaping first and colour second. The Workers-runtime
 * failure that chose the library cannot be reached from here — node has no
 * `window` either, but it has the CommonJS interop that hides the problem — so
 * that one is checked by rendering the page under `wrangler pages dev`.
 */
import { describe, expect, it } from 'vitest';
import { escapeHtml, highlight, highlightSnippet, SNIPPET_LANGUAGES } from './highlight';

describe('escapeHtml', () => {
	it('escapes both angle brackets, not just the opening one', () => {
		// Prism escapes `<` and leaves `>` alone, which reopened the web
		// component snippet's `-->` as a comment and rendered it twice.
		expect(escapeHtml('<!-- x -->')).toBe('&lt;!-- x --&gt;');
	});

	it('escapes the ampersand before the entities it introduces', () => {
		expect(escapeHtml('&lt;')).toBe('&amp;lt;');
	});

	it('escapes quotes, so output cannot break out of an attribute', () => {
		expect(escapeHtml('a "b" c')).toBe('a &quot;b&quot; c');
	});
});

describe('highlight', () => {
	it('tokenizes a language it knows', () => {
		const out = highlight('<a href="/x">hi</a>', 'xml');
		expect(out).toContain('hljs-');
		expect(out).not.toContain('<a href');
	});

	it('escapes rather than passing through a language it does not know', () => {
		// The dangerous branch: anything returned here is injected as HTML.
		const out = highlight('<script>alert(1)</script>', 'klingon');
		expect(out).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
		expect(out).not.toContain('<script');
	});

	it('escapes when given no language at all', () => {
		expect(highlight('<b>x</b>', '')).toBe('&lt;b&gt;x&lt;/b&gt;');
	});

	it('never returns a raw opening tag from any registered grammar', () => {
		const probe = '<img src=x onerror="alert(1)">';
		for (const language of new Set(Object.values(SNIPPET_LANGUAGES))) {
			expect(highlight(probe, language)).not.toContain('<img');
		}
	});
});

describe('highlightSnippet', () => {
	it('maps every form the badge page emits to a grammar', () => {
		// Both badges' snippet ids. A form added to the page without an entry
		// here renders as plain escaped text rather than throwing, but it should
		// not happen silently either.
		expect(Object.keys(SNIPPET_LANGUAGES).sort()).toEqual(
			[
				'html',
				'lh-html',
				'lh-markdown',
				'markdown',
				'react',
				'svelte',
				'vue',
				'webComponent'
			].sort()
		);
	});

	it('reads Svelte and Vue as xml, and React as javascript', () => {
		expect(SNIPPET_LANGUAGES.svelte).toBe('xml');
		expect(SNIPPET_LANGUAGES.vue).toBe('xml');
		expect(SNIPPET_LANGUAGES.react).toBe('javascript');
	});

	it('does not treat an inherited property as a language', () => {
		// SNIPPET_LANGUAGES['toString'] is a function; handing that to the
		// highlighter as a language name is not a production discovery.
		for (const probe of ['toString', 'constructor', '__proto__']) {
			expect(highlightSnippet('<b>x</b>', probe)).toBe('&lt;b&gt;x&lt;/b&gt;');
		}
	});

	it('highlights the web component snippet without reopening its comment', () => {
		const out = highlightSnippet(
			'<!-- One line. -->\n<nebulakit-badge></nebulakit-badge>',
			'webComponent'
		);
		expect(out).not.toContain('-->');
		expect(out).toContain('--&gt;');
	});
});
