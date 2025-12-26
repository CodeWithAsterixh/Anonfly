import React from 'react';
import { useNavigate } from 'react-router';

interface ChatroomCardProps {
  id: string;
  roomname: string;
  description: string;
  participantCount: number;
  lastMessage: string | null;
}

/**
 * ChatroomCard component displays a single chatroom's information.
 * It is a presentational component that can navigate to the chatroom details page on click.
 *
 * @param {ChatroomCardProps} props - The props for the ChatroomCard component.
 * @param {string} props.id - The unique identifier of the chatroom.
 * @param {string} props.roomname - The name of the chatroom.
 * @param {string} props.description - A brief description of the chatroom.
 * @param {number} props.participantCount - The number of participants in the chatroom.
 * @param {string | null} props.lastMessage - The content of the last message in the chatroom, or null if none.
 */
const ChatroomCard: React.FC<ChatroomCardProps> = ({
  id,
  roomname,
  description,
  participantCount,
  lastMessage,
}) => {
  const navigate = useNavigate();

  return (
    <div
      className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={() => navigate(`/${id}`)}
    >
      <h2 className="text-xl font-semibold mb-2">{roomname}</h2>
      <p className="text-gray-600 mb-4">{description || 'No description provided.'}</p>
      <div className="flex justify-between items-center text-sm text-gray-500">
        <span>Participants: {participantCount}</span>
        {lastMessage && (
          <span className="italic">Last message: "{lastMessage}"</span>
        )}
      </div>
    </div>
  );
};

export default ChatroomCard;
