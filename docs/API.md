# Anonfly Service API Reference

The Anonfly Service provides a RESTful API for authentication and chatroom management.

## Base URL
`http://localhost:5001/api/v1`

---

## Authentication

Anonfly uses a Challenge-Response authentication mechanism to verify identities.

### 1. Request Challenge
Generates a unique challenge for the user to sign.

- **URL**: `/auth/challenge`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "identityId": "string (optional)"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "challenge": "base64-encoded-string"
  }
  ```

### 2. Verify Identity
Verifies the signed challenge and returns a session token.

- **URL**: `/auth/verify`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "identityId": "string",
    "signature": "string",
    "publicKey": "string"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "token": "session-token",
    "identityId": "string"
  }
  ```

---

## Chatrooms

### 1. Get Public Chatrooms
Returns a list of all publicly available chatrooms.

- **URL**: `/chatrooms`
- **Method**: `GET`
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "uuid",
      "name": "Room Name",
      "description": "Room Description",
      "isPublic": true,
      "participantCount": 5
    }
  ]
  ```

### 2. Create Chatroom
Creates a new chatroom. Requires `Authorization` header with a valid session token.

- **URL**: `/chatrooms`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Body**:
  ```json
  {
    "name": "Room Name",
    "description": "Room Description",
    "isPublic": true,
    "encryptedRoomKey": "base64-string",
    "roomKeyIv": "base64-string"
  }
  ```
- **Response**: `201 Created`

### 3. Join Chatroom
Adds the authenticated user to a chatroom.

- **URL**: `/chatrooms/:chatroomId/join`
- **Method**: `POST`
- **Headers**: `Authorization: Bearer <token>`
- **Response**: `200 OK`

### 4. Get Message History
Retrieves the message history for a specific room.

- **URL**: `/chatrooms/:chatroomId/messages`
- **Method**: `GET`
- **Query params**: `limit` (default: 50)
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "uuid",
      "content": "Encrypted message content",
      "senderAid": "sender-address",
      "senderUsername": "username",
      "timestamp": "ISO-8601"
    }
  ]
  ```

---

## Server-Sent Events (SSE)

### 1. Chatroom Details Stream
Listen for real-time updates to chatroom metadata (participants, etc).

- **URL**: `/chatroom/:chatroomId/details/sse`
- **Method**: `GET`
- **Headers**: `Accept: text/event-stream`
