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
- **Caching**: [LRU Cache](https://github.com/isaacs/node-lru-cache) & [Redis (ioredis)](https://github.com/redis/ioredis)
- **Logging**: [Pino](https://getpino.io/) & [Pino-HTTP](https://github.com/pinojs/pino-http)
- **File Handling**: [Multer](https://github.com/expressjs/multer) & [Cloudinary](https://cloudinary.com/)

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
CLOUDINARY_URL=your_cloudinary_url
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
- `app/routes/`: API endpoints grouped by feature (auth, chatroom).
- `lib/helpers/`: Core logic for database connection, crypto, and session storage.
- `lib/middlewares/`: Express middlewares for security and logging.
- `lib/models/`: Mongoose schemas for ChatRooms and Messages.

---
Created with ❤️ by **Peter Paul (Asterixh)**
- Portfolio: [codewithasterixh.vercel.app](https://codewithasterixh.vercel.app)
- Frontend: [anonfly.vercel.app](https://anonfly.vercel.app)
