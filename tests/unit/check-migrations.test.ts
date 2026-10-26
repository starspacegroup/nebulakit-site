import { describe, expect, it } from 'vitest';
import { immutabilityProblems, namingProblems, run } from '../../scripts/check-migrations.mjs';

describe('migration names', () => {
	it('accepts the sequence and flags duplicates and bad names', () => {
		expect(namingProblems(['0001_a.sql', '0002_b_c.sql'])).toEqual([]);
		expect(namingProblems(['0001_a.sql', '0001_b.sql'])).toEqual([
			'number 0001 is used by 0001_a.sql and 0001_b.sql'
		]);
		expect(namingProblems(['0001_a.sql', '0003_c.sql'])).toEqual([
			'number 0002 is missing (gap before 0003)'
		]);
		expect(namingProblems(['0001_a.sql', '0004_d.sql', '0005_e.sql'])).toHaveLength(1);
		expect(namingProblems(['1_x.sql', '0003_Bad.sql', 'readme.sql'])).toHaveLength(3);
	});
});

describe('migration immutability', () => {
	it('flags an edited or deleted migration that is on the base', () => {
		const differs = (name: string) => name === '0002_b.sql';
		expect(
			immutabilityProblems(
				['0001_a.sql', '0002_b.sql', '0003_c.sql'],
				['0001_a.sql', '0002_b.sql'],
				differs
			)
		).toEqual([
			'0002_b.sql: already on the base branch, so it must not be edited',
			'0003_c.sql: exists on the base branch but is gone here'
		]);
		expect(
			immutabilityProblems(['0001_a.sql'], ['0001_a.sql', '0002_new.sql'], () => false)
		).toEqual([]);
	});
});

describe('this repository', () => {
	it('has a clean migrations directory', () => {
		const result = run(process.cwd(), undefined);
		expect(result.problems).toEqual([]);
		expect(result.count).toBeGreaterThan(10);
	});
});
