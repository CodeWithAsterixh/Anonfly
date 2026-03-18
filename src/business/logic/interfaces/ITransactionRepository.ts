import { Transaction } from "../../entities/Transaction";

export interface ITransactionRepository {
    findById(id: string): Promise<Transaction | null>;
    findByProviderTransactionId(providerId: string): Promise<Transaction | null>;
    findByStatus(status: string): Promise<Transaction[]>;
    save(transaction: Transaction): Promise<Transaction>;
    update(transaction: Transaction): Promise<Transaction>;
}
