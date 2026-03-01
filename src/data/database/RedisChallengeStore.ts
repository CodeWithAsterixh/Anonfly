import Redis from "ioredis";

export interface IChallengeStore {
    get(aid: string): Promise<string | null>;
    set(aid: string, nonce: string): Promise<void>;
    delete(aid: string): Promise<void>;
}

export class RedisChallengeStore implements IChallengeStore {
    private readonly redis: Redis;

    constructor() {
        this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    }

    async get(aid: string): Promise<string | null> {
        return this.redis.get(`challenge:${aid}`);
    }

    async set(aid: string, nonce: string): Promise<void> {
        // Challenges expire in 5 minutes
        await this.redis.set(`challenge:${aid}`, nonce, "EX", 300);
    }

    async delete(aid: string): Promise<void> {
        await this.redis.del(`challenge:${aid}`);
    }
}
