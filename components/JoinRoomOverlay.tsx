import React from "react";

interface JoinRoomOverlayProps {
  message: string;
  replaceLoading?: React.ReactNode;
}

/**
 * JoinRoomOverlay component displays a blocking overlay with a message.
 * This is used to indicate loading states or when a user needs to perform an action before proceeding.
 */
const JoinRoomOverlay: React.FC<JoinRoomOverlayProps> = ({
  message,
  replaceLoading,
}) => {
  return (
    <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg text-center">
        <p className="text-lg font-semibold text-gray-800">{message}</p>
        {replaceLoading ? (
          replaceLoading
        ) : (
          <div className="mt-4 animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
        )}
      </div>
    </div>
  );
};

export default JoinRoomOverlay;
