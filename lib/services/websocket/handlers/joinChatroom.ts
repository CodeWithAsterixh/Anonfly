import { WebSocket } from "ws";
import bcrypt from "bcrypt";
import pino from "pino";
import { CustomWebSocket } from "../../../types/websocket";
import ChatRoom from "../../../models/chatRoom";
import Message from "../../../models/message";
import chatEventEmitter from "../../../helpers/eventEmitter";
import {
  getCachedMessages,
  cacheMessages,
} from "../../../helpers/messageCache";
import {
  activeChatrooms,
  addClientToChatroom,
  removeClientFromChatroom,
} from "../clientManager";
import {
  validateRoomAccessToken,
  validateJoinAuthToken,
} from "../../../helpers/crypto";
import env from "../../../constants/env";

const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  transport:
    env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { colorize: true },
        },
});

export async function handleJoinChatroom(
  wsClient: CustomWebSocket,
  parsedMessage: any,
  handleParsedMessage: (
    wsClient: CustomWebSocket,
    parsedMessage: any
  ) => Promise<void>
) {
  const {
    chatroomId,
    userAid,
    username,
    allowedFeatures,
  } = parsedMessage;

  // If the client is already in a chatroom, remove them from the previous one first
  if (wsClient.chatroomId && wsClient.chatroomId !== chatroomId) {
    logger.info(
      `Client ${wsClient.id} switching from room ${wsClient.chatroomId} to ${chatroomId}`
    );
    await removeClientFromChatroom(wsClient.chatroomId, wsClient);
  }

  wsClient.syncing = true;
  wsClient.userAid = userAid;
  wsClient.username = username;
  wsClient.allowedFeatures = allowedFeatures;

  try {
    const chatroom = await checkChatroomAndBan(wsClient, chatroomId);
    if (!chatroom) {
      wsClient.syncing = false;
      return;
    }

    const hasAccess = await validateRoomAccess(wsClient, chatroom, parsedMessage);
    if (!hasAccess) {
      wsClient.syncing = false;
      return;
    }

    await updateParticipantStatus(wsClient, chatroom, parsedMessage);

    // Check if creator is online
    const chatroomClients = activeChatrooms.get(chatroomId);
    const isCreatorOnline = Array.from(chatroomClients?.values() || []).some(
      (c) => c.userAid === chatroom.creatorAid
    );

    const filteredMessages = await fetchAndFilterMessages(wsClient, chatroom);

    await broadcastJoinEvents(wsClient, chatroom, filteredMessages, parsedMessage, isCreatorOnline);
  } catch (err) {
    logger.error(`Error in handleJoinChatroom: ${err}`);
  } finally {
    wsClient.syncing = false;
    // Flush queued messages (if any) in order
    const queued = wsClient.messageQueue ? wsClient.messageQueue.splice(0) : [];
    for (const qm of queued) {
      await handleParsedMessage(wsClient, qm);
    }
  }
}

async function checkChatroomAndBan(wsClient: CustomWebSocket, chatroomId: string) {
  const chatroom = await ChatRoom.findById(chatroomId);
  if (!chatroom) {
    wsClient.send(
      JSON.stringify({ type: "error", message: "Chatroom not found" })
    );
    return null;
  }

  // Check if user is banned
  const isBanned = chatroom.bans?.some((b) => b.userAid === wsClient.userAid);
  if (isBanned) {
    wsClient.send(
      JSON.stringify({
        type: "error",
        message: "You were banned from this room and cannot rejoin.",
        reason: "banned",
      })
    );
    return null;
  }
  return chatroom;
}

async function validateRoomAccess(wsClient: CustomWebSocket, chatroom: any, parsedMessage: any): Promise<boolean> {
  const { joinAuthToken, linkToken, password } = parsedMessage;
  const participant = chatroom.participants.find((p: any) => p.userAid === wsClient.userAid);
  const isCreator = wsClient.userAid === chatroom.creatorAid;
  
  let isTokenValid = false;

  // 1. Check joinAuthToken (short-lived proof from validate-link)
  if (joinAuthToken && !isCreator && !participant && wsClient.userAid) {
    if (validateJoinAuthToken(joinAuthToken, chatroom._id.toString(), wsClient.userAid)) {
      isTokenValid = true;
    }
  }

  // 2. Link token validation (the long-lived invite link itself)
  if (!isTokenValid && linkToken && !isCreator && !participant) {
    isTokenValid = await verifyLinkToken(linkToken, chatroom);
  }

  // Private room access control
  if (chatroom.isPrivate && !isCreator && !participant && !isTokenValid) {
    wsClient.send(
      JSON.stringify({
        type: "error",
        message:
          "This is a private room. Access is only allowed via a secure invite link.",
      })
    );
    return false;
  }

  // Password verification for locked rooms
  if (chatroom.isLocked && chatroom.password && !isCreator && !participant && !isTokenValid) {
    if (!password) {
      wsClient.send(
        JSON.stringify({
          type: "error",
          message: "Password required for this chatroom",
          requiresPassword: true,
        })
      );
      return false;
    }

    const isMatch = password === chatroom.password || (await bcrypt.compare(password, chatroom.password));
    if (!isMatch) {
      wsClient.send(
        JSON.stringify({ type: "error", message: "Incorrect password" })
      );
      return false;
    }
  }

  return true;
}

async function verifyLinkToken(linkToken: string, chatroom: any): Promise<boolean> {
  try {
    const decoded = validateRoomAccessToken(linkToken);
    if (decoded.roomId === chatroom._id.toString()) {
      const roomPwd = chatroom.password || null;
      const tokenPwd = decoded.password || null;

      let isMatch = roomPwd === tokenPwd;
      if (!isMatch && roomPwd && tokenPwd) {
        try {
           isMatch = await bcrypt.compare(tokenPwd, roomPwd);
        } catch {
           isMatch = false;
        }
      }

      if (!roomPwd || isMatch) {
        return true;
      }
    }
  } catch {
    logger.debug(`Invalid link token provided for room ${chatroom._id}`);
  }
  return false;
}

async function updateParticipantStatus(wsClient: CustomWebSocket, chatroom: any, parsedMessage: any) {
  const { userAid, username, publicKey, exchangePublicKey, allowedFeatures } = parsedMessage;

  // Migration for existing rooms without creatorAid
  if (!chatroom.creatorAid) {
    chatroom.creatorAid = chatroom.hostAid;
    await chatroom.save();
  }

  // If joining user is the creator, they become the host automatically
  if (wsClient.userAid === chatroom.creatorAid && chatroom.hostAid !== wsClient.userAid) {
    chatroom.hostAid = wsClient.userAid;
    await chatroom.save();
    broadcastHostUpdate(chatroom._id.toString(), chatroom.hostAid);
  }

  addClientToChatroom(chatroom._id.toString(), wsClient);
  wsClient.joinedAt = new Date();

  const participant = chatroom.participants.find((p: any) => p.userAid === wsClient.userAid);

  if (participant) {
    // Always reset joinedAt on every join session
    logger.info(`User ${wsClient.userAid} joined room ${chatroom._id}. Resetting joinedAt for new session.`);
    participant.joinedAt = new Date();
    if (allowedFeatures) participant.allowedFeatures = allowedFeatures;
    await chatroom.save();
  } else if (username && userAid) {
    // If not a participant yet, add them
    chatroom.participants.push({
      userAid,
      username,
      publicKey,
      exchangePublicKey,
      allowedFeatures,
      joinedAt: new Date(),
    });
    if (!chatroom.hostAid) {
      chatroom.hostAid = userAid;
    }
    await chatroom.save();
    chatEventEmitter.emit(`chatroomUpdated:${chatroom._id}`);
    chatEventEmitter.emit("chatroomListUpdated");
  }
}

function broadcastHostUpdate(chatroomId: string, hostAid: string) {
    const chatroomClients = activeChatrooms.get(chatroomId);
    if (chatroomClients) {
      const hostUpdate = JSON.stringify({
        type: "hostUpdated",
        chatroomId,
        hostAid,
      });
      chatroomClients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(hostUpdate);
        }
      });
    }
}

async function fetchAndFilterMessages(wsClient: CustomWebSocket, chatroom: any) {
  const chatroomId = chatroom._id.toString();
  let cachedMessages = await getCachedMessages(chatroomId);

  // If cache is empty, fetch from MongoDB and populate cache
  if (cachedMessages.length === 0 && chatroom) {
    logger.debug(`Cache miss for chatroom ${chatroomId}, fetching from DB`);
    const dbMessages = await Message.find({ chatroomId }).sort({ timestamp: -1 }).limit(50).lean();
    
    const reversedbMessages = [...dbMessages].reverse();
    cachedMessages = reversedbMessages.map((msg) => ({
      ...msg,
      id: msg._id.toString(),
      chatroomId: chatroomId.toString(),
    }));

    if (cachedMessages.length > 0) {
      await cacheMessages(chatroomId, cachedMessages);
    }
  }

  const currentParticipant = chatroom.participants.find((p: any) => p.userAid === wsClient.userAid);
  const isCreator = chatroom.creatorAid === currentParticipant?.userAid;
  const joinedAt = wsClient.joinedAt ? wsClient.joinedAt.getTime() : Date.now();
  
  const filteredMessages: any[] = [];

  if (currentParticipant) {
    for (const msg of cachedMessages) {
       const msgTimestamp = new Date(msg.timestamp).getTime();
       // Skip messages sent before the user joined/rejoined (Strict Incognito)
       if (!isCreator && msgTimestamp < joinedAt) continue;
       
       filteredMessages.push(formatMessage(msg, chatroom));
    }
  }
  return filteredMessages;
}

function formatMessage(msg: any, chatroom: any) {
    return {
          type: "chatMessage",
          messageId: msg._id || msg.id,
          chatroomId: msg.chatroomId,
          senderAid: msg.senderAid || msg.senderId,
          senderUsername: msg.senderUsername || chatroom.participants.find((p: any) => p.userAid === msg.senderAid)?.username || "Anonymous",
          content: msg.content,
          signature: msg.signature,
          timestamp: new Date(msg.timestamp).toISOString(),
          isEdited: msg.isEdited || false,
          isDeleted: msg.isDeleted || false,
          reactions: msg.reactions || [],
          replyTo: msg.replyTo ? {
                messageId: msg.replyTo.messageId.toString(),
                username: msg.replyTo.username,
                content: msg.replyTo.content,
                userAid: msg.replyTo.userAid,
              } : undefined,
    };
}

async function broadcastJoinEvents(wsClient: CustomWebSocket, chatroom: any, filteredMessages: any[], parsedMessage: any, isCreatorOnline: boolean) {
  const { allowedFeatures, publicKey, exchangePublicKey } = parsedMessage;
  const participant = chatroom.participants.find((p: any) => p.userAid === wsClient.userAid);
  const finalPublicKey = participant?.publicKey || publicKey;
  const finalExchangePublicKey = participant?.exchangePublicKey || exchangePublicKey;
  const chatroomId = chatroom._id.toString();

  wsClient.send(JSON.stringify({
      type: "joinSuccess",
      chatroomId,
      encryptedRoomKey: chatroom.encryptedRoomKey,
      roomKeyIv: chatroom.roomKeyIv,
      hostAid: chatroom.hostAid,
      creatorAid: chatroom.creatorAid,
      isCreatorOnline,
      participants: chatroom.participants.map((p: any) => ({
          userAid: p.userAid,
          username: p.username,
          publicKey: p.publicKey,
          exchangePublicKey: p.exchangePublicKey,
          allowedFeatures: p.allowedFeatures,
      })),
      cachedMessages: filteredMessages,
  }));

  const chatroomClients = activeChatrooms.get(chatroomId);
  if (chatroomClients) {
      const isCreatorJoining = wsClient.userAid === chatroom.creatorAid;
      const joinNotice = JSON.stringify({
        type: "userJoined",
        chatroomId,
        userAid: wsClient.userAid,
        username: wsClient.username,
        publicKey: finalPublicKey,
        exchangePublicKey: finalExchangePublicKey,
        allowedFeatures: allowedFeatures,
        timestamp: new Date().toISOString(),
        isCreator: isCreatorJoining,
      });
      chatroomClients.forEach((client) => {
        if (client.id !== wsClient.id && client.readyState === WebSocket.OPEN) {
          client.send(joinNotice);
        }
      });
  }
}
