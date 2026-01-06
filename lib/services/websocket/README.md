# WebSocket Service Module

This module manages real-time bidirectional communication between clients and the server using the `ws` library.

## Core Components

### Connection Manager (`connectionManager.ts`)
The entry point for all WebSocket connections.
- **Security**: Implements IP-based connection limiting (max 5 per IP) and per-client message rate limiting (Leaky Bucket).
- **Lifecycle**: Handles connection initialization, heartbeats (ping/pong), and clean disconnection.

### Client Manager (`clientManager.ts`)
Manages the state of connected clients in memory.
- **Tracking**: Maintains `activeChatrooms` map for efficient broadcasting.
- **Inactivity Cleanup**: Schedules a 24-hour deletion timer for empty chatrooms.
- **Host Management**: Automatically transfers "Host" status to the next available participant when a host leaves.

### Message Handler (`messageHandler.ts`)
The central router for all incoming WebSocket messages.
- **Routing**: Dispatches messages to specific sub-handlers in `handlers/` based on the `type` field.
- **Authentication**: Ensures clients are authenticated via AID before processing sensitive messages.

---

## Message Protocol

All WebSocket messages are JSON objects with a required `type` field.

### Client-to-Server (Incoming)
| Type | Description |
|---|---|
| `joinChatroom` | User requesting to join a room. |
| `message` | Sending a new encrypted message. |
| `typing` | User started/stopped typing. |
| `reaction` | Adding an emoji reaction to a message. |
| `leaveChatroom` | Explicitly leaving a room. |

### Server-to-Client (Outgoing)
| Type | Description |
|---|---|
| `joinSuccess` | Confirmation of room entry with E2EE metadata. |
| `newMessage` | A new message broadcasted to the room. |
| `userJoined` / `userLeft` | Presence updates. |
| `hostUpdated` | Notification that the room host has changed. |
| `error` | General error notifications. |

---

## Implementation Details

### End-to-End Encryption (E2EE)
The WebSocket service facilitates E2EE by:
1. Transmitting the host's `encryptedRoomKey` to new joiners.
2. Routing Signal messages (`signal.ts`) for X25519 key exchange between participants.
3. Ensuring the server never sees the raw room key or plaintext message content.

### State Consistency
The service uses `lib/helpers/eventEmitter.ts` to sync with changes made via the REST API (e.g., if a room is deleted via a POST request, the WebSocket service is notified to disconnect all clients).
