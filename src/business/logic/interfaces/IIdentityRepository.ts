import { Identity } from "../../entities/Identity";

export interface IIdentityRepository {
    findById(id: string): Promise<Identity | null>;
    findByAid(aid: string): Promise<Identity | null>;
    save(identity: Identity): Promise<Identity>;
    update(identity: Identity): Promise<Identity>;
}
