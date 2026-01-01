import withErrorHandling from "../../../lib/middlewares/withErrorHandling";
import ChatRoom from "../../../lib/models/chatRoom";
import type { RouteConfig, RouteEvent } from '../../../types/index.d';
import { verifyToken } from "../../../lib/middlewares/verifyToken";
import { getPermissionsByUserId } from "../../../lib/helpers/permissionHelper";

const getChatroomDetailsRoute: Omit<RouteConfig, 'app'>  = {
  method: "get",
  path: "/chatroom/:chatroomId/details",
  middleware: [verifyToken],
  handler: withErrorHandling(async (event: RouteEvent) => {
    const { chatroomId } = event.req.params;
    const userAid = (event.req as any)?.userAid;

    const chatroom = await ChatRoom.findById(chatroomId).select(
      "roomname description hostAid participants isLocked"
    );

    if (!chatroom) {
      return {
        message: "Chatroom not found",
        statusCode: 404,
        success: false,
        status: "bad",
      };
    }

    let allowedFeatures: string[] = [];
    if (userAid === chatroom.hostAid) {
      const permission = await getPermissionsByUserId(userAid);
      if (permission) {
        allowedFeatures = permission.allowedFeatures;
      }
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
        hostAid: chatroom.hostAid,
        isLocked: chatroom.isLocked || false,
        participantCount: chatroom.participants.filter(p => !p.leftAt).length,
        allowedFeatures, // Only populated for the host
        participants: chatroom.participants.filter(p => !p.leftAt).map((p) => ({
          userAid: p.userAid,
          username: p.username,
          publicKey: p.publicKey,
          exchangePublicKey: p.exchangePublicKey,
        })),
      },
    };
  }),
};

export default getChatroomDetailsRoute;
