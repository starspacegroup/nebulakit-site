/**
 * Reading a saved board layout back in.
 *
 * Anything that has been through storage is untrusted input: it may predate a
 * column rename, reference a widget type that has since been removed, or have
 * been edited by hand in devtools. A layout that half-loads is worse than one
 * that falls back, because the missing widget looks like data loss.
 *
 * So: validate every entry, drop the ones that no longer make sense, and give
 * up entirely — back to the supplied default — if nothing usable is left.
 */

import { normalize } from './reorder';
import type { BoardWidget } from '$lib/widgets/types';

export interface LayoutRules {
	/** Column ids that currently exist. */
	groups: readonly string[];
	/** Registered widget type names. */
	types: readonly string[];
	/** Used when the stored layout is missing, unreadable, or entirely stale. */
	fallback: BoardWidget[];
}

function isUsable(entry: unknown, rules: LayoutRules): entry is BoardWidget {
	if (typeof entry !== 'object' || entry === null) return false;
	const widget = entry as Record<string, unknown>;
	return (
		typeof widget.id === 'string' &&
		widget.id.length > 0 &&
		typeof widget.type === 'string' &&
		rules.types.includes(widget.type) &&
		typeof widget.group === 'string' &&
		rules.groups.includes(widget.group) &&
		typeof widget.order === 'number' &&
		Number.isFinite(widget.order)
	);
}

/** Parse stored JSON into a layout, or return the fallback. */
export function parseLayout(raw: string | null, rules: LayoutRules): BoardWidget[] {
	if (!raw) return rules.fallback;

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return rules.fallback;
	}
	if (!Array.isArray(parsed)) return rules.fallback;

	const seen = new Set<string>();
	const widgets = parsed.filter((entry): entry is BoardWidget => {
		if (!isUsable(entry, rules)) return false;
		// A duplicate id would make two widgets share one drag identity.
		if (seen.has(entry.id)) return false;
		seen.add(entry.id);
		return true;
	});

	if (widgets.length === 0) return rules.fallback;
	// Dropping entries leaves gaps in the numbering; close them before rendering.
	return normalize(widgets);
}
