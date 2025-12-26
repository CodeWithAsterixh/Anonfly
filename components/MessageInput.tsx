import React, { useState } from 'react';

interface MessageInputProps {
  onSendMessage: (content: string) => void;
  isDisabled: boolean;
}

/**
 * MessageInput component provides an input field and a send button for chat messages.
 * It handles the local state of the input and calls a callback function when a message is sent.
 *
 * @param {MessageInputProps} props The props for the component.
 * @param {(content: string) => void} props.onSendMessage Callback function to send the message.
 * @param {boolean} props.isDisabled Flag to disable the input and button.
 * @returns {React.FC} A React functional component.
 */
const MessageInput: React.FC<MessageInputProps> = ({ onSendMessage, isDisabled }) => {
  const [messageInput, setMessageInput] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim()) {
      onSendMessage(messageInput);
      setMessageInput('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 border-t border-gray-200 flex items-center">
      <input
        type="text"
        value={messageInput}
        onChange={(e) => setMessageInput(e.target.value)}
        placeholder="Type your message..."
        className="flex-1 text-black border border-gray-300 rounded-lg p-2 mr-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        disabled={isDisabled}
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        disabled={isDisabled || !messageInput.trim()}
      >
        Send
      </button>
    </form>
  );
};

export default MessageInput;
