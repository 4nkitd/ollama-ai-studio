import Dexie, { Table } from 'dexie';
import { Conversation, StoredMessage, SystemPromptRecord } from './types';

export class ChatDatabase extends Dexie {
  conversations!: Table<Conversation, string>; 
  chatMessages!: Table<StoredMessage, string>; 
  systemPrompts!: Table<SystemPromptRecord, string>;

  constructor() {
    super('OllamaStudioChatDatabase');
    (this as Dexie).version(1).stores({
      conversations: 'id, title, createdAt, updatedAt, selectedModel',
      chatMessages: 'id, conversationId, timestamp, model',
    });
    // Version 2: Add systemPrompts table
    (this as Dexie).version(2).stores({
      conversations: 'id, title, createdAt, updatedAt, selectedModel',
      chatMessages: 'id, conversationId, timestamp, model',
      systemPrompts: 'id, title, prompt, createdAt, updatedAt' // Added systemPrompts table
    });
    // Version 3: Add totalTokenCount to conversations table
    (this as Dexie).version(3).stores({
      conversations: 'id, title, createdAt, updatedAt, selectedModel, totalTokenCount', // Added totalTokenCount
      chatMessages: 'id, conversationId, timestamp, model',
      systemPrompts: 'id, title, prompt, createdAt, updatedAt'
    }).upgrade(async tx => {
      // If you need to migrate existing data for totalTokenCount, do it here.
      // For new installs, it will just be part of the schema.
      // Example: return tx.table('conversations').toCollection().modify(conv => conv.totalTokenCount = 0);
      // For this upgrade, we will initialize totalTokenCount to 0 for existing conversations
      await tx.table('conversations').toCollection().modify(conv => {
        if (conv.totalTokenCount === undefined) {
          conv.totalTokenCount = 0;
        }
      });
    });
    // Version 4: Add thinkingContent to chatMessages table
    (this as Dexie).version(4).stores({
      conversations: 'id, title, createdAt, updatedAt, selectedModel, totalTokenCount',
      chatMessages: 'id, conversationId, timestamp, model', // thinkingContent added to schema but not indexed
      systemPrompts: 'id, title, prompt, createdAt, updatedAt'
    }).upgrade(async tx => {
      // Initialize thinkingContent for existing messages
      await tx.table('chatMessages').toCollection().modify(msg => {
        if (msg.thinkingContent === undefined) {
          msg.thinkingContent = '';
        }
      });
    });
  }
}

export const db = new ChatDatabase();

// Conversation Methods
export const getConversation = async (id: string): Promise<Conversation | undefined> => {
  return await db.conversations.get(id);
};

export const getAllConversations = async (): Promise<Conversation[]> => {
  return await db.conversations.orderBy('updatedAt').reverse().toArray();
};

export const getMessagesForConversation = async (conversationId: string): Promise<StoredMessage[]> => {
  const messages = await db.chatMessages.where('conversationId').equals(conversationId).sortBy('timestamp');
  return messages.map(msg => ({
    ...msg,
    timestamp: new Date(msg.timestamp) 
  }));
};

export const addConversation = async (conversation: Conversation): Promise<string> => {
  return await db.conversations.add(conversation);
};

export const updateConversation = async (id: string, changes: Partial<Omit<Conversation, 'id' | 'createdAt'>>): Promise<number> => {
  const updateData = {...changes, updatedAt: new Date()};
  return await db.conversations.update(id, updateData);
};

export const deleteConversationAndMessages = async (conversationId: string): Promise<void> => {
  await (db as Dexie).transaction('rw', db.conversations, db.chatMessages, async () => {
    await db.chatMessages.where('conversationId').equals(conversationId).delete();
    await db.conversations.delete(conversationId);
  });
};

// Message Methods
export const addMessage = async (message: StoredMessage): Promise<string> => {
  return await db.chatMessages.add({
    ...message,
    timestamp: new Date(message.timestamp)
  });
};

export const updateMessage = async (id: string, changes: Partial<Omit<StoredMessage, 'id' | 'conversationId'>>): Promise<number> => {
  const updateData = {...changes};
  if (changes.timestamp) {
    updateData.timestamp = new Date(changes.timestamp);
  }
  return await db.chatMessages.update(id, updateData);
};

// System Prompt Methods
export const addSystemPrompt = async (systemPrompt: SystemPromptRecord): Promise<string> => {
  return await db.systemPrompts.add(systemPrompt);
};

export const getAllSystemPrompts = async (): Promise<SystemPromptRecord[]> => {
  return await db.systemPrompts.orderBy('title').toArray(); // Or 'updatedAt' or 'createdAt'
};

export const getSystemPrompt = async (id: string): Promise<SystemPromptRecord | undefined> => {
  return await db.systemPrompts.get(id);
};

export const updateSystemPromptRecord = async (id: string, changes: Partial<Omit<SystemPromptRecord, 'id' | 'createdAt'>>): Promise<number> => {
  const updateData = {...changes, updatedAt: new Date()};
  return await db.systemPrompts.update(id, updateData);
};

export const deleteSystemPromptRecord = async (id: string): Promise<void> => {
  return await db.systemPrompts.delete(id);
};