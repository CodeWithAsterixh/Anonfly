import { IConversationRepository } from "./interfaces/IConversationRepository";
import { Conversation } from "../entities/Conversation";
import { v4 as uuidv4 } from "uuid";

export class ConversationLogic {
    constructor(private readonly conversationRepo: IConversationRepository) { }

    async createConversation(
        roomName: string,
        hostAid: string,
        creatorAid: string,
        options: {
            description?: string;
            region?: string;
            isLocked?: boolean;
            passwordHash?: string;
            isPrivate?: boolean;
        } = {}
    ): Promise<Conversation> {
        const existing = await this.conversationRepo.findByName(roomName);
        if (existing) throw new Error("Room name already exists");

        const conversation = new Conversation(
            uuidv4(),
            roomName,
            hostAid,
            creatorAid,
            options.description,
            options.region,
            undefined, // encryptedRoomKey
            undefined, // roomKeyIv
            options.isLocked ?? false,
            options.passwordHash,
            options.isPrivate ?? false
        );

        return this.conversationRepo.save(conversation);
    }

    async getConversation(id: string): Promise<Conversation | null> {
        return this.conversationRepo.findById(id);
    }
}
