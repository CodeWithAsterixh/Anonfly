import redisClient from './messageCache';
import pino from 'pino';
import env from '../constants/env';

const logger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport: env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: { colorize: true }
  } : undefined
});

// Challenge store: AID -> nonce (expires in 5 minutes)
export const challengeStore = {
  get: async (aid: string): Promise<string | null> => {
    return await redisClient.get(`challenge:${aid}`);
  },
  set: async (aid: string, nonce: string): Promise<void> => {
    await redisClient.set(`challenge:${aid}`, nonce, 'EX', 60 * 5);
  },
  delete: async (aid: string): Promise<void> => {
    await redisClient.del(`challenge:${aid}`);
  }
};

// Session store: Token -> { aid, username, publicKey, exchangePublicKey } (expires in 24 hours)
export interface SessionData {
  aid: string;
  username: string;
  publicKey: string;
  exchangePublicKey: string;
}

export const sessionStore = {
  get: async (token: string): Promise<SessionData | null> => {
    const data = await redisClient.get(`session:${token}`);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (err) {
      logger.error(`Failed to parse session data for token ${token}`);
      return null;
    }
  },
  set: async (token: string, session: SessionData): Promise<void> => {
    await redisClient.set(`session:${token}`, JSON.stringify(session), 'EX', 60 * 60 * 24);
  },
  delete: async (token: string): Promise<void> => {
    await redisClient.del(`session:${token}`);
  }
};

