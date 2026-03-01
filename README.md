# Anonfly Service

A production-grade messaging service for the Anonfly ecosystem, providing secure, real-time communication with end-to-end encryption support.

## Features
- **Secure Authentication**: Built-in challenge-response mechanism.
- **Real-time Messaging**: Robust WebSocket implementation.
- **Scalable Architecture**: Clean architecture with use-cases and repositories.
- **Persistence**: PostgreSQL for data and Redis for challenge storage.
- **Metadata Streams**: Server-Sent Events (SSE) for real-time room metadata.

## Prerequisites
- Node.js (v18+)
- PostgreSQL
- Redis
- pnpm (recommended)

## Quick Start

### 1. Installation
```bash
pnpm install
```

### 2. Configuration
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/anonfly
REDIS_URL=redis://localhost:6379
PORT=5001
API_KEY_SECRET="your-secret"
```

### 3. Database Setup
Run migrations and seed the database with initial data:
```bash
pnpm ts-node scripts/migrate.ts
pnpm run seed
```

### 4. Running the Service
```bash
# Development mode with nodemon
pnpm run dev

# Production build
pnpm run build
pnpm start
```

## Documentation
- [API Reference](./docs/API.md) - Detailed HTTP endpoints and authentication flow.
- [WebSocket Protocol](./docs/WEBSOCKET.md) - Real-time messaging and events.

## Project Structure
- `src/application`: Business use cases.
- `src/business`: Core domain logic and repository interfaces.
- `src/data`: Database implementations (Postgres/Redis).
- `src/presentation`: Controllers, routes, and communication adapters (WS/SSE).
- `scripts/`: Development and utility scripts.

## License
ISC
