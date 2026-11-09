import { describe, expect, it } from 'vitest';
import { GET } from '../../src/routes/showcase/+server';

describe('/showcase', () => {
	it('sends old links to /components for good', () => {
		try {
			GET({} as never);
			expect.unreachable('GET should redirect');
		} catch (thrown) {
			expect(thrown).toMatchObject({ status: 301, location: '/components' });
		}
	});
});
