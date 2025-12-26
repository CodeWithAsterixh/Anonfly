import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './useAuth';
import { CHAT_WS_URL } from '../lib/constants/api';

interface Message {
  id?: string;
  senderId: string;
  senderUsername: string;
  content: string;
  timestamp: string;
}

interface UseChatroomReturn {
  messages: Message[];
  sendMessage: (content: string) => void;
  joinChatroom: (chatroomId: string) => void;
  leaveChatroom: () => void;
  isConnected: boolean;
  error: string | null;
  currentChatroomId: string | null;
}

/**
 * Custom hook for managing chatroom state and WebSocket communication.
 * Integrates with websocketController.ts for joining, leaving, and sending messages.
 * Handles real-time message updates and connection status.
 *
 * @returns {UseChatroomReturn} An object containing chatroom state and functions.
 */
export const useChatroom = (): UseChatroomReturn => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentChatroomId, setCurrentChatroomId] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const { user, token, loading } = useAuth();

  const currentChatroomIdRef = useRef(currentChatroomId);
  useEffect(() => {
    currentChatroomIdRef.current = currentChatroomId;
  }, [currentChatroomId]);

  const connect = useCallback(() => {
    if (!token || loading) { // Only connect if token is available and auth is not loading
      if (!loading) { // Only set error if not loading, otherwise it's a transient state
        setError('Authentication token not found or still loading.');
      }
      return;
    }

    // Ensure previous WebSocket connection is closed before opening a new one
    if (ws.current) {
      ws.current.close();
    }

    const websocketUrl = `${CHAT_WS_URL}?token=${token}`;
    ws.current = new WebSocket(websocketUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      setError(null);
      console.log('WebSocket connected.');
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'joinSuccess':
          console.log(`Successfully joined chatroom: ${message.chatroomId}`);
          setCurrentChatroomId(message.chatroomId);
          setMessages([]); // Clear messages on joining a new room
          break;
        case 'chatMessage':
          setMessages((prevMessages) => [...prevMessages, {
            id: message.messageId,
            senderId: message.senderId,
            senderUsername: message.senderUsername,
            content: message.content,
            timestamp: message.timestamp,
          }]);
          break;
        case 'leaveSuccess':
          console.log(`Successfully left chatroom: ${message.chatroomId}`);
          setCurrentChatroomId(null);
          setMessages([]); // Clear messages on leaving a room
          break;
        case 'messageDeleted':
          setMessages((prevMessages) => prevMessages.filter(msg => msg.id !== message.messageId));
          break;
        case 'error':
          setError(message.message);
          console.error('WebSocket error from server:', message.message);
          break;
        default:
          console.log('Unknown message type:', message.type);
      }
    };
    console.log('WebSocket onmessage handler set.');

    ws.current.onclose = (event) => {
      console.log('WebSocket disconnected. Event:', event);
      setIsConnected(false);
      if (currentChatroomIdRef.current) {
        console.log('Attempting to reconnect...');
        setTimeout(connect, 3000);
      }
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('WebSocket connection error.');
    };

    return () => {
      ws.current?.close();
    };
  }, [token]);

  useEffect(() => {
    connect();
  }, [connect]);

  const sendMessage = useCallback((content: string) => {
    if (ws.current?.readyState === WebSocket.OPEN && currentChatroomId && user) {
      ws.current.send(JSON.stringify({
        type: 'message',
        chatroomId: currentChatroomId,
        content,
      }));
    } else {
      setError('Cannot send message: Not connected or not in a chatroom.');
    }
  }, [currentChatroomId, user]);

  const joinChatroom = useCallback((chatroomId: string) => {
    if (!user && !loading) {
      setError('Cannot join chatroom: User not authenticated.');
      return;
    }
    if (ws.current?.readyState === WebSocket.OPEN && user) {
      ws.current.send(JSON.stringify({
        type: 'joinChatroom',
        chatroomId,
        userId: user.userId,
        username: user.username,
      }));
    }
  }, [user]);

  const leaveChatroom = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN && currentChatroomId) {
      ws.current.send(JSON.stringify({
        type: 'leaveChatroom',
        chatroomId: currentChatroomId,
      }));
    } else {
      setError('Cannot leave chatroom: Not connected or not in a chatroom.');
    }
  }, [currentChatroomId]);

  return {
    messages,
    sendMessage,
    joinChatroom,
    leaveChatroom,
    isConnected,
    error,
    currentChatroomId,
  };
};


import { useNavigate } from "react-router";
import { CHATROOM_API_BASE_URL } from "../lib/constants/api";

interface Participant {
  userId: string;
  username: string;
}

export interface ChatroomDetail {
  roomId: string;
  roomname: string;
  description: string;
  hostUserId: string;
  participants: Participant[];
}

interface UseChatroomDetailReturn {
  chatroom: ChatroomDetail | null;
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to subscribe to a single chatroom's details using SSE.
 * Provides real-time updates for room metadata and participants.
 */
// export const useChatroomDetail = (
//   chatroomId: string
// ): UseChatroomDetailReturn => {
//   const [chatroom, setChatroom] = useState<ChatroomDetail | null>(null);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [error, setError] = useState<string | null>(null);

//   const { token, loading: loadingAuth } = useAuth();
//   const navigate = useNavigate();

//   useEffect(() => {
//     if (!chatroomId) return;

//     if (!token && !loadingAuth) {
//       setError("Authentication token not found.");
//       setLoading(false);
//       navigate("/login");
//       return;
//     }

//     setLoading(true);
//     setError(null);

//     const eventSource = new EventSource(
//       `${CHATROOM_API_BASE_URL}/${chatroomId}`,
//       {
//         headers: {
//           Authorization: `Bearer ${token}`,
//         },
//       } as EventSourceInit
//     );

//     // Default SSE message
//     eventSource.onmessage = (event) => {
//       const data = JSON.parse(event.data);
//       setChatroom(data);
//       setLoading(false);
//     };

//     // Custom error event sent by your API
//     eventSource.addEventListener("error", (event: MessageEvent) => {
//       try {
//         const data = JSON.parse(event.data);
//         setError(data.message ?? "Failed to load chatroom.");
//       } catch {
//         setError("Failed to load chatroom.");
//       }
//       setLoading(false);
//     });

//     eventSource.onerror = (err) => {
//       console.error("SSE connection error:", err);
//       setError("Connection to chatroom updates lost.");
//       setLoading(false);
//       eventSource.close();
//     };

//     return () => {
//       eventSource.close();
//     };
//   }, [chatroomId, token, loadingAuth, navigate]);

//   return { chatroom, loading, error };
// };

