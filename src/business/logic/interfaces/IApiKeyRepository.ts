import { ApiKey } from "../../entities/ApiKey";

export interface IApiKeyRepository {
    findByHash(keyHash: string): Promise<ApiKey | null>;
    save(apiKey: ApiKey): Promise<ApiKey>;
    delete(id: string): Promise<void>;
}
