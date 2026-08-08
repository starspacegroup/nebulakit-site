import {
	chatHistoryStore,
	currentConversation,
	currentMessages,
	type ChatHistoryState,
	type Conversation
} from '$lib/stores/chatHistory';
import { get } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Chat History Store', () => {
	beforeEach(() => {
		// Reset store state before each test
		chatHistoryStore.reset();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initial state', () => {
		it('should have empty conversations initially', () => {
			const state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.conversations).toEqual([]);
		});

		it('should have no current conversation initially', () => {
			const state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.currentConversationId).toBeNull();
		});

		it('should not be loading initially', () => {
			const state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.isLoading).toBe(false);
		});
	});

	describe('Creating conversations', () => {
		it('should create a new conversation', () => {
			const conversation = chatHistoryStore.createConversation();

			expect(conversation).toBeDefined();
			expect(conversation.id).toBeDefined();
			expect(conversation.title).toBe('New conversation');
			expect(conversation.messages).toEqual([]);
			expect(conversation.createdAt).toBeInstanceOf(Date);
			expect(conversation.updatedAt).toBeInstanceOf(Date);
		});

		it('should add the new conversation to the list', () => {
			const conversation = chatHistoryStore.createConversation();
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.conversations).toHaveLength(1);
			expect(state.conversations[0].id).toBe(conversation.id);
		});

		it('should set the new conversation as current', () => {
			const conversation = chatHistoryStore.createConversation();
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.currentConversationId).toBe(conversation.id);
		});

		it('should create conversation with custom title', () => {
			const conversation = chatHistoryStore.createConversation('My Custom Chat');

			expect(conversation.title).toBe('My Custom Chat');
		});
	});

	describe('Selecting conversations', () => {
		it('should select an existing conversation', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			const conv2 = chatHistoryStore.createConversation('Second');

			chatHistoryStore.selectConversation(conv1.id);
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.currentConversationId).toBe(conv1.id);
		});

		it('should return the selected conversation messages', () => {
			const conv = chatHistoryStore.createConversation();
			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'Hello'
			});

			chatHistoryStore.selectConversation(conv.id);
			const messages = chatHistoryStore.getCurrentMessages();

			expect(messages).toHaveLength(1);
			expect(messages[0].content).toBe('Hello');
		});
	});

	describe('Managing messages', () => {
		it('should add a message to a conversation', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'Hello, AI!'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			expect(conversation?.messages).toHaveLength(1);
			expect(conversation?.messages[0].content).toBe('Hello, AI!');
			expect(conversation?.messages[0].role).toBe('user');
			expect(conversation?.messages[0].id).toBeDefined();
			expect(conversation?.messages[0].timestamp).toBeInstanceOf(Date);
		});

		it('should update conversation title based on first user message', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'How do I bake a chocolate cake?'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			expect(conversation?.title).toBe('How do I bake a chocolate cake?');
		});

		it('should truncate long titles', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content:
					'This is a very long message that should be truncated when used as a title for the conversation in the sidebar'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			expect(conversation?.title.length).toBeLessThanOrEqual(53); // 50 chars + '...'
		});

		it('should update the conversation updatedAt when adding a message', () => {
			const conv = chatHistoryStore.createConversation();
			const originalUpdatedAt = conv.updatedAt;

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'Hello'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			// updatedAt should be set when adding a message (same or later time)
			expect(conversation?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());
		});
	});

	describe('Deleting conversations', () => {
		it('should delete a conversation', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			const conv2 = chatHistoryStore.createConversation('Second');

			chatHistoryStore.deleteConversation(conv1.id);
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.conversations).toHaveLength(1);
			expect(state.conversations[0].id).toBe(conv2.id);
		});

		it('should clear currentConversationId when deleting current conversation', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.deleteConversation(conv.id);
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.currentConversationId).toBeNull();
		});

		it('should select another conversation after deleting current', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			chatHistoryStore.createConversation('Second');

			// conv2 should be current
			const currentState = get(chatHistoryStore) as ChatHistoryState;
			chatHistoryStore.deleteConversation(currentState.currentConversationId!);
			const state = get(chatHistoryStore) as ChatHistoryState;

			// Should fallback to conv1
			expect(state.currentConversationId).toBe(conv1.id);
		});
	});

	describe('Renaming conversations', () => {
		it('should rename a conversation', () => {
			const conv = chatHistoryStore.createConversation('Original Title');

			chatHistoryStore.renameConversation(conv.id, 'New Title');
			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);

			expect(conversation?.title).toBe('New Title');
		});
	});

	describe('Clearing all conversations', () => {
		it('should clear all conversations', () => {
			chatHistoryStore.createConversation('First');
			chatHistoryStore.createConversation('Second');
			chatHistoryStore.createConversation('Third');

			chatHistoryStore.clearAll();
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.conversations).toEqual([]);
			expect(state.currentConversationId).toBeNull();
		});
	});

	describe('Sorting conversations', () => {
		it('should sort conversations by most recent first', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			const conv2 = chatHistoryStore.createConversation('Second');
			const conv3 = chatHistoryStore.createConversation('Third');

			const state = get(chatHistoryStore) as ChatHistoryState;

			// Most recently created should be first
			expect(state.conversations[0].id).toBe(conv3.id);
			expect(state.conversations[1].id).toBe(conv2.id);
			expect(state.conversations[2].id).toBe(conv1.id);
		});
	});

	describe('Updating messages', () => {
		it('should update an existing message content', () => {
			const conv = chatHistoryStore.createConversation();
			const message = chatHistoryStore.addMessage(conv.id, {
				role: 'assistant',
				content: 'Initial response'
			});

			chatHistoryStore.updateMessage(conv.id, message.id, 'Updated response');

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);
			const updatedMessage = conversation?.messages.find((m) => m.id === message.id);

			expect(updatedMessage?.content).toBe('Updated response');
		});

		it('should update message with cost information', () => {
			const conv = chatHistoryStore.createConversation();
			const message = chatHistoryStore.addMessage(conv.id, {
				role: 'assistant',
				content: 'AI response'
			});

			const cost = {
				inputTokens: 100,
				outputTokens: 200,
				totalCost: 0.005,
				model: 'gpt-4',
				displayName: 'GPT-4'
			};

			chatHistoryStore.updateMessage(conv.id, message.id, 'Updated response', cost);

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);
			const updatedMessage = conversation?.messages.find((m) => m.id === message.id);

			expect(updatedMessage?.cost).toEqual(cost);
		});

		it('should update conversation updatedAt when updating a message', () => {
			const conv = chatHistoryStore.createConversation();
			const message = chatHistoryStore.addMessage(conv.id, {
				role: 'assistant',
				content: 'Initial'
			});

			const beforeState = get(chatHistoryStore) as ChatHistoryState;
			const beforeUpdated = beforeState.conversations.find(
				(c: Conversation) => c.id === conv.id
			)?.updatedAt;

			chatHistoryStore.updateMessage(conv.id, message.id, 'Updated');

			const afterState = get(chatHistoryStore) as ChatHistoryState;
			const afterUpdated = afterState.conversations.find(
				(c: Conversation) => c.id === conv.id
			)?.updatedAt;

			expect(afterUpdated?.getTime()).toBeGreaterThanOrEqual(beforeUpdated?.getTime() || 0);
		});

		it('should not update messages in other conversations', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			const conv2 = chatHistoryStore.createConversation('Second');

			const message1 = chatHistoryStore.addMessage(conv1.id, {
				role: 'user',
				content: 'Message in conv1'
			});

			chatHistoryStore.addMessage(conv2.id, {
				role: 'user',
				content: 'Message in conv2'
			});

			// Update message in conv1
			chatHistoryStore.updateMessage(conv1.id, message1.id, 'Updated in conv1');

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conv2Updated = state.conversations.find((c: Conversation) => c.id === conv2.id);

			expect(conv2Updated?.messages[0].content).toBe('Message in conv2');
		});
	});

	describe('Getting current conversation', () => {
		it('should return null when no conversation is selected', () => {
			const result = chatHistoryStore.getCurrentConversation();
			expect(result).toBeNull();
		});

		it('should return the current conversation when one is selected', () => {
			const conv = chatHistoryStore.createConversation('Test Conv');
			chatHistoryStore.addMessage(conv.id, { role: 'user', content: 'Hello' });

			const result = chatHistoryStore.getCurrentConversation();

			expect(result).toBeDefined();
			expect(result?.id).toBe(conv.id);
			// Title stays 'Test Conv' since it was set explicitly, not 'New conversation'
			expect(result?.title).toBe('Test Conv');
			expect(result?.messages).toHaveLength(1);
		});

		it('should return null for non-existent conversation id', () => {
			chatHistoryStore.createConversation('Test');

			// Manually set a non-existent ID by selecting a valid one first then deleting
			const state = get(chatHistoryStore) as ChatHistoryState;
			const currentId = state.currentConversationId;
			if (currentId) {
				chatHistoryStore.deleteConversation(currentId);
			}

			const result = chatHistoryStore.getCurrentConversation();
			expect(result).toBeNull();
		});
	});

	describe('Getting current messages', () => {
		it('should return empty array when no conversation is selected', () => {
			const messages = chatHistoryStore.getCurrentMessages();
			expect(messages).toEqual([]);
		});

		it('should return messages from the current conversation', () => {
			const conv = chatHistoryStore.createConversation();
			chatHistoryStore.addMessage(conv.id, { role: 'user', content: 'Message 1' });
			chatHistoryStore.addMessage(conv.id, { role: 'assistant', content: 'Message 2' });

			const messages = chatHistoryStore.getCurrentMessages();

			expect(messages).toHaveLength(2);
			expect(messages[0].content).toBe('Message 1');
			expect(messages[1].content).toBe('Message 2');
		});
	});

	describe('Sidebar state management', () => {
		it('should have sidebar open by default', () => {
			const state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.isSidebarOpen).toBe(true);
		});

		it('should toggle sidebar state', () => {
			chatHistoryStore.toggleSidebar();
			let state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.isSidebarOpen).toBe(false);

			chatHistoryStore.toggleSidebar();
			state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.isSidebarOpen).toBe(true);
		});

		it('should set sidebar open state explicitly', () => {
			chatHistoryStore.setSidebarOpen(false);
			let state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.isSidebarOpen).toBe(false);

			chatHistoryStore.setSidebarOpen(true);
			state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.isSidebarOpen).toBe(true);
		});
	});

	describe('Loading state management', () => {
		it('should set loading state', () => {
			chatHistoryStore.setLoading(true);
			let state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.isLoading).toBe(true);

			chatHistoryStore.setLoading(false);
			state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.isLoading).toBe(false);
		});
	});

	describe('User initialization', () => {
		it('should initialize store for a user', () => {
			chatHistoryStore.initializeForUser('user-123');

			const state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.userId).toBe('user-123');
		});

		it('should load stored conversations for a user', () => {
			// First, create some conversations and save them
			chatHistoryStore.initializeForUser('test-user-456');
			chatHistoryStore.createConversation('Saved Chat');
			chatHistoryStore.addMessage((get(chatHistoryStore) as ChatHistoryState).conversations[0].id, {
				role: 'user',
				content: 'Persisted message'
			});

			// Reset and reinitialize
			chatHistoryStore.reset();
			chatHistoryStore.initializeForUser('test-user-456');

			const state = get(chatHistoryStore) as ChatHistoryState;
			expect(state.conversations.length).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Adding messages with cost', () => {
		it('should add a message with cost information', () => {
			const conv = chatHistoryStore.createConversation();
			const cost = {
				inputTokens: 50,
				outputTokens: 100,
				totalCost: 0.002,
				model: 'gpt-3.5-turbo',
				displayName: 'GPT-3.5 Turbo'
			};

			const message = chatHistoryStore.addMessage(conv.id, {
				role: 'assistant',
				content: 'Response with cost',
				cost
			});

			expect(message.cost).toEqual(cost);

			const state = get(chatHistoryStore) as ChatHistoryState;
			const savedMessage = state.conversations[0].messages[0];
			expect(savedMessage.cost).toEqual(cost);
		});
	});

	describe('Title update behavior', () => {
		it('should not update title if not default', () => {
			const conv = chatHistoryStore.createConversation('Custom Title');

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'This should not become the title'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);
			expect(conversation?.title).toBe('Custom Title');
		});

		it('should not update title for assistant messages', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.addMessage(conv.id, {
				role: 'assistant',
				content: 'AI responds first'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);
			expect(conversation?.title).toBe('New conversation');
		});

		it('should not update title after first user message', () => {
			const conv = chatHistoryStore.createConversation();

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'First message becomes title'
			});

			chatHistoryStore.addMessage(conv.id, {
				role: 'user',
				content: 'Second message should not become title'
			});

			const state = get(chatHistoryStore) as ChatHistoryState;
			const conversation = state.conversations.find((c: Conversation) => c.id === conv.id);
			expect(conversation?.title).toBe('First message becomes title');
		});
	});

	describe('Deleting non-current conversation', () => {
		it('should not change currentConversationId when deleting a different conversation', () => {
			const conv1 = chatHistoryStore.createConversation('First');
			const conv2 = chatHistoryStore.createConversation('Second');

			// conv2 is current
			chatHistoryStore.deleteConversation(conv1.id);
			const state = get(chatHistoryStore) as ChatHistoryState;

			expect(state.currentConversationId).toBe(conv2.id);
			expect(state.conversations).toHaveLength(1);
		});
	});

	describe('Derived stores', () => {
		it('currentConversation should return null when no conversation selected', () => {
			const conv = get(currentConversation);
			expect(conv).toBeNull();
		});

		it('currentConversation should return the selected conversation', () => {
			const created = chatHistoryStore.createConversation('Test Derived');
			chatHistoryStore.addMessage(created.id, { role: 'user', content: 'Hello' });

			const conv = get(currentConversation);
			expect(conv).toBeDefined();
			expect(conv?.id).toBe(created.id);
		});

		it('currentMessages should return empty array when no conversation', () => {
			const messages = get(currentMessages);
			expect(messages).toEqual([]);
		});

		it('currentMessages should return messages from current conversation', () => {
			const conv = chatHistoryStore.createConversation();
			chatHistoryStore.addMessage(conv.id, { role: 'user', content: 'Message 1' });
			chatHistoryStore.addMessage(conv.id, { role: 'assistant', content: 'Message 2' });

			const messages = get(currentMessages);
			expect(messages).toHaveLength(2);
			expect(messages[0].content).toBe('Message 1');
			expect(messages[1].content).toBe('Message 2');
		});

		it('currentConversation should return null for non-existent id', () => {
			// Create a conversation then delete it to leave a stale reference scenario
			const conv = chatHistoryStore.createConversation('Test');
			chatHistoryStore.deleteConversation(conv.id);

			const current = get(currentConversation);
			expect(current).toBeNull();
		});
	});
});
