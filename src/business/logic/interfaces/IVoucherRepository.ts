import { Voucher } from "../../entities/Voucher";

export interface IVoucherRepository {
    findByCode(code: string): Promise<Voucher | null>;
    save(voucher: Voucher): Promise<Voucher>;
    update(voucher: Voucher): Promise<Voucher>;
}
