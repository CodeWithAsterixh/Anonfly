export interface AppError {
    message: string;
    code: string;
    statusCode: number;
}

export type IdentityId = string;
export type ConversationId = string;
export type MessageId = string;

export interface Result<T = void> {
    success: boolean;
    data?: T;
    error?: string;
}

export enum ParticipantRole {
    MEMBER = "member",
    HOST = "host",
    MODERATOR = "moderator"
}
