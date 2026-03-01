import { Identity } from "../entities/Identity";
import { IIdentityRepository } from "./interfaces/IIdentityRepository";
import { v4 as uuidv4 } from "uuid";

export class IdentityLogic {
    constructor(private readonly identityRepo: IIdentityRepository) { }

    async getOrCreateIdentity(userAid: string, username?: string): Promise<Identity> {
        let identity = await this.identityRepo.findByAid(userAid);

        if (!identity) {
            identity = new Identity(
                userAid,
                uuidv4(),
                username
            );
            await this.identityRepo.save(identity);
        } else if (username && identity.username !== username) {
            const updatedIdentity = new Identity(
                identity.userAid,
                identity.id!,
                username,
                identity.publicKey,
                identity.exchangePublicKey,
                identity.createdAt,
                new Date()
            );
            await this.identityRepo.update(updatedIdentity);
            return updatedIdentity;
        }

        return identity;
    }

    async updatePublicKeys(userAid: string, publicKey: string, exchangePublicKey: string): Promise<void> {
        const identity = await this.identityRepo.findByAid(userAid);
        if (!identity) throw new Error("Identity not found");

        const updatedIdentity = new Identity(
            identity.userAid,
            identity.id!,
            identity.username,
            publicKey,
            exchangePublicKey,
            identity.createdAt,
            new Date()
        );
        await this.identityRepo.update(updatedIdentity);
    }
}
