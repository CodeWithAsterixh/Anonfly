import "dotenv/config";
import { PostgresApiKeyRepository } from "../src/data/repositories/PostgresApiKeyRepository";
import { ApiKey } from "../src/business/entities/ApiKey";
import * as crypto from "crypto";

const apiKeyRepo = new PostgresApiKeyRepository();

async function seed() {
    const apiKey = "test-api-key-123";
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    await apiKeyRepo.save(new ApiKey(
        undefined,
        keyHash,
        "Test Application"
    ));

    console.log("Seed completed!");
    console.log("Your API Key is: test-api-key-123");
}

seed().catch((e) => {
    console.error(e);
    process.exit(1);
});
