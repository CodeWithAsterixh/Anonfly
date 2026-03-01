import { Session } from "../../entities/Session";

export interface ISessionRepository {
    save(session: Session): Promise<Session>;
    findByToken(token: string): Promise<Session | null>;
    delete(token: string): Promise<void>;
    deleteExpired(): Promise<void>;
}
