import { describe, expect, it } from 'vitest';
import { NO_TAX } from '@nebulakit/commerce';
import { flatShippingFromEnv, taxRuleFromEnv } from '../../src/lib/server/site-info';

describe('shop settings from the environment', () => {
	it('reads a tax rule only from a positive rate', () => {
		expect(taxRuleFromEnv({})).toBe(NO_TAX);
		expect(taxRuleFromEnv({ COMMERCE_TAX_RATE_PERCENT: 'abc' })).toBe(NO_TAX);
		expect(taxRuleFromEnv({ COMMERCE_TAX_RATE_PERCENT: '0' })).toBe(NO_TAX);
		expect(taxRuleFromEnv({ COMMERCE_TAX_RATE_PERCENT: '5.5' })).toEqual({
			enabled: true,
			ratePercent: 5.5,
			pricesIncludeTax: false
		});
		expect(
			taxRuleFromEnv({ COMMERCE_TAX_RATE_PERCENT: '20', COMMERCE_PRICES_INCLUDE_TAX: 'true' })
		).toMatchObject({ pricesIncludeTax: true });
	});

	it('accepts only a positive whole number of cents for flat shipping', () => {
		expect(flatShippingFromEnv({})).toBe(0);
		expect(flatShippingFromEnv({ COMMERCE_FLAT_SHIPPING_CENTS: '-5' })).toBe(0);
		expect(flatShippingFromEnv({ COMMERCE_FLAT_SHIPPING_CENTS: '2.5' })).toBe(0);
		expect(flatShippingFromEnv({ COMMERCE_FLAT_SHIPPING_CENTS: '499' })).toBe(499);
	});
});
