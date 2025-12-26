import { API_BASE_URL } from "lib/constants/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem('token'); // Assuming token is stored in localStorage
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

export const createChatroom = async (roomname: string, description?: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/chatrooms`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ roomname, description }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to create chatroom');
    }

    return data;
  } catch (error) {
    console.error('Create chatroom error:', error);
    throw error;
  }
};

export const getChatroomMessages = async (chatroomId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/chatrooms/${chatroomId}/messages`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to fetch chatroom messages');
    }

    return data;
  } catch (error) {
    console.error('Get chatroom messages error:', error);
    throw error;
  }
};

export const joinChatroom = async (chatroomId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/chatrooms/${chatroomId}/join`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to join chatroom');
    }

    return data;
  } catch (error) {
    console.error('Join chatroom error:', error);
    throw error;
  }
};

export const leaveChatroom = async (chatroomId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/chatrooms/${chatroomId}/leave`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to leave chatroom');
    }

    return data;
  } catch (error) {
    console.error('Leave chatroom error:', error);
    throw error;
  }
};

export const deleteChatroom = async (chatroomId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/chatrooms/${chatroomId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete chatroom');
    }

    return data;
  } catch (error) {
    console.error('Delete chatroom error:', error);
    throw error;
  }
};

export const deleteMessage = async (chatroomId: string, messageId: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/chatrooms/${chatroomId}/messages/${messageId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to delete message');
    }

    return data;
  } catch (error) {
    console.error('Delete message error:', error);
    throw error;
  }
};

export const getChatroomListSSE = (onMessage: (data: any) => void, onError: (event: Event) => void) => {
  const eventSource = new EventSource(`${API_BASE_URL}/chatrooms`);

  eventSource.onmessage = (event) => {
    onMessage(JSON.parse(event.data));
  };

  eventSource.onerror = (event) => {
    console.error('EventSource error:', event);
    eventSource.close();
    onError(event);
  };

  return () => {
    eventSource.close();
  };
};