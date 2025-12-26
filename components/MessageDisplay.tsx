import React from 'react';
import { useAuth } from '../hooks/useAuth';
import type { User } from '../types/User';

interface Message {
  id?: string;
  senderId: string;
  senderUsername: string;
  content: string;
  timestamp: string;
}

interface MessageDisplayProps {
  message: Message;
}

/**
 * MessageDisplay component is a presentational component for displaying a single chat message.
 * It styles messages differently based on whether the current user is the sender.
 *
 * @param {MessageDisplayProps} props The props for the component.
 * @param {Message} props.message The message object to display.
 * @returns {React.FC} A React functional component.
 */
const MessageDisplay: React.FC<MessageDisplayProps> = ({ message }) => {
  const { user } = useAuth();
  const isCurrentUser = user && user.userId === message.senderId;

  return (
    <div
      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow ${isCurrentUser ? 'bg-blue-500 text-white' : 'bg-gray-300 text-gray-800'}`}
      >
        <p className="font-semibold">{message.senderUsername}</p>
        <p>{message.content}</p>
        <span className="text-xs opacity-75 mt-1 block">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
};

export default MessageDisplay;
