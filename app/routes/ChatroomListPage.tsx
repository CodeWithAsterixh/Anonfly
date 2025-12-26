import React from "react";
import { useChatroomList } from "../../hooks/useChatroomList";
import ChatroomCard from "../../components/ChatroomCard";
import ProtectedRoute from "../../components/ProtectedRoute";
import { useNavigate } from "react-router"; // Import useNavigate

const ChatroomListPage: React.FC = () => {
  const { chatrooms, loading, error } = useChatroomList();
  const navigate = useNavigate(); // Initialize navigate

  const handleChatroomClick = (chatroomId: string) => {
    navigate(`/${chatroomId}`); // Navigate to the specific chatroom
  };

  return (
    <ProtectedRoute>
      <div className="p-4 size-full">
        {" "}
        {/* Removed container mx-auto and min-h-screen */}
        <h1 className="text-2xl font-bold mb-4 text-left border-b-gray-400 border-b-2">
          Chats
        </h1>{" "}
        {/* Adjusted heading size */}
        <div className="space-y-2">
          {" "}
          {/* Changed grid to space-y for a list-like appearance */}
          {loading ? (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <p className="text-lg text-gray-700">Loading chatrooms...</p>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full bg-gray-100">
              <p className="text-lg text-red-600">Error: {error}</p>
            </div>
          ) : chatrooms.length === 0 ? (
            <p className="text-center text-gray-600">
              No chatrooms available. Create one!
            </p>
          ) : (
            chatrooms.map((room) => (
              <div
                key={room.id}
                onClick={() => handleChatroomClick(room.id)}
                className="cursor-pointer"
              >
                <ChatroomCard
                  id={room.id}
                  roomname={room.roomname}
                  description={room.description || ""}
                  participantCount={room.participantCount}
                  lastMessage={room.lastMessage}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
};

export default ChatroomListPage;
