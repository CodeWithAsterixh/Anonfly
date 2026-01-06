<div align="center">
  <div style="display: flex; align-items: center; justify-content: center; gap: 8px;">
    <svg width="128" height="128" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));">
      <defs>
        <linearGradient id="logo-shield-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#3b82f6" />
          <stop offset="100%" stop-color="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M176 192V144C176 99.8172 211.817 64 256 64C300.183 64 336 99.8172 336 144V192" stroke="#3b82f6" stroke-width="32" stroke-linecap="round" />
      <path d="M128 160C128 160 128 280 128 320C128 400 256 464 256 464C256 464 384 400 384 320C384 280 384 160 384 160H128Z" fill="url(#logo-shield-grad)" />
      <rect x="180" y="260" width="60" height="20" rx="10" fill="white" />
      <rect x="272" y="260" width="60" height="20" rx="10" fill="white" />
      <path d="M128 200L32 280L128 320" fill="#3b82f6" fill-opacity="0.6" />
      <path d="M384 200L480 280L384 320" fill="#3b82f6" fill-opacity="0.6" />
    </svg>
    <div style="display: flex; flex-direction: column; line-height: 1.2; text-align: left;">
      <span style="font-weight: bold; font-size: 24px; letter-spacing: -0.025em; color: #1d4ed8;">
        Anonfly
      </span>
      <span style="font-size: 10px; font-weight: bold; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.1em;">
        Free • Secure • Anon
      </span>
    </div>
  </div>
</div>

# Anonfly Backend 🚀

The robust, high-performance backend powering the Anonfly anonymous chat application. Built with Node.js, Express, and MongoDB, it handles real-time communication, secure handshakes, and persistent chatroom management.

## 🛠️ Tech Stack & Tools

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/) (v5.x)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Database**: [MongoDB](https://www.mongodb.com/) via [Mongoose](https://mongoosejs.com/)
- **Real-time**: [WebSockets (ws)](https://github.com/websockets/ws) & [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- **Security**: 
  - [Helmet](https://helmetjs.github.io/) for security headers
  - [Bcrypt](https://github.com/kelektiv/node.bcrypt.js) for hashing
  - [JSON Web Tokens (JWT)](https://jwt.io/) for session management
  - Custom Ed25519 signature verification for secure handshakes
- **Validation**: [Zod](https://zod.dev/) & [Express-Validator](https://express-validator.github.io/docs/)
- **Caching**: [Redis (ioredis)](https://github.com/redis/ioredis)
- **Logging**: [Pino](https://getpino.io/) & [Pino-HTTP](https://github.com/pinojs/pino-http)

## 🏗️ Core Architecture

### 1. Secure Handshake Protocol
Anonfly uses a cryptographic handshake to establish sessions. The client generates an Ed25519 keypair, requests a challenge, signs it, and receives a JWT token upon successful verification.

### 2. Real-time Communication
- **SSE (Server-Sent Events)**: Used for broadcasting chatroom list updates and room-level events efficiently.
- **WebSockets**: Power the bi-directional chat messaging system, providing sub-millisecond latency for message delivery.

### 3. Middleware Pipeline
- `securityHeaders`: Implements strict CSP and security policies.
- `verifyToken`: Validates JWT tokens for protected routes.
- `withErrorHandling`: Centralized error management using a custom `normalizeError` helper.
- `logger`: Request logging powered by Pino for high performance.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB instance
- Redis (optional, for advanced caching)

### Installation
```bash
cd Anonfly
pnpm install
```

### Environment Setup
Create a `.env` file based on `lib/constants/env.ts`:
```env
PORT=5000
MONGODB_URI=your_mongodb_uri
JWT_SECRET=your_secret
```

### Development
```bash
pnpm dev
```

### Production Build
```bash
pnpm build
pnpm start
```

## 📂 Project Structure

- [app/routes/](file:///c:/Users/Asterixh/Desktop/Anonfly-chat-app/Anonfly/app/routes/README.md): API endpoints grouped by feature (auth, chatroom).
- [lib/helpers/](file:///c:/Users/Asterixh/Desktop/Anonfly-chat-app/Anonfly/lib/helpers/README.md): Core logic for database connection, crypto, and session storage.
- [lib/middlewares/](file:///c:/Users/Asterixh/Desktop/Anonfly-chat-app/Anonfly/lib/middlewares/README.md): Express middlewares for security and logging.
- [lib/models/](file:///c:/Users/Asterixh/Desktop/Anonfly-chat-app/Anonfly/lib/models/README.md): Mongoose schemas for ChatRooms and Messages.
- [lib/services/websocket/](file:///c:/Users/Asterixh/Desktop/Anonfly-chat-app/Anonfly/lib/services/websocket/README.md): Real-time messaging service.

---
Created with ❤️ by **Peter Paul (Asterixh)**
- Portfolio: [codewithasterixh.vercel.app](https://codewithasterixh.vercel.app)
- Frontend: [anonfly.vercel.app](https://anonfly.vercel.app)
