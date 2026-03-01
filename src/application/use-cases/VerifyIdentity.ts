import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { IChallengeStore } from "../../data/database/RedisChallengeStore";
import { ISessionRepository } from "../../business/logic/interfaces/ISessionRepository";
import { Session } from "../../business/entities/Session";
import { IIdentityRepository } from "../../business/logic/interfaces/IIdentityRepository";
import { Identity } from "../../business/entities/Identity";

export interface VerifyIdentityInput {
    aid: string;
    signature: string;
    username: string;
    publicKey: string;
    exchangePublicKey: string;
}

export class VerifyIdentityUseCase {
    constructor(
        private readonly challengeStore: IChallengeStore,
        private readonly sessionRepository: ISessionRepository,
        private readonly identityRepository: IIdentityRepository
    ) { }

    async execute(input: VerifyIdentityInput) {
        const nonce = await this.challengeStore.get(input.aid);
        if (!nonce) throw new Error("Challenge expired or not found");

        // Verify signature (Ed25519)
        const pubKeyBuffer = Buffer.from(input.publicKey, "base64");
        const signatureBuffer = Buffer.from(input.signature, "base64");
        const nonceBuffer = Buffer.from(nonce, "utf8");

        const isVerified = crypto.verify(
            undefined, // algorithm is inferred from key type
            nonceBuffer,
            {
                key: pubKeyBuffer,
                format: "der",
                type: "spki",
            },
            signatureBuffer
        );

        if (!isVerified) throw new Error("Signature verification failed");

        // Cleanup challenge
        await this.challengeStore.delete(input.aid);

        // Upsert Identity
        let identity = await this.identityRepository.findByAid(input.aid);
        if (!identity) {
            identity = new Identity(
                input.aid,
                undefined,
                input.username,
                input.publicKey,
                input.exchangePublicKey
            );
            identity = await this.identityRepository.save(identity);
        }

        // Create Session
        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 1 week
        const session = new Session(token, identity.id!, identity.userAid, expiresAt);
        await this.sessionRepository.save(session);

        return {
            token,
            aid: identity.userAid,
            username: identity.username,
            identityId: identity.id
        };
    }
}
