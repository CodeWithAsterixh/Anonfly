import "dotenv/config";
import { db } from "../src/data/database/PostgresClient";
import * as fs from "fs";
import * as path from "path";

async function migrate() {
    console.log("Starting migration on Supabase...");
    const migrationsDir = path.join(process.cwd(), "src/data/migrations");

    if (!fs.existsSync(migrationsDir)) {
        console.error("Migrations directory not found at:", migrationsDir);
        process.exit(1);
    }

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith(".sql")).sort();
    console.log(`Found ${files.length} migration files: ${files.join(", ")}`);

    try {
        for (const file of files) {
            console.log(`Running migration: ${file}...`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
            await db.query(sql);
            console.log(`Migration ${file} completed successfully!`);
        }
        console.log("All migrations completed successfully!");
    } catch (err: any) {
        console.error(`Migration failed:`, err.message);
        if (err.detail) console.error("Detail:", err.detail);
        process.exit(1);
    } finally {
        await db.close();
    }
}

migrate();
