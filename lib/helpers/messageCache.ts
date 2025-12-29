import { Redis } from 'ioredis';
import pino from 'pino';
import { LRUCache } from 'lru-cache';
import env from '../constants/env';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

const redisClient = new Redis(env.REDIS_URL || 'redis://localhost:6379');

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('error', (err: Error) => {
  logger.error(err, 'Redis error');
});

// LRU Cache Configuration
const lruOptions = {
  max: 500, // Maximum number of items in cache
  ttl: 1000 * 60 * 60, // 1 hour TTL
};

const messageLRU = new LRUCache<string, any[]>(lruOptions);
const chatroomListLRU = new LRUCache<string, any[]>(lruOptions);

const CHATROOM_MESSAGES_PREFIX = 'chatroom_messages:';
const CHATROOM_LIST_KEY = 'chatroom_list';
const CACHE_EXPIRATION_SECONDS = 60 * 60; // 1 hour

// --- Chatroom List Caching ---

export async function cacheChatroomList(chatrooms: any[]): Promise<void> {
  try {
    // Cache in LRU
    chatroomListLRU.set(CHATROOM_LIST_KEY, chatrooms);
    
    // Cache in Redis
    await redisClient.set(CHATROOM_LIST_KEY, JSON.stringify(chatrooms), 'EX', CACHE_EXPIRATION_SECONDS);
    
    logger.debug('Cached chatroom list in LRU and Redis');
  } catch (error) {
    logger.error(`Error caching chatroom list: ${error}`);
  }
}

export async function getCachedChatroomList(): Promise<any[] | null> {
  try {
    // Try LRU first
    const lruData = chatroomListLRU.get(CHATROOM_LIST_KEY);
    if (lruData) {
      logger.debug('Retrieved chatroom list from LRU');
      return lruData;
    }

    // Try Redis
    const redisData = await redisClient.get(CHATROOM_LIST_KEY);
    if (redisData) {
      const chatrooms = JSON.parse(redisData);
      // Populate LRU for next time
      chatroomListLRU.set(CHATROOM_LIST_KEY, chatrooms);
      logger.debug('Retrieved chatroom list from Redis');
      return chatrooms;
    }

    return null;
  } catch (error) {
    logger.error(`Error retrieving cached chatroom list: ${error}`);
    return null;
  }
}

export async function invalidateChatroomList(): Promise<void> {
  try {
    chatroomListLRU.delete(CHATROOM_LIST_KEY);
    await redisClient.del(CHATROOM_LIST_KEY);
    logger.debug('Invalidated chatroom list cache');
  } catch (error) {
    logger.error(`Error invalidating chatroom list cache: ${error}`);
  }
}

// --- Message Caching ---

export async function cacheMessages(chatroomId: string, messages: any[]): Promise<void> {
  try {
    const key = `${CHATROOM_MESSAGES_PREFIX}${chatroomId}`;
    
    // Cache in LRU
    messageLRU.set(key, messages);

    // Cache in Redis
    const serializedMessages = messages.map(msg => {
      const plainMsg = msg.toObject ? msg.toObject() : msg;
      return JSON.stringify(plainMsg);
    });
    
    await redisClient.del(key);
    if (serializedMessages.length > 0) {
      await redisClient.rpush(key, ...serializedMessages);
      await redisClient.expire(key, CACHE_EXPIRATION_SECONDS);
    }
    
    logger.debug(`Cached ${messages.length} messages for chatroom ${chatroomId} in LRU and Redis`);
  } catch (error) {
    logger.error(`Error caching messages for chatroom ${chatroomId}: ${error}`);
  }
}

export async function getCachedMessages(chatroomId: string): Promise<any[]> {
  try {
    const key = `${CHATROOM_MESSAGES_PREFIX}${chatroomId}`;
    
    // Try LRU first
    const lruData = messageLRU.get(key);
    if (lruData) {
      logger.debug(`Retrieved messages from LRU for chatroom ${chatroomId}`);
      return lruData;
    }

    // Try Redis
    const serializedMessages = await redisClient.lrange(key, 0, -1);
    if (serializedMessages.length > 0) {
      const messages = serializedMessages.map((msgStr: string) => JSON.parse(msgStr));
      // Populate LRU
      messageLRU.set(key, messages);
      logger.debug(`Retrieved ${messages.length} messages from Redis for chatroom ${chatroomId}`);
      return messages;
    }

    return [];
  } catch (error) {
    logger.error(`Error retrieving messages from cache for chatroom ${chatroomId}: ${error}`);
    return [];
  }
}

export async function addMessageToCache(chatroomId: string, message: any): Promise<void> {
  try {
    const key = `${CHATROOM_MESSAGES_PREFIX}${chatroomId}`;
    const plainMsg = message.toObject ? message.toObject() : message;
    
    // Update LRU
    const currentLRU = messageLRU.get(key) || [];
    currentLRU.push(plainMsg);
    // Keep only last 50 for LRU simplicity
    if (currentLRU.length > 50) currentLRU.shift();
    messageLRU.set(key, currentLRU);

    // Update Redis
    await redisClient.rpush(key, JSON.stringify(plainMsg));
    await redisClient.expire(key, CACHE_EXPIRATION_SECONDS);
    
    logger.debug(`Added new message to cache for chatroom ${chatroomId} in LRU and Redis`);
  } catch (error) {
    logger.error(`Error adding message to cache for chatroom ${chatroomId}: ${error}`);
  }
}

export async function clearCachedMessages(chatroomId: string): Promise<void> {
  try {
    const key = `${CHATROOM_MESSAGES_PREFIX}${chatroomId}`;
    messageLRU.delete(key);
    await redisClient.del(key);
    logger.debug(`Cleared cached messages for chatroom ${chatroomId} in LRU and Redis`);
  } catch (error) {
    logger.error(`Error clearing cached messages for chatroom ${chatroomId}: ${error}`);
  }
}

export default redisClient;
