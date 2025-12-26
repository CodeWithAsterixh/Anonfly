import React from 'react';

const NoChatSelectedFallback: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-full bg-gray-50 text-gray-500">
      <p className="text-lg">Select a chat from the list to view the conversation.</p>
    </div>
  );
};

export default NoChatSelectedFallback;