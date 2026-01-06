# Middlewares Module

This module contains Express.js middleware functions used to process requests before they reach the route handlers.

## Core Middlewares

### Authentication (`verifyToken.ts`)
Validates the custom session token provided in the `Authorization` header.
- **Functionality**: Decodes the token via `sessionStore`, extracts user metadata (AID, username, public keys), and attaches them to the `req` object.
- **Usage**: Mandatory for all protected routes.

### Rate Limiting (`rateLimiter.ts`)
Protects the API from abuse and DoS attacks.
- **Strategy**: Uses `express-rate-limit` with IP-based tracking.
- **Tiers**:
  - `authLimiter`: Strict limits for authentication endpoints.
  - `createRoomLimiter`: Prevents spamming of chatroom creation.
  - `rateLimiter`: Default global limit for standard API calls.

### Error Handling (`withErrorHandling.ts`)
A higher-order function that wraps asynchronous route handlers.
- **Safety**: Automatically catches rejected promises and passes them to the global error handler.
- **Consistency**: Ensures every error results in a structured JSON response.

### Logging (`logger.ts`)
Provides structured logging using `pino`.
- **Context**: Separates logs into `api`, `websocket`, and `db` categories.
- **Environment**: Pretty-printing in development, optimized JSON in production.

---

## Integration Guide

### Global Middleware
Global middlewares (like `securityHeaders`, `logger`) are applied in the main `app/index.ts` file to all incoming requests.

### Route-Specific Middleware
Middlewares can be added to the `middleware` array in any `RouteConfig` definition:

```typescript
const myRoute: RouteConfig = {
  method: 'post',
  path: '/my-path',
  middleware: [verifyToken, rateLimiter(10, 60000)], // 10 per min
  handler: async (event) => { /* ... */ }
};
```

### Security Headers
The `securityHeaders.ts` middleware applies standard security best practices:
- Disables `X-Powered-By`.
- Sets `X-Content-Type-Options: nosniff`.
- Configures basic Content Security Policy (CSP) where applicable.
