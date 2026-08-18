import { describe, it, expect } from 'vitest';
import { parseLayout, type LayoutRules } from './board-layout';
import type { BoardWidget } from '$lib/widgets/types';

const fallback: BoardWidget[] = [{ id: 'a', type: 'notes', group: 'left', order: 0 }];
const rules: LayoutRules = { groups: ['left', 'right'], types: ['notes', 'clock'], fallback };

const stored = (widgets: unknown) => JSON.stringify(widgets);

describe('parseLayout', () => {
	it('falls back when nothing has been stored yet', () => {
		expect(parseLayout(null, rules)).toBe(fallback);
	});

	it('falls back on unreadable JSON rather than throwing', () => {
		expect(parseLayout('{not json', rules)).toBe(fallback);
	});

	it('falls back when the stored value is not a list', () => {
		expect(parseLayout(stored({ id: 'a' }), rules)).toBe(fallback);
	});

	it('returns a stored layout that still makes sense', () => {
		const saved = [
			{ id: 'a', type: 'notes', group: 'right', order: 0 },
			{ id: 'b', type: 'clock', group: 'right', order: 1 }
		];

		expect(parseLayout(stored(saved), rules)).toEqual(saved);
	});

	it('drops a widget whose type is no longer registered', () => {
		const saved = [
			{ id: 'a', type: 'notes', group: 'left', order: 0 },
			{ id: 'gone', type: 'crypto', group: 'left', order: 1 }
		];

		expect(parseLayout(stored(saved), rules).map((w) => w.id)).toEqual(['a']);
	});

	it('drops a widget stranded in a column that no longer exists', () => {
		const saved = [
			{ id: 'a', type: 'notes', group: 'left', order: 0 },
			{ id: 'orphan', type: 'notes', group: 'deleted-column', order: 1 }
		];

		expect(parseLayout(stored(saved), rules).map((w) => w.id)).toEqual(['a']);
	});

	it('drops entries that are the wrong shape entirely', () => {
		const saved = [
			null,
			'nope',
			{ id: '', type: 'notes', group: 'left', order: 0 },
			{ id: 'no-order', type: 'notes', group: 'left' },
			{ id: 'nan-order', type: 'notes', group: 'left', order: Number.NaN },
			{ id: 'keeper', type: 'notes', group: 'left', order: 3 }
		];

		expect(parseLayout(stored(saved), rules).map((w) => w.id)).toEqual(['keeper']);
	});

	it('keeps only the first of two widgets sharing an id', () => {
		const saved = [
			{ id: 'twin', type: 'notes', group: 'left', order: 0, title: 'first' },
			{ id: 'twin', type: 'clock', group: 'left', order: 1, title: 'second' }
		];

		const layout = parseLayout(stored(saved), rules);

		expect(layout).toHaveLength(1);
		expect(layout[0].title).toBe('first');
	});

	it('closes the gaps left by anything it dropped', () => {
		const saved = [
			{ id: 'gone', type: 'crypto', group: 'left', order: 0 },
			{ id: 'a', type: 'notes', group: 'left', order: 1 },
			{ id: 'b', type: 'clock', group: 'left', order: 2 }
		];

		expect(parseLayout(stored(saved), rules).map((w) => w.order)).toEqual([0, 1]);
	});

	it('falls back when every stored widget has gone stale', () => {
		const saved = [{ id: 'gone', type: 'crypto', group: 'nowhere', order: 0 }];

		expect(parseLayout(stored(saved), rules)).toBe(fallback);
	});
});
