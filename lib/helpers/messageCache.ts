import { Redis } from 'ioredis';
import pino from 'pino';
import env from '../constants/env';
import type { IMessage } from '../models/message';

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

const CHATROOM_MESSAGES_PREFIX = 'chatroom_messages:';
const CACHE_EXPIRATION_SECONDS = 60 * 60; // 1 hour

export async function cacheMessages(chatroomId: string, messages: IMessage[]): Promise<void> {
  try {
    const key = `${CHATROOM_MESSAGES_PREFIX}${chatroomId}`;
    // Store messages as a JSON string in a list, or individual hashes
    // For simplicity, let's store as a list of JSON strings
    const serializedMessages = messages.map(msg => JSON.stringify(msg.toObject()));
    await redisClient.del(key); // Clear existing cache for this chatroom
    if (serializedMessages.length > 0) {
      await redisClient.rpush(key, ...serializedMessages);
      await redisClient.expire(key, CACHE_EXPIRATION_SECONDS);
    }
    logger.debug(`Cached ${messages.length} messages for chatroom ${chatroomId}`);
  } catch (error) {
    logger.error(`Error caching messages for chatroom ${chatroomId}: ${error}`);
  }
}

export async function getCachedMessages(chatroomId: string): Promise<IMessage[]> {
  try {
    const key = `${CHATROOM_MESSAGES_PREFIX}${chatroomId}`;
    const serializedMessages = await redisClient.lrange(key, 0, -1);
    logger.debug(`Retrieved ${serializedMessages.length} messages from cache for chatroom ${chatroomId}`);
    return serializedMessages.map((msgStr: string) => JSON.parse(msgStr) as IMessage);
  } catch (error) {
    logger.error(`Error retrieving messages from cache for chatroom ${chatroomId}: ${error}`);
    return [];
  }
}

export async function addMessageToCache(chatroomId: string, message: IMessage): Promise<void> {
  try {
    const key = `${CHATROOM_MESSAGES_PREFIX}${chatroomId}`;
    await redisClient.rpush(key, JSON.stringify(message.toObject()));
    await redisClient.expire(key, CACHE_EXPIRATION_SECONDS); // Reset expiration on new message
    logger.debug(`Added new message to cache for chatroom ${chatroomId}`);
  } catch (error) {
    logger.error(`Error adding message to cache for chatroom ${chatroomId}: ${error}`);
  }
}

export async function clearCachedMessages(chatroomId: string): Promise<void> {
  try {
    const key = `${CHATROOM_MESSAGES_PREFIX}${chatroomId}`;
    await redisClient.del(key);
    logger.debug(`Cleared cached messages for chatroom ${chatroomId}`);
  } catch (error) {
    logger.error(`Error clearing cached messages for chatroom ${chatroomId}: ${error}`);
  }
}

export default redisClient;
