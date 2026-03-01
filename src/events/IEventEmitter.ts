export interface IEventEmitter {
    emit(event: string, data: any): void;
    on(event: string, callback: (data: any) => void): void;
}

export const Events = {
    MESSAGE_CREATED: "MessageCreated",
    MESSAGE_EDITED: "MessageEdited",
    MESSAGE_DELETED: "MessageDeleted",
    REACTION_ADDED: "ReactionAdded",
    REACTION_REMOVED: "ReactionRemoved",
    MESSAGE_DELIVERED: "MessageDelivered",
    CONVERSATION_CREATED: "ConversationCreated",
};
