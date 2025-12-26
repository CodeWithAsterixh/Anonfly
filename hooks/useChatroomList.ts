import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CHATROOM_API_BASE_URL } from '../lib/constants/api';
import { useAuth } from './useAuth';

interface Chatroom {
  id: string;
  roomname: string;
  description: string;
  hostUserId: string;
  participantCount: number;
  lastMessage: string | null;
}

interface UseChatroomListReturn {
  chatrooms: Chatroom[];
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook to fetch and manage the list of chatrooms using Server-Sent Events (SSE).
 * It provides real-time updates to the chatroom list.
 *
 * @returns {UseChatroomListReturn} An object containing the list of chatrooms, loading state, and error state.
 */
export const useChatroomList = (): UseChatroomListReturn => {
  const [chatrooms, setChatrooms] = useState<Chatroom[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { token, loading:loadingAuth } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token && !loadingAuth) {
      setError("Authentication token not found.");
      setLoading(false);
      navigate("/login");
      return;
    }

    setLoading(true);
    setError(null);

    const eventSource = new EventSource(`${CHATROOM_API_BASE_URL}/`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    } as EventSourceInit);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setChatrooms(data);
      setLoading(false);
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed:", err);
      setError("Failed to load chatrooms.");
      setLoading(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, [token]);

  return { chatrooms, loading, error };
};
