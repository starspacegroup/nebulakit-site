/**
 * Direct tests for the server-side authorization and OAuth-state primitives.
 *
 * These are small, but everything that gates an admin endpoint or a login now
 * routes through them, so their branches are worth pinning individually rather
 * than only incidentally via the route tests.
 */
import { describe, expect, it, vi } from 'vitest';
import {
	isAdminUser,
	isOwnerUser,
	requireAdmin,
	requireOwner
} from '../../src/lib/server/auth-guard';

const owner = { user: { id: '1', login: 'o', email: 'o@e.com', isOwner: true, isAdmin: true } };
const admin = { user: { id: '2', login: 'a', email: 'a@e.com', isOwner: false, isAdmin: true } };
const plain = { user: { id: '3', login: 'p', email: 'p@e.com', isOwner: false, isAdmin: false } };

describe('requireAdmin', () => {
	it('accepts an owner and an admin', () => {
		expect(() => requireAdmin(owner as any)).not.toThrow();
		expect(() => requireAdmin(admin as any)).not.toThrow();
	});

	it('401s with no locals at all', () => {
		expect(() => requireAdmin(undefined)).toThrowError(expect.objectContaining({ status: 401 }));
	});

	it('401s when locals carries no user', () => {
		expect(() => requireAdmin({} as any)).toThrowError(expect.objectContaining({ status: 401 }));
	});

	it('403s an authenticated non-admin', () => {
		expect(() => requireAdmin(plain as any)).toThrowError(expect.objectContaining({ status: 403 }));
	});

	it('403s a user whose isAdmin is simply absent', () => {
		const noFlags = { user: { id: '4', login: 'n', email: 'n@e.com', isOwner: false } };
		expect(() => requireAdmin(noFlags as any)).toThrowError(
			expect.objectContaining({ status: 403 })
		);
	});
});

describe('requireOwner', () => {
	it('accepts the owner', () => {
		expect(() => requireOwner(owner as any)).not.toThrow();
	});

	it('401s with no locals and no user', () => {
		expect(() => requireOwner(undefined)).toThrowError(expect.objectContaining({ status: 401 }));
		expect(() => requireOwner({} as any)).toThrowError(expect.objectContaining({ status: 401 }));
	});

	it('403s an admin who is not the owner', () => {
		// The distinction matters: /api/reset wipes the owner identity, so admin
		// is deliberately not enough.
		expect(() => requireOwner(admin as any)).toThrowError(expect.objectContaining({ status: 403 }));
});
});

describe('superadmin tier', () => {
	// stats-guard.ts honours `isSuperAdmin` for downstream apps that add a tier
	// above owner/admin. These guards must agree, or such a user would pass the
	// stats checks while being refused by every admin API.
	const superadmin = { user: { id: '9', login: 's', email: 's@e.com', isSuperAdmin: true } };

	it('treats a superadmin as both admin and owner', () => {
		expect(() => requireAdmin(superadmin as any)).not.toThrow();
		expect(() => requireOwner(superadmin as any)).not.toThrow();
	});

	it('exposes the same policy as predicates', () => {
		expect(isAdminUser({ isSuperAdmin: true })).toBe(true);
		expect(isOwnerUser({ isSuperAdmin: true })).toBe(true);
		expect(isAdminUser({ isAdmin: true })).toBe(true);
		expect(isOwnerUser({ isAdmin: true })).toBe(false);
		expect(isAdminUser({})).toBe(false);
		expect(isOwnerUser({})).toBe(false);
	});

	it('returns false for a missing user rather than throwing', () => {
		expect(isAdminUser(null)).toBe(false);
		expect(isAdminUser(undefined)).toBe(false);
		expect(isOwnerUser(null)).toBe(false);
		expect(isOwnerUser(undefined)).toBe(false);
	});
});
