import { describe, expect, it } from 'vitest';
import {
	blogContentType,
	contentTypeRegistry,
	getContentTypeDefinition,
	getRegisteredSlugs,
	isRegisteredContentType
} from '../../src/lib/cms/registry';

describe('CMS Registry', () => {
	describe('contentTypeRegistry', () => {
		it('should contain at least the blog content type', () => {
			expect(contentTypeRegistry.length).toBeGreaterThanOrEqual(1);
			expect(contentTypeRegistry[0].slug).toBe('blog');
		});

		it('should have valid content type definitions', () => {
			for (const ct of contentTypeRegistry) {
				expect(ct.slug).toBeTruthy();
				expect(ct.name).toBeTruthy();
				expect(ct.description).toBeTruthy();
				expect(ct.icon).toBeTruthy();
				expect(Array.isArray(ct.fields)).toBe(true);
				expect(ct.settings).toBeTruthy();
			}
		});

		it('should have unique slugs', () => {
			const slugs = contentTypeRegistry.map((ct) => ct.slug);
			const uniqueSlugs = new Set(slugs);
			expect(slugs.length).toBe(uniqueSlugs.size);
		});
	});

	describe('blogContentType', () => {
		it('should have required fields', () => {
			const requiredFields = blogContentType.fields.filter((f) => f.required);
			expect(requiredFields.length).toBeGreaterThanOrEqual(2);
			expect(requiredFields.map((f) => f.name)).toContain('excerpt');
			expect(requiredFields.map((f) => f.name)).toContain('body');
		});

		it('should have proper settings', () => {
			expect(blogContentType.settings.hasDrafts).toBe(true);
			expect(blogContentType.settings.hasTags).toBe(true);
			expect(blogContentType.settings.hasSEO).toBe(true);
			expect(blogContentType.settings.hasAuthor).toBe(true);
			expect(blogContentType.settings.routePrefix).toBe('/blog');
		});

		it('should have category options', () => {
			const categoryField = blogContentType.fields.find((f) => f.name === 'category');
			expect(categoryField).toBeTruthy();
			expect(categoryField!.type).toBe('select');
			expect(categoryField!.options!.length).toBeGreaterThan(0);
		});
	});

	describe('getContentTypeDefinition', () => {
		it('should return the blog content type', () => {
			const result = getContentTypeDefinition('blog');
			expect(result).toBeTruthy();
			expect(result!.slug).toBe('blog');
			expect(result!.name).toBe('Blog Posts');
		});

		it('should return undefined for unknown slug', () => {
			expect(getContentTypeDefinition('nonexistent')).toBeUndefined();
		});
	});

	describe('getRegisteredSlugs', () => {
		it('should return array of slugs', () => {
			const slugs = getRegisteredSlugs();
			expect(Array.isArray(slugs)).toBe(true);
			expect(slugs).toContain('blog');
		});
	});

	describe('isRegisteredContentType', () => {
		it('should return true for registered types', () => {
			expect(isRegisteredContentType('blog')).toBe(true);
		});

		it('should return false for unregistered types', () => {
			expect(isRegisteredContentType('nonexistent')).toBe(false);
		});
	});
});
