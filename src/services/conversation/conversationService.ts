import crypto from 'crypto';
import { logger } from '../../utils/logger.js';

export interface ConversationContext {
  id: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  language?: string;
  lastQuestion?: string;
  lastAnswer?: string;
  lastWeatherData?: any;  // cached weather data from last query
  turnCount: number;
  createdAt: number;      // timestamp ms
  updatedAt: number;      // timestamp ms
}

export class ConversationService {
  private store = new Map<string, ConversationContext>();
  private ttlMs = 30 * 60 * 1000; // 30 minutes

  constructor() {
    setInterval(() => this.cleanupExpired(), 5 * 60 * 1000).unref();
  }

  createConversation(): ConversationContext {
    const id = crypto.randomUUID();
    const now = Date.now();
    const ctx: ConversationContext = {
      id,
      turnCount: 0,
      createdAt: now,
      updatedAt: now
    };
    this.store.set(id, ctx);
    return ctx;
  }

  getConversation(id: string): ConversationContext | undefined {
    return this.store.get(id);
  }

  updateConversation(id: string, updates: Partial<ConversationContext>): ConversationContext | undefined {
    const ctx = this.store.get(id);
    if (!ctx) return undefined;
    const updated = { ...ctx, ...updates, updatedAt: Date.now() };
    this.store.set(id, updated);
    return updated;
  }

  deleteConversation(id: string): boolean {
    return this.store.delete(id);
  }

  cleanupExpired(): number {
    let count = 0;
    const now = Date.now();
    for (const [id, ctx] of this.store.entries()) {
      if (now - ctx.updatedAt > this.ttlMs) {
        this.store.delete(id);
        count++;
      }
    }
    if (count > 0) {
      logger.info(`Cleaned up ${count} expired conversations`);
    }
    return count;
  }
}

export const conversationService = new ConversationService();
