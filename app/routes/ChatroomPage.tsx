import { API_BASE_URL } from 'lib/constants/api';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import ChatroomMenu from '../../components/ChatroomMenu';
import JoinRoomOverlay from '../../components/JoinRoomOverlay';
import MessageDisplay from '../../components/MessageDisplay';
import MessageInput from '../../components/MessageInput';
import ProtectedRoute from "../../components/ProtectedRoute";
import { useAuth } from '../../hooks/useAuth';
import { useChatroom, type ChatroomDetail } from '../../hooks/useChatroom';

/**
 * ChatroomPage component displays the messages within a specific chatroom,
 * allows users to send new messages, and handles joining/leaving the chatroom.
 * It integrates with the `useChatroom` hook for WebSocket communication.
 */
const ChatroomPage: React.FC = () => {
  const { chatroomId } = useParams<{ chatroomId: string }>();
  const navigate = useNavigate();
  const { user, loading, token } = useAuth();
  const [isHost, setIsHost] = useState(false);
  const [chatroomDetail, setChatroomDetails]  = useState<ChatroomDetail|null>(null)

  useEffect(() => {
    const fetchChatroomDetails = async () => {
      if (!chatroomId || !token || !user) return;

      try {
        const response = await fetch(`${API_BASE_URL}/chatroom/${chatroomId}/details`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok && data.data) {
          setChatroomDetails(data.data)
          setIsHost(data.data.hostUserId === user.userId);
        } else {
          console.error("Failed to fetch chatroom details:", data.message);
        }
      } catch (error) {
        console.error("Error fetching chatroom details:", error);
      }
    };

    fetchChatroomDetails();
  }, [chatroomId, token, user]);

  const {
    messages,
    sendMessage,
    joinChatroom,
    leaveChatroom,
    isConnected,
    error,
    currentChatroomId,
  } = useChatroom();

  useEffect(() => {
    if (chatroomId && isConnected && user && currentChatroomId !== chatroomId) {
      joinChatroom(chatroomId);
    }
  }, [chatroomId, isConnected, user, currentChatroomId, joinChatroom]);

  useEffect(() => {
    return () => {
      if (currentChatroomId) {
        leaveChatroom();
      }
    };
  }, [currentChatroomId, leaveChatroom]);

  const handleSendMessage = (content: string) => {
    sendMessage(content);
  };

  if (loading) {
    return <JoinRoomOverlay message="Loading room." />;
  }

  if (!user || !token) {
    return (
      <JoinRoomOverlay
        message="Please log in to view chatrooms."
        replaceLoading={
          <div className="flex space-x-4 mt-4">
            <button
              onClick={() => navigate(`/login?redirect_to=${encodeURIComponent(window.location.pathname)}`)}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Login
            </button>
            <button
              onClick={() => navigate('/register')}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Register
            </button>
          </div>
        }
      />
    );
  }

  if (error && !loading) {
    return <JoinRoomOverlay message={`Error: ${error}`} />;
  }

  if (!isConnected) {
    return <JoinRoomOverlay message="Connecting to chat service..." />;
  }

  if (!currentChatroomId || currentChatroomId !== chatroomId) {
    return <JoinRoomOverlay message="Joining chatroom..." />;
  }

  const handleLeaveRoom = () => {
    leaveChatroom();
    navigate('/'); // Navigate to home or chatroom list after leaving
  };

  const handleDeleteRoom = async () => {
    if (!chatroomId || !token) return;

    if (!window.confirm('Are you sure you want to delete this chatroom? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3000/chatrooms/${chatroomId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        alert('Chatroom deleted successfully!');
        navigate('/'); // Navigate to home or chatroom list after deletion
      } else {
        const errorData = await response.json();
        alert(`Failed to delete chatroom: ${errorData.message}`);
      }
    } catch (error) {
      console.error("Error deleting chatroom:", error);
      alert('An error occurred while deleting the chatroom.');
    }
  };

  return (
    <ProtectedRoute>
      <div className="flex flex-col h-screen bg-gray-100">
        <header className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
          <h1 className="text-2xl font-bold">Chatroom: {chatroomDetail&&chatroomDetail.roomname}</h1>
          <ChatroomMenu
            onLeaveRoom={handleLeaveRoom}
            onRemoveParticipant={() => console.log('Remove participant clicked')}
            onDeleteRoom={handleDeleteRoom}
            isHost={isHost}
          />
        </header>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg, index) => (
            <MessageDisplay key={index} message={msg} />
          ))}
        </div>
        <MessageInput onSendMessage={handleSendMessage} isDisabled={!isConnected || !currentChatroomId} />
      </div>
    </ProtectedRoute>
  );
};

export default ChatroomPage;
