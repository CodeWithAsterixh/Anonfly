# Models Module

This module contains the Mongoose schemas and TypeScript interfaces for the application's data models.

## Models

### ChatRoom (`chatRoom.ts`)
The core model of the application. It represents a persistent chatroom.

#### Implementation Details
- **Embedded Messages**: Messages are stored as an array within the chatroom document. This optimizes for read performance of chat history.
- **Participants**: Current active participants are tracked in an array.
- **Security**: 
  - `encryptedRoomKey` and `roomKeyIv` support End-to-End Encryption (E2EE).
  - `password` is hashed using bcrypt for locked rooms.
- **Discovery**: `region` and `roomname` allow users to find rooms.

#### Key Interfaces
- `IChatRoom`: The main document interface.
- `IParticipant`: Represents a user currently in the room.
- `IMessage`: Represents a message, including replies and reactions.

#### Usage Example
```typescript
import ChatRoom from './lib/models/chatRoom';

// Find a chatroom by ID
const chatroom = await ChatRoom.findById(chatroomId);

// Add a message to a chatroom
chatroom.messages.push({
  senderAid: 'user-aid',
  senderUsername: 'Alice',
  content: 'Hello everyone!',
  timestamp: new Date()
});
await chatroom.save();
```

### Message (`message.ts`)
*(Note: Most messages are embedded in ChatRoom, but this model might exist for specific queries or legacy support)*

### Permission (`permission.ts`)
Handles user permissions and roles within the platform.

---

## Integration Guide

1. **Database Connection**: Models automatically use the connection provided by `getDbConnection.ts`.
2. **Schema Validation**: Mongoose handles basic validation (required fields, types).
3. **TypeScript Support**: Always use the exported interfaces (`IChatRoom`, `IParticipant`, etc.) when working with model data to ensure type safety.
