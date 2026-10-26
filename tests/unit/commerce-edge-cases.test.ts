import { describe, expect, it, vi } from 'vitest';
import type { D1Database } from '@cloudflare/workers-types';
import { applyStripeEvent, getOrder } from '@nebulakit/commerce';
import { createSqliteD1 } from '../helpers/sqlite-d1';
import { seedOrder } from '../helpers/commerce-fixtures';
import { sendEmail } from '../../src/lib/server/email';
import { addToCart, setQuantity } from '../../src/lib/shop/cart';

/** Wrap a database so `before` runs just ahead of every UPDATE on orders. */
function racing(db: D1Database, before: () => Promise<void>): D1Database {
	return {
		prepare(sql: string) {
			const statement = db.prepare(sql);
			if (!/UPDATE commerce_orders/.test(sql)) return statement;
			return {
				bind: (...args: unknown[]) => ({
					run: async () => {
						await before();
						return statement.bind(...args).run();
					}
				})
			};
		}
	} as unknown as D1Database;
}

const paid = (orderId: string) => ({
	type: 'checkout.session.completed',
	data: {
		object: {
			id: 'cs_test_1',
			payment_status: 'paid',
			amount_total: 2500,
			currency: 'usd',
			metadata: { orderId }
		}
	}
});

describe('applyStripeEvent: an order that moves while the event is applied', () => {
	it('reports a cancelled order when another writer cancelled it first', async () => {
		const db = createSqliteD1();
		const id = await seedOrder(db);
		const raced = racing(db, async () => {
			await db
				.prepare("UPDATE commerce_orders SET status = 'cancelled' WHERE id = ?")
				.bind(id)
				.run();
		});
		const result = await applyStripeEvent(raced, paid(id));
		expect(result).toMatchObject({ outcome: 'ignored', reason: 'order-cancelled' });
		expect((await getOrder(db, id))?.status).toBe('cancelled');
	});

	it('reports the order as already paid when another delivery won the race', async () => {
		const db = createSqliteD1();
		const id = await seedOrder(db);
		const raced = racing(db, async () => {
			await db.prepare("UPDATE commerce_orders SET status = 'paid' WHERE id = ?").bind(id).run();
		});
		const result = await applyStripeEvent(raced, paid(id));
		expect(result).toMatchObject({ outcome: 'paid', changed: false });
	});

	it('lets an unexpected database error through rather than hiding it', async () => {
		const db = createSqliteD1();
		const id = await seedOrder(db);
		const raced = racing(db, async () => {
			throw new Error('d1 down');
		});
		await expect(applyStripeEvent(raced, paid(id))).rejects.toThrow('d1 down');
	});
});

describe('email without a related record', () => {
	it('logs a skipped send with no related type or id', async () => {
		const db = createSqliteD1();
		const result = await sendEmail(
			{ DB: db },
			{ to: 'ada@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi', template: 'notice' }
		);
		expect(result).toMatchObject({ ok: false, reason: 'not-configured' });
		const row = await db
			.prepare('SELECT related_type, related_id, status FROM email_log')
			.first<{ related_type: string | null; related_id: string | null; status: string }>();
		expect(row).toEqual({ related_type: null, related_id: null, status: 'skipped' });
	});

	it('sends and logs without a related record', async () => {
		const db = createSqliteD1();
		const fetchMock = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(JSON.stringify({ id: 're_9' }), { status: 200 }));
		const result = await sendEmail(
			{ DB: db, RESEND_API_KEY: 're_k', EMAIL_FROM: 'Shop <o@shop.test>' },
			{ to: 'ada@example.com', subject: 'Hi', html: '<p>Hi</p>', text: 'Hi', template: 'notice' }
		);
		expect(result).toMatchObject({ ok: true });
		const row = await db
			.prepare('SELECT related_type, related_id FROM email_log')
			.first<{ related_type: string | null; related_id: string | null }>();
		expect(row).toEqual({ related_type: null, related_id: null });
		fetchMock.mockRestore();
	});
});

describe('cart quantity edge cases', () => {
	const item = {
		productId: 'p1',
		slug: 'tee',
		name: 'Tee',
		unitPriceCents: 100,
		currency: 'usd',
		imageUrl: null,
		physical: true,
		quantity: 1
	};

	it('treats a non-numeric quantity as one', () => {
		expect(addToCart([], { ...item, quantity: Number.NaN })[0].quantity).toBe(1);
	});

	it('leaves other lines alone when setting one quantity', () => {
		const cart = [item, { ...item, productId: 'p2' }];
		const next = setQuantity(cart, 'p2', 3);
		expect(next.map((line) => line.quantity)).toEqual([1, 3]);
	});
});
