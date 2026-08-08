import { describe, expect, it } from 'vitest';
import {
	calculateCost,
	calculateVoiceCost,
	estimateTokens,
	formatCost,
	formatCostDetails,
	getModelDisplayName,
	isVoiceModel,
	MODEL_PRICING
} from '../../src/lib/utils/cost';

describe('Cost Calculation Utility', () => {
	describe('MODEL_PRICING', () => {
		it('should have pricing for common OpenAI models', () => {
			expect(MODEL_PRICING['gpt-4o']).toBeDefined();
			expect(MODEL_PRICING['gpt-4o-mini']).toBeDefined();
			expect(MODEL_PRICING['gpt-4-turbo']).toBeDefined();
			expect(MODEL_PRICING['gpt-3.5-turbo']).toBeDefined();
		});

		it('should have pricing for realtime voice models', () => {
			expect(MODEL_PRICING['gpt-4o-realtime-preview']).toBeDefined();
			expect(MODEL_PRICING['gpt-4o-realtime-preview-2024-12-17']).toBeDefined();
		});

		it('should have correct type for voice models', () => {
			expect(MODEL_PRICING['gpt-4o-realtime-preview'].type).toBe('voice');
			expect(MODEL_PRICING['gpt-4o'].type).toBe('text');
		});
	});

	describe('calculateCost', () => {
		it('should calculate cost for gpt-4o model', () => {
			// gpt-4o: $2.50 input, $10 output per 1M tokens
			const result = calculateCost('gpt-4o', 1000, 500);

			expect(result.model).toBe('gpt-4o');
			expect(result.displayName).toBe('GPT-4o');
			expect(result.usage.inputTokens).toBe(1000);
			expect(result.usage.outputTokens).toBe(500);
			expect(result.usage.totalTokens).toBe(1500);

			// Input: 1000/1M * $2.50 = $0.0025
			// Output: 500/1M * $10 = $0.005
			// Total: $0.0075
			expect(result.inputCost).toBeCloseTo(0.0025, 6);
			expect(result.outputCost).toBeCloseTo(0.005, 6);
			expect(result.totalCost).toBeCloseTo(0.0075, 6);
		});

		it('should calculate cost for gpt-4o-mini model', () => {
			// gpt-4o-mini: $0.15 input, $0.60 output per 1M tokens
			const result = calculateCost('gpt-4o-mini', 10000, 5000);

			expect(result.displayName).toBe('GPT-4o mini');
			// Input: 10000/1M * $0.15 = $0.0015
			// Output: 5000/1M * $0.60 = $0.003
			expect(result.inputCost).toBeCloseTo(0.0015, 6);
			expect(result.outputCost).toBeCloseTo(0.003, 6);
			expect(result.totalCost).toBeCloseTo(0.0045, 6);
		});

		it('should use default pricing for unknown models', () => {
			const result = calculateCost('unknown-model', 1000, 500);

			expect(result.model).toBe('unknown-model');
			expect(result.displayName).toBe('Unknown Model');
			// Uses gpt-4o pricing as default
			expect(result.inputCost).toBeCloseTo(0.0025, 6);
		});

		it('should handle zero tokens', () => {
			const result = calculateCost('gpt-4o', 0, 0);

			expect(result.totalCost).toBe(0);
			expect(result.usage.totalTokens).toBe(0);
		});

		it('should handle large token counts', () => {
			// 1 million tokens
			const result = calculateCost('gpt-4o', 1_000_000, 1_000_000);

			// Input: $2.50, Output: $10 = $12.50
			expect(result.inputCost).toBeCloseTo(2.5, 4);
			expect(result.outputCost).toBeCloseTo(10, 4);
			expect(result.totalCost).toBeCloseTo(12.5, 4);
		});
	});

	describe('formatCost', () => {
		it('should format zero cost', () => {
			expect(formatCost(0)).toBe('$0.00');
		});

		it('should format very small costs with <$0.0001', () => {
			expect(formatCost(0.00001)).toBe('<$0.0001');
			expect(formatCost(0.00005)).toBe('<$0.0001');
		});

		it('should format small costs with 4 decimal places', () => {
			expect(formatCost(0.0001)).toBe('$0.0001');
			expect(formatCost(0.0025)).toBe('$0.0025');
			expect(formatCost(0.0099)).toBe('$0.0099');
		});

		it('should format larger costs with 2 decimal places', () => {
			expect(formatCost(0.01)).toBe('$0.01');
			expect(formatCost(0.5)).toBe('$0.50');
			expect(formatCost(1.23)).toBe('$1.23');
			expect(formatCost(10.5)).toBe('$10.50');
		});
	});

	describe('formatCostDetails', () => {
		it('should format cost details for tooltip', () => {
			const result = calculateCost('gpt-4o', 1000, 500);
			const details = formatCostDetails(result);

			expect(details).toContain('Model: GPT-4o');
			expect(details).toContain('Input: 1,000 tokens');
			expect(details).toContain('Output: 500 tokens');
			expect(details).toContain('Total: 1,500 tokens');
		});
	});

	describe('estimateTokens', () => {
		it('should estimate tokens from text', () => {
			// ~4 chars per token
			expect(estimateTokens('Hello')).toBe(2); // 5 chars -> ceil(5/4) = 2
			expect(estimateTokens('Hello World!')).toBe(3); // 12 chars -> ceil(12/4) = 3
		});

		it('should handle empty string', () => {
			expect(estimateTokens('')).toBe(0);
		});

		it('should handle longer text', () => {
			const text = 'This is a longer text with many words.'; // 39 chars
			expect(estimateTokens(text)).toBe(10); // ceil(39/4) = 10
		});
	});

	describe('getModelDisplayName', () => {
		it('should return display name for known models', () => {
			expect(getModelDisplayName('gpt-4o')).toBe('GPT-4o');
			expect(getModelDisplayName('gpt-4o-mini')).toBe('GPT-4o mini');
			expect(getModelDisplayName('gpt-4-turbo')).toBe('GPT-4 Turbo');
		});

		it('should return model name for unknown models', () => {
			expect(getModelDisplayName('custom-model')).toBe('custom-model');
		});
	});

	describe('isVoiceModel', () => {
		it('should identify voice models', () => {
			expect(isVoiceModel('gpt-4o-realtime-preview')).toBe(true);
			expect(isVoiceModel('gpt-4o-realtime-preview-2024-12-17')).toBe(true);
		});

		it('should identify non-voice models', () => {
			expect(isVoiceModel('gpt-4o')).toBe(false);
			expect(isVoiceModel('gpt-4o-mini')).toBe(false);
		});

		it('should return false for unknown models', () => {
			expect(isVoiceModel('unknown-model')).toBe(false);
		});
	});

	describe('calculateVoiceCost', () => {
		it('should calculate voice cost based on audio duration', () => {
			// 10 seconds input, 5 seconds output
			// ~50 tokens/second
			const result = calculateVoiceCost(
				'gpt-4o-realtime-preview-2024-12-17',
				10, // 10 seconds input
				5 // 5 seconds output
			);

			expect(result.usage.inputTokens).toBe(500); // 10 * 50
			expect(result.usage.outputTokens).toBe(250); // 5 * 50
			expect(result.displayName).toBe('GPT-4o Realtime');
			expect(result.totalCost).toBeGreaterThan(0);
		});

		it('should handle zero duration', () => {
			const result = calculateVoiceCost('gpt-4o-realtime-preview', 0, 0);

			expect(result.usage.inputTokens).toBe(0);
			expect(result.usage.outputTokens).toBe(0);
			expect(result.totalCost).toBe(0);
		});

		it('should calculate realistic voice session cost', () => {
			// 60 seconds of conversation (30s user, 30s assistant)
			const result = calculateVoiceCost('gpt-4o-realtime-preview-2024-12-17', 30, 30);

			// 30 * 50 = 1500 tokens each way
			expect(result.usage.inputTokens).toBe(1500);
			expect(result.usage.outputTokens).toBe(1500);

			// Input: 1500/1M * $5 = $0.0075
			// Output: 1500/1M * $20 = $0.03
			expect(result.totalCost).toBeCloseTo(0.0375, 4);
		});
	});
});
