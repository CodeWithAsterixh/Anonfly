import withErrorHandling from "../../../lib/middlewares/withErrorHandling";
import ChatRoom from "../../../lib/models/chatRoom";
import type { RouteConfig, RouteEvent } from '../../../types/index.d';
import { verifyToken } from "../../../lib/middlewares/verifyToken";
import { validateJoinAuthToken } from "../../../lib/helpers/crypto";

const checkAccessRoute: Omit<RouteConfig, 'app'> = {
  method: "post",
  path: "/chatroom/:chatroomId/check-access",
  middleware: [verifyToken],
  handler: withErrorHandling(async (event: RouteEvent) => {
    const { chatroomId } = event.req.params;
    const { joinAuthToken } = event.req.body;
    const userAid = (event.req as any)?.userAid;

    if (!userAid) {
      return { message: "Unauthorized", statusCode: 401, success: false, status: "bad" };
    }

    const chatroom = await ChatRoom.findById(chatroomId).select("creatorAid participants isPrivate isLocked");
    if (!chatroom) {
      return { message: "Chatroom not found", statusCode: 404, success: false, status: "bad" };
    }

    const isCreator = chatroom.creatorAid === userAid;
    const isParticipant = chatroom.participants.some(p => p.userAid === userAid && !p.leftAt);

    // 1. If they are already a participant or the creator, access is granted
    if (isCreator || isParticipant) {
      return {
        message: "Access granted",
        statusCode: 200,
        success: true,
        status: "good",
        data: { accessGranted: true, roomId: chatroomId }
      };
    }

    // 2. If they have a valid join authorization token (issued via validate-link)
    if (joinAuthToken && validateJoinAuthToken(joinAuthToken, chatroomId, userAid)) {
      return {
        message: "Access granted via token",
        statusCode: 200,
        success: true,
        status: "good",
        data: { accessGranted: true, roomId: chatroomId }
      };
    }

    // 3. If it's a public room (not private), we allow access to the room page 
    // so they can see the join screen/prompt.
    if (!chatroom.isPrivate) {
       return {
        message: "Access granted (public room)",
        statusCode: 200,
        success: true,
        status: "good",
        data: { accessGranted: true, roomId: chatroomId }
      };
    }

    // 4. Otherwise, for private rooms, access is denied without a valid link
    return {
      message: "This is a private room. You need a valid invite link to join.",
      statusCode: 403,
      success: false,
      status: "bad",
      data: { accessGranted: false }
    };
  }),
};

export default checkAccessRoute;
