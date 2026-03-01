import { v4 as uuidv4 } from "uuid";
import { IChallengeStore } from "../../data/database/RedisChallengeStore";

export class GenerateChallengeUseCase {
    constructor(private readonly challengeStore: IChallengeStore) { }

    async execute(input: { aid: string }): Promise<{ nonce: string }> {
        if (!input.aid) throw new Error("AID is required");
        const nonce = uuidv4();
        await this.challengeStore.set(input.aid, nonce);
        return { nonce };
    }
}
