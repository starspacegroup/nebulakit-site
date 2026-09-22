/**
 * Syntax highlighting for the snippets `/badge` hands out.
 *
 * Those snippets are built reactively from the variant, the ground and the
 * origin the page is being served from, so there is nothing to highlight at
 * build time — this runs on the server render and again in the browser, and
 * both have to agree or the hydration is a mismatch. The server render is a
 * Cloudflare Worker, which is the constraint that decided the library.
 *
 * **highlight.js, registered explicitly, because the alternative does not
 * survive contact with a Worker.** This is carried over from the same page on
 * starspace.group, where Prism was tried first and took `/badge` down in
 * production: Prism's language files are not modules — each reads a *global*
 * `Prism` that the core assigns to `window`. A Worker has no `window`, and the
 * bundler hoists those initialisers above any assignment of our own, so the
 * first grammar to load threw `ReferenceError: Prism is not defined` and the
 * page 500'd. highlight.js has no globals: `registerLanguage` is a function
 * call on an imported object, and only the grammars this page can actually
 * produce are registered, so the page does not ship a general-purpose
 * highlighter it never uses.
 *
 * A unit test cannot catch that class of bug — node has no `window` either, but
 * it has the CommonJS interop that makes the global appear anyway. The check
 * that matters is a render under `wrangler pages dev`, which is a real Workers
 * runtime.
 *
 * The output is `{@html}`'d. highlight.js escapes what it tokenizes, and this
 * module escapes the string itself for a language it does not know rather than
 * passing it through — there is no path here that returns unescaped input.
 */

import hljs from 'highlight.js/lib/core';
import css from 'highlight.js/lib/languages/css';
import javascript from 'highlight.js/lib/languages/javascript';
import markdown from 'highlight.js/lib/languages/markdown';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('css', css);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('xml', xml);

/**
 * The forms `/badge` emits, mapped to the grammar that reads each one.
 *
 * Svelte and Vue are both `xml`: each is HTML with a `<script>` and a `<style>`
 * in it, and the xml grammar already hands those to javascript and css. React
 * is `javascript`, which covers the JSX. The `lh-` pair are the Lighthouse
 * badge's two snippets, which are the same two languages under different ids.
 */
export const SNIPPET_LANGUAGES = {
	markdown: 'markdown',
	html: 'xml',
	webComponent: 'xml',
	react: 'javascript',
	svelte: 'xml',
	vue: 'xml',
	'lh-markdown': 'markdown',
	'lh-html': 'xml'
} as const;

export type SnippetId = keyof typeof SNIPPET_LANGUAGES;

/** Entity-escape a string for dropping into HTML. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Highlight `code` as `language`, returning HTML safe to inject.
 *
 * An unregistered language, or a grammar that throws, gives back the escaped
 * source. A snippet somebody can read in one colour beats an error, and beats
 * a blank panel where their copy button used to be.
 */
export function highlight(code: string, language: string): string {
	if (!language || !hljs.getLanguage(language)) return escapeHtml(code);

	try {
		return hljs.highlight(code, { language }).value;
	} catch {
		return escapeHtml(code);
	}
}

/**
 * Highlight one of the badge page's snippets, by the id the page calls it.
 *
 * `hasOwnProperty`, not a bare index: `SNIPPET_LANGUAGES['toString']` is a
 * function, and passing that as a language name is not something to find out
 * about in production. An id nobody registered falls through to escaped text.
 */
export function highlightSnippet(code: string, id: SnippetId | string): string {
	const known = Object.prototype.hasOwnProperty.call(SNIPPET_LANGUAGES, id);
	return highlight(code, known ? SNIPPET_LANGUAGES[id as SnippetId] : '');
}
