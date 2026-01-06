# Routes Module

This module contains the REST API endpoints for the application, organized by feature.

## Feature Modules

### Authentication (`/auth`)
Handles the cryptographic handshake used for user identification.
- `POST /auth/challenge`: Generates a random nonce for a given user AID.
- `POST /auth/verify`: Verifies a digital signature of the nonce to establish a session.
- `GET /auth/moderation-token`: Generates a short-lived code for moderation actions.

### Chatroom Management (`/chatrooms`)
Handles CRUD operations and access control for chatrooms.
- `POST /chatrooms`: Create a new room (Public or Private).
- `GET /chatrooms`: List public chatrooms with filters (region, etc.).
- `POST /chatrooms/:id/join`: Validate access requirements (password/invite) for a room.
- `POST /chatrooms/:id/leave`: Formally leave a room.
- `DELETE /chatrooms/:id`: Delete a room (Creator/Moderator only).

---

## Architecture

### Route Configuration
Each route is defined as a `RouteConfig` object, which includes:
- `method`: HTTP verb (GET, POST, etc.)
- `path`: URL pattern.
- `middleware`: An array of middleware functions (e.g., `verifyToken`, `validate`).
- `handler`: The core business logic, wrapped in `withErrorHandling`.

### Error Handling
All route handlers use the `withErrorHandling` middleware. This ensures that:
- Uncaught exceptions are caught and logged.
- Consistent JSON error responses are returned to the client.
- Database connection issues are handled gracefully.

---

## Integration Guide

### Adding a New Route
1. Create a new `.ts` file in the appropriate subdirectory (e.g., `app/routes/newFeature/myRoute.ts`).
2. Define the `RouteConfig` and export it.
3. Import and register the route in the main application entry point (`app/index.ts`).

### Using Middleware
Always include security and validation middleware where appropriate:
- `verifyToken`: Required for any route that needs to identify the user.
- `validate(schema)`: Required for any route that accepts user input.
- `rateLimiter`: Recommended for high-traffic or sensitive endpoints.
