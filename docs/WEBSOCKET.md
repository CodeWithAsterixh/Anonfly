# Anonfly Service WebSocket Protocol

The WebSocket API handles real-time messaging, presence, and interactive features like reactions.

## Connection
- **Endpoint**: `ws://localhost:5001`
- **Authentication**: Authentication is performed via the initial `joinChatroom` message using a session token.

---

## Client-to-Server Messages

### 1. Join Chatroom
Must be the first message sent after connection.

```json
{
  "type": "joinChatroom",
  "chatroomId": "uuid",
  "token": "session-token (optional)",
  "userAid": "string",
  "username": "string",
  "publicKey": "string",
  "exchangePublicKey": "string"
}
```

### 2. Send Message
Broadcasts a message to the room.

```json
{
  "type": "message",
  "chatroomId": "uuid",
  "content": "Encrypted content",
  "userAid": "string",
  "username": "string",
  "signature": "string"
}
```

### 3. Edit/Delete Message
```json
{
  "type": "editMessage",
  "messageId": "uuid",
  "newContent": "Updated encrypted content"
}

{
  "type": "deleteMessage",
  "messageId": "uuid"
}
```

### 4. Add Reaction
```json
{
  "type": "reaction",
  "messageId": "uuid",
  "userAid": "string",
  "emojiId": "string",
  "emojiValue": "string",
  "emojiType": "string"
}
```

---

## Server-to-Client Messages

### 1. Join Success
Sent immediately after a successful `joinChatroom` request.

```json
{
  "type": "joinSuccess",
  "chatroomId": "uuid",
  "encryptedRoomKey": "string",
  "roomKeyIv": "string",
  "participants": [...],
  "cachedMessages": [...]
}
```

### 2. New Message
Broadcast to all room participants when a message is sent.

```json
{
  "type": "message",
  "id": "uuid",
  "senderAid": "string",
  "senderUsername": "string",
  "content": "string",
  "timestamp": "ISO-8601",
  "reactions": []
}
```

### 3. Presence Updates
```json
{
  "type": "userJoined",
  "chatroomId": "uuid",
  "userAid": "string",
  "username": "string",
  "timestamp": "ISO-8601"
}
```
---
## Error Handling
Errors are sent with the `error` type:
```json
{
  "type": "error",
  "message": "Error description"
}
```
