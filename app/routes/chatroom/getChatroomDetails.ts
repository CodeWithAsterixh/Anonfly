import withErrorHandling from "../../../lib/middlewares/withErrorHandling.ts";
import ChatRoom from "../../../lib/models/chatRoom.ts";
import type { RouteConfig, RouteEvent } from '../../../types/index.d.ts';

const getChatroomDetailsRoute: Omit<RouteConfig, 'app'>  = {
  method: "get",
  path: "/chatroom/:chatroomId/details",
  handler: withErrorHandling(async (event: RouteEvent) => {
    const { chatroomId } = event.req.params;

    const chatroom = await ChatRoom.findById(chatroomId).select(
      "roomname description hostUserId participants"
    );

    if (!chatroom) {
      return {
        message: "Chatroom not found",
        statusCode: 404,
        success: false,
        status: "bad",
      };
    }

    return {
      message: "Chatroom details fetched successfully",
      statusCode: 200,
      success: true,
      status: "good",
      data: {
        roomId: chatroom._id,
        roomname: chatroom.roomname,
        description: chatroom.description,
        hostUserId: chatroom.hostUserId,
        participants: chatroom.participants.map((p) => ({
          userId: p.userId,
          username: p.username,
        })),
      },
    };
  }),
};

export default getChatroomDetailsRoute;
