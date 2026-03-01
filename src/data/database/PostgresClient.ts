import { Pool, QueryResult, QueryResultRow } from "pg";
import "dotenv/config";

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on("error", (err) => {
    console.error("Unexpected error on idle client", err);
    process.exit(-1);
});

export const db = {
    async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
        const start = Date.now();
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // Optional: Log query duration for performance monitoring
        // console.log("executed query", { text, duration, rows: res.rowCount });
        return res;
    },

    async getClient() {
        return await pool.connect();
    },

    async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            const result = await callback(client);
            await client.query("COMMIT");
            return result;
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }
    },

    async close() {
        await pool.end();
    }
};
