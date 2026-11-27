import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const pageStore = vi.hoisted(() => {
	let value = { url: new URL('https://nebulakit.pages.dev/shop/mug') };
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

describe('shop structured data', () => {
	it('describes a product page as an ItemPage with a Product and one Offer', async () => {
		setPath('/shop/mug');
		const Page = (await import('../../src/routes/shop/[slug]/+page.svelte')).default;
		render(Page, {
			props: {
				data: {
					product: {
						id: 'p1',
						slug: 'mug',
						name: 'Mug',
						description: 'A mug.',
						price: '$12.50',
						priceCents: 1250,
						currency: 'usd',
						imageUrl: null,
						physical: true
					}
				} as never
			}
		});
		const nodes = graph();
		const product = nodes.find((n) => n['@type'] === 'Product');
		expect(product?.name).toBe('Mug');
		expect(JSON.stringify(product)).toContain('12.50');
		expect(nodes.some((n) => n['@type'] === 'ItemPage')).toBe(true);
		const crumbs = nodes.find((n) => n['@type'] === 'BreadcrumbList');
		expect(JSON.stringify(crumbs)).toContain('/shop/mug');
	});

	it('describes the shop as a CollectionPage listing its products', async () => {
		setPath('/shop');
		const Page = (await import('../../src/routes/shop/+page.svelte')).default;
		render(Page, {
			props: {
				data: {
					products: [
						{ slug: 'mug', name: 'Mug', description: '', price: '$12.50', imageUrl: null },
						{ slug: 'tee', name: 'Tee', description: '', price: '$20.00', imageUrl: null }
					]
				} as never
			}
		});
		const nodes = graph();
		expect(nodes.some((n) => n['@type'] === 'CollectionPage')).toBe(true);
		const list = nodes.find((n) => n['@type'] === 'ItemList');
		expect(JSON.stringify(list)).toContain('/shop/mug');
		expect(JSON.stringify(list)).toContain('/shop/tee');
	});
});
