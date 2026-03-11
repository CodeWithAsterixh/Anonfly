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

        // 1. Verify AID-PublicKey binding (Prevent spoofing and squatting)
        const pubKeyBuffer = Buffer.from(input.publicKey, "base64");
        const computedAid = crypto.createHash("sha256").update(pubKeyBuffer).digest("hex");
        if (computedAid !== input.aid) {
            throw new Error("Invalid AID-PublicKey binding");
        }

        // 2. Determine which public key to use for signature verification
        let identity = await this.identityRepository.findByAid(input.aid);
        let verificationPubKey: Buffer;

        if (identity && identity.publicKey) {
            // Use stored public key for existing accounts to prevent takeover
            verificationPubKey = Buffer.from(identity.publicKey, "base64");
        } else {
            // First time login, use the provided (and verified) public key
            verificationPubKey = pubKeyBuffer;
        }

        // 3. Verify signature (Ed25519)
        const signatureBuffer = Buffer.from(input.signature, "base64");
        const nonceBuffer = Buffer.from(nonce, "utf8");

        const isVerified = crypto.verify(
            undefined, // algorithm is inferred from key type
            nonceBuffer,
            {
                key: verificationPubKey,
                format: "der",
                type: "spki",
            },
            signatureBuffer
        );

        if (!isVerified) throw new Error("Signature verification failed");

        // Cleanup challenge
        await this.challengeStore.delete(input.aid);

        // 4. Save Identity if it's new
        if (!identity) {
            identity = new Identity(
                input.aid,
                uuidv4(),
                input.username,
                input.publicKey,
                input.exchangePublicKey,
                ["create_room", "large_files", "no_ads"] // Default features for new users
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
            identityId: identity.id,
            allowedFeatures: identity.allowedFeatures
        };
    }
}
