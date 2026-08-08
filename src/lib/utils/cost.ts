/**
 * Cost Calculation Utility
 * Calculates costs for OpenAI API usage (text and voice)
 */

// OpenAI pricing per 1M tokens (as of Dec 2024)
// Source: https://openai.com/pricing
export const MODEL_PRICING: Record<
	string,
	{
		inputPer1M: number;
		outputPer1M: number;
		type: 'text' | 'voice';
		displayName: string;
	}
> = {
	// GPT-4o models
	'gpt-4o': {
		inputPer1M: 2.5,
		outputPer1M: 10.0,
		type: 'text',
		displayName: 'GPT-4o'
	},
	'gpt-4o-2024-11-20': {
		inputPer1M: 2.5,
		outputPer1M: 10.0,
		type: 'text',
		displayName: 'GPT-4o'
	},
	'gpt-4o-2024-08-06': {
		inputPer1M: 2.5,
		outputPer1M: 10.0,
		type: 'text',
		displayName: 'GPT-4o'
	},
	// GPT-4o mini
	'gpt-4o-mini': {
		inputPer1M: 0.15,
		outputPer1M: 0.6,
		type: 'text',
		displayName: 'GPT-4o mini'
	},
	'gpt-4o-mini-2024-07-18': {
		inputPer1M: 0.15,
		outputPer1M: 0.6,
		type: 'text',
		displayName: 'GPT-4o mini'
	},
	// GPT-4 Turbo
	'gpt-4-turbo': {
		inputPer1M: 10.0,
		outputPer1M: 30.0,
		type: 'text',
		displayName: 'GPT-4 Turbo'
	},
	'gpt-4-turbo-2024-04-09': {
		inputPer1M: 10.0,
		outputPer1M: 30.0,
		type: 'text',
		displayName: 'GPT-4 Turbo'
	},
	// GPT-4
	'gpt-4': {
		inputPer1M: 30.0,
		outputPer1M: 60.0,
		type: 'text',
		displayName: 'GPT-4'
	},
	// GPT-3.5 Turbo
	'gpt-3.5-turbo': {
		inputPer1M: 0.5,
		outputPer1M: 1.5,
		type: 'text',
		displayName: 'GPT-3.5 Turbo'
	},
	'gpt-3.5-turbo-0125': {
		inputPer1M: 0.5,
		outputPer1M: 1.5,
		type: 'text',
		displayName: 'GPT-3.5 Turbo'
	},
	// Realtime API (voice) - pricing per 1M tokens
	'gpt-4o-realtime-preview': {
		inputPer1M: 5.0, // Audio input: $100/1M tokens, but ~20 tokens/sec audio
		outputPer1M: 20.0, // Audio output: $200/1M tokens
		type: 'voice',
		displayName: 'GPT-4o Realtime'
	},
	'gpt-4o-realtime-preview-2024-10-01': {
		inputPer1M: 5.0,
		outputPer1M: 20.0,
		type: 'voice',
		displayName: 'GPT-4o Realtime'
	},
	'gpt-4o-realtime-preview-2024-12-17': {
		inputPer1M: 5.0,
		outputPer1M: 20.0,
		type: 'voice',
		displayName: 'GPT-4o Realtime'
	}
};

// Default pricing for unknown models (use gpt-4o pricing as fallback)
const DEFAULT_PRICING = {
	inputPer1M: 2.5,
	outputPer1M: 10.0,
	type: 'text' as const,
	displayName: 'Unknown Model'
};

export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

export interface CostResult {
	inputCost: number;
	outputCost: number;
	totalCost: number;
	model: string;
	displayName: string;
	usage: TokenUsage;
}

/**
 * Calculate the cost for a given model and token usage
 */
export function calculateCost(
	model: string,
	inputTokens: number,
	outputTokens: number
): CostResult {
	const pricing = MODEL_PRICING[model] || DEFAULT_PRICING;

	const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
	const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
	const totalCost = inputCost + outputCost;

	return {
		inputCost,
		outputCost,
		totalCost,
		model,
		displayName: pricing.displayName,
		usage: {
			inputTokens,
			outputTokens,
			totalTokens: inputTokens + outputTokens
		}
	};
}

/**
 * Format cost for display (e.g., "$0.0012" or "<$0.0001")
 */
export function formatCost(cost: number): string {
	if (cost === 0) {
		return '$0.00';
	}
	if (cost < 0.0001) {
		return '<$0.0001';
	}
	if (cost < 0.01) {
		return `$${cost.toFixed(4)}`;
	}
	return `$${cost.toFixed(2)}`;
}

/**
 * Format cost with full details for tooltip
 */
export function formatCostDetails(result: CostResult): string {
	const lines = [
		`Model: ${result.displayName}`,
		`Input: ${result.usage.inputTokens.toLocaleString()} tokens (${formatCost(result.inputCost)})`,
		`Output: ${result.usage.outputTokens.toLocaleString()} tokens (${formatCost(result.outputCost)})`,
		`Total: ${result.usage.totalTokens.toLocaleString()} tokens (${formatCost(result.totalCost)})`
	];
	return lines.join('\n');
}

/**
 * Estimate tokens from text (rough approximation: ~4 chars per token for English)
 * This is only used when actual token count is not available
 */
export function estimateTokens(text: string): number {
	// OpenAI generally uses ~4 characters per token for English text
	// This is a rough estimate; actual tokenization varies
	return Math.ceil(text.length / 4);
}

/**
 * Get model display name
 */
export function getModelDisplayName(model: string): string {
	return MODEL_PRICING[model]?.displayName || model;
}

/**
 * Check if a model is a voice/realtime model
 */
export function isVoiceModel(model: string): boolean {
	return MODEL_PRICING[model]?.type === 'voice';
}

/**
 * Calculate voice session cost based on audio duration
 * Realtime API pricing: ~$5/hour for audio input, ~$20/hour for audio output
 * Approximation: 1 second of audio ≈ 50 tokens
 */
export function calculateVoiceCost(
	model: string,
	inputDurationSeconds: number,
	outputDurationSeconds: number
): CostResult {
	// Approximate tokens from audio duration
	// OpenAI Realtime: roughly 50 tokens per second of audio
	const TOKENS_PER_SECOND = 50;

	const inputTokens = Math.ceil(inputDurationSeconds * TOKENS_PER_SECOND);
	const outputTokens = Math.ceil(outputDurationSeconds * TOKENS_PER_SECOND);

	return calculateCost(model, inputTokens, outputTokens);
}
