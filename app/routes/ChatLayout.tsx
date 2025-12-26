import React from 'react';
import { Outlet } from 'react-router-dom'; // Assuming you are using react-router-dom
import ChatroomListPage from '~/routes/ChatroomListPage';
import NoChatSelectedFallback from '../../components/NoChatSelectedFallback';

const ChatLayout: React.FC = () => {
  return (
    <div className="flex h-screen">
      {/* Left Column: Chatroom List */}
      <div className="w-1/3 border-r border-gray-200 overflow-y-auto">
        <ChatroomListPage />
      </div>

      {/* Right Column: Chatroom View or Fallback */}
      <div className="w-2/3 flex flex-col">
        {/* Outlet will render the matched child route component (e.g., ChatroomPage) */}
        <Outlet />
      </div>
    </div>
  );
};

export default ChatLayout;