import pino from 'pino';
import getDbConnection from '../lib/handlers/getDbConnection';
import ChatRoom from '../lib/models/chatRoom';
import Message from '../lib/models/message';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

async function migrate() {
  logger.info('Starting migration...');

  try {
    // Ensure connection is open
    getDbConnection();
    // Wait for connection to be ready if needed, or just proceed as models use it.
    
    // We need to use the raw collection for ChatRoom because the schema might strip 'messages' field if we use the model directly 
    // BUT since we just removed 'messages' from schema, Mongoose might not load it into the document if we query it.
    // So we should use `lean()` and maybe we need to bypass schema or use raw driver if Mongoose strips it.
    // However, if the field exists in DB but not in Schema, Mongoose `strict: false` or `lean()` might keep it.
    // Let's assume we can get it via `lean()`.

    const chatrooms = await ChatRoom.find({}).lean();
    logger.info(`Found ${chatrooms.length} chatrooms.`);

    for (const room of chatrooms) {
      logger.info(`Processing room: ${room.roomname} (${room._id})`);
      
      // Access messages from the raw document. Typescript might complain, so casting to any.
      const messages = (room as any).messages;

      if (!messages || messages.length === 0) {
        logger.info(`No messages in room ${room.roomname}. Skipping.`);
        continue;
      }

      logger.info(`Migrating ${messages.length} messages...`);

      let sequenceId = 1;
      let lastMessageInfo = undefined;

      // Sort messages by timestamp to ensure sequence order
      messages.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      for (const msg of messages) {
        const newMessage = new Message({
          chatroomId: room._id,
          senderAid: msg.senderAid,
          senderUsername: msg.senderUsername || 'Anonymous', // Fallback
          content: msg.content,
          signature: msg.signature,
          timestamp: msg.timestamp,
          sequenceId: sequenceId,
          isEdited: msg.isEdited || false,
          isDeleted: msg.isDeleted || false,
          replies: msg.replies || [],
          reactions: msg.reactions || [],
          replyTo: msg.replyTo
        });

        await newMessage.save();
        lastMessageInfo = {
          content: msg.content,
          senderUsername: msg.senderUsername || 'Anonymous',
          timestamp: msg.timestamp
        };
        sequenceId++;
      }

      // Update ChatRoom
      await ChatRoom.updateOne(
        { _id: room._id },
        { 
          $set: { 
            messageSequenceCounter: sequenceId - 1,
            lastMessage: lastMessageInfo
          },
          $unset: { messages: "" } 
        }
      );

      logger.info(`Completed migration for room ${room.roomname}.`);
    }

    logger.info('Migration completed successfully.');
  } catch (err) {
    logger.error(`Migration failed: ${err}`);
  } finally {
    process.exit(0);
  }
}

migrate();
