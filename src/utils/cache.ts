import NodeCache from 'node-cache';
import { env } from '../config/env.js';
import { logger } from './logger.js';

class CacheService {
  private cache: NodeCache;

  constructor() {
    this.cache = new NodeCache({
      stdTTL: env.CACHE_TTL_FORECAST,
      checkperiod: 120,
      useClones: false
    });

    this.cache.on('expired', (key) => {
      logger.debug(`Cache key expired: ${key}`);
    });
  }

  get<T>(key: string): T | undefined {
    const value = this.cache.get<T>(key);
    if (value !== undefined) {
      logger.debug(`Cache HIT for key: ${key}`);
    } else {
      logger.debug(`Cache MISS for key: ${key}`);
    }
    return value;
  }

  set<T>(key: string, value: T, ttlSeconds?: number): boolean {
    if (ttlSeconds !== undefined) {
      return this.cache.set(key, value, ttlSeconds);
    }
    return this.cache.set(key, value);
  }

  del(key: string): number {
    return this.cache.del(key);
  }

  flush(): void {
    this.cache.flushAll();
    logger.info('Cache flushed');
  }
}

export const cache = new CacheService();
