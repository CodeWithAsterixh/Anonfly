import { db } from "../src/data/database/PostgresClient";

async function test() {
    try {
        console.log("Testing connection with current config...");
        const res = await db.query("SELECT NOW()");
        console.log("Success:", res.rows[0]);
    } catch (err: any) {
        console.error("Connection failed:", err.message);
    } finally {
        await db.close();
    }
}

test();
