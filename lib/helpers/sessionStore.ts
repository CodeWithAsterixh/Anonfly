import { LRUCache } from 'lru-cache';

// Challenge store: AID -> nonce (expires in 5 minutes)
export const challengeStore = new LRUCache<string, string>({
  max: 10000,
  ttl: 1000 * 60 * 5,
});

// Session store: Token -> { aid, username, publicKey, exchangePublicKey } (expires in 24 hours)
export interface SessionData {
  aid: string;
  username: string;
  publicKey: string;
  exchangePublicKey: string;
}

export const sessionStore = new LRUCache<string, SessionData>({
  max: 10000,
  ttl: 1000 * 60 * 60 * 24,
});
