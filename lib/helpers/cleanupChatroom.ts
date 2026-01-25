import loggers from '../middlewares/logger';
import env from '../constants/env';
import ChatRoom from '../models/chatRoom';
import Message from '../models/message';
import { clearCachedMessages } from './messageCache';

const logger = loggers.child('cleanupChatroom');

/**
 * Performs a complete cleanup of a chatroom, including its database record and cached data.
 * This is typically called when a room is explicitly deleted or becomes permanently inactive.
 * 
 * @param {string} chatroomId - The unique ID of the chatroom to clean up.
 * @returns {Promise<void>}
 */
export default async function cleanupChatroom(chatroomId: string) {
  try {
    // Clear Redis cache for chatroom messages
    await clearCachedMessages(chatroomId);

    // Delete messages from separate collection
    await Message.deleteMany({ chatroomId });

    // Delete the chatroom document
    await ChatRoom.deleteOne({ _id: chatroomId });

    logger.info(`Chatroom ${chatroomId} cleaned up: cache cleared and chatroom deleted`);
  } catch (err) {
    logger.error(`Error cleaning up chatroom ${chatroomId}: ${err}`);
    // As a fallback, attempt to at least delete the DB doc
    try {
      await ChatRoom.deleteOne({ _id: chatroomId });
    } catch (e) {
      logger.error(`Fallback delete failed for chatroom ${chatroomId}: ${e}`);
    }
  }
}
