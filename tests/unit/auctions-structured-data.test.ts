import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const pageStore = vi.hoisted(() => {
	let value = { url: new URL('https://nebulakit.pages.dev/auctions') };
	const subscribers = new Set<(v: typeof value) => void>();
	return {
		subscribe(run: (v: typeof value) => void) {
			subscribers.add(run);
			run(value);
			return () => subscribers.delete(run);
		},
		set(next: typeof value) {
			value = next;
			subscribers.forEach((run) => run(value));
		}
	};
});
vi.mock('$app/stores', () => ({ page: pageStore }));
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

type Node = { '@type': string; [key: string]: unknown };

function graph(): Node[] {
	const blocks = document.head.querySelectorAll('script[type="application/ld+json"]');
	expect(blocks).toHaveLength(1);
	return JSON.parse(blocks[0].textContent ?? '')['@graph'];
}

function setPath(path: string) {
	pageStore.set({ url: new URL(`https://nebulakit.pages.dev${path}`) });
}

beforeEach(() => {
	document.head.innerHTML = '';
});

describe('auctions structured data', () => {
	it('describes the auctions list as a CollectionPage listing open auctions', async () => {
		setPath('/auctions');
		const Page = (await import('../../src/routes/auctions/+page.svelte')).default;
		render(Page, {
			props: {
				data: {
					open: [
						{ id: '1', slug: 'mug', title: 'Mug', price: '$5.00', bidCount: 0, phase: 'live' },
						{ id: '2', slug: 'tee', title: 'Tee', price: '$9.00', bidCount: 2, phase: 'live' }
					],
					sold: []
				} as never
			}
		});
		const nodes = graph();
		expect(nodes.some((n) => n['@type'] === 'CollectionPage')).toBe(true);
		const list = nodes.find((n) => n['@type'] === 'ItemList');
		expect(JSON.stringify(list)).toContain('/auctions/mug');
		expect(JSON.stringify(list)).toContain('/auctions/tee');
	});

	it('describes an auction page as an ItemPage with a breadcrumb', async () => {
		setPath('/auctions/mug');
		const Page = (await import('../../src/routes/auctions/[slug]/+page.svelte')).default;
		render(Page, {
			props: {
				data: {
					auction: {
						slug: 'mug',
						title: 'Mug',
						phase: 'live',
						price: '$5.00',
						bidCount: 0,
						startsAt: '2026-01-01T00:00:00Z',
						endsAt: '2026-01-02T00:00:00Z',
						reserve: 'none',
						extendSeconds: 0,
						minimumBid: '$5.00',
						minimumBidInput: '5.00'
					},
					description: 'A mug.',
					imageUrl: null,
					bids: [],
					signedIn: false,
					order: null
				} as never,
				form: null
			}
		});
		const nodes = graph();
		const item = nodes.find((n) => n['@type'] === 'ItemPage');
		expect(item).toBeDefined();
		expect(item?.name).toBe('Mug');
		const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList');
		expect(JSON.stringify(crumbs)).toContain('/auctions/mug');
	});
});
