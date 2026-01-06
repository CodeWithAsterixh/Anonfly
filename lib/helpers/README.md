# Helpers Module

This module contains utility functions, security helpers, and background task handlers used across the application.

## Core Helpers

### Cryptography (`crypto.ts`)
Handles all encryption, decryption, and signature verification.

#### Implementation
- **Algorithm**: `aes-256-gcm` for internal data encryption.
- **Key Derivation**: `scrypt` using `JWT_ACCESS_SECRET` and `SALT`.
- **Digital Signatures**: `Ed25519` via Node.js `crypto` module.
- **Join Tokens**: Short-lived tokens for secure chatroom entry.

#### Usage
```typescript
import { encrypt, decrypt } from './lib/helpers/crypto';

const secret = encrypt("hello world");
const plain = decrypt(secret);
```

### Validation (`validation.ts`)
Provides Zod schemas and a `validate` middleware for HTTP request body/params validation.

### Cleanup (`cleanupChatroom.ts`)
Handles the deletion of chatrooms and their associated cache entries in Redis.

### Event Emitter (`eventEmitter.ts`)
A central `EventEmitter` instance used for internal pub/sub logic, such as notifying the WebSocket service when a chatroom document is updated via REST API.

### Message Cache (`messageCache.ts`)
Interfaces with Redis to cache recent messages for high-performance retrieval.

---

## Integration Guide

1. **Adding a Helper**: Create a new `.ts` file in this directory. Ensure it is stateless if possible.
2. **Using in Routes**: Import the required helper and use it within the route handler or as middleware.
3. **Security**: Always use `crypto.ts` for any sensitive data handling. Do not implement custom crypto logic elsewhere.
