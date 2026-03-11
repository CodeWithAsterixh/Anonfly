import { Transaction } from "../../entities/Transaction";

export interface ITransactionRepository {
    findById(id: string): Promise<Transaction | null>;
    findByProviderTransactionId(providerId: string): Promise<Transaction | null>;
    save(transaction: Transaction): Promise<Transaction>;
    update(transaction: Transaction): Promise<Transaction>;
}
