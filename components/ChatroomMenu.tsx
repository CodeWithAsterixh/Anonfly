import React, { useState } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { EllipsisVerticalIcon } from 'lucide-react';

interface ChatroomMenuProps {
  onLeaveRoom: () => void;
  onRemoveParticipant: () => void; // This will need to be more complex later
  onDeleteRoom: () => void;
  isHost: boolean;
}

const ChatroomMenu: React.FC<ChatroomMenuProps> = ({
  onLeaveRoom,
  onRemoveParticipant,
  onDeleteRoom,
  isHost,
}) => {
  return (
    <Menu as="div" className="relative inline-block text-left">
      <div>
        <Menu.Button className="inline-flex w-full justify-center gap-x-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">
          <EllipsisVerticalIcon className="-mr-1 h-5 w-5 text-white" aria-hidden="true" />
        </Menu.Button>
      </div>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
          <div className="py-1">
            <Menu.Item>
              {({ active }) => (
                <button
                  onClick={onLeaveRoom}
                  className={`block px-4 py-2 text-sm ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}`}
                >
                  Leave Room
                </button>
              )}
            </Menu.Item>
            {isHost && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onRemoveParticipant}
                    className={`block px-4 py-2 text-sm ${active ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}`}
                  >
                    Remove Participant
                  </button>
                )}
              </Menu.Item>
            )}
            {isHost && (
              <Menu.Item>
                {({ active }) => (
                  <button
                    onClick={onDeleteRoom}
                    className={`block px-4 py-2 text-sm text-red-700 ${active ? 'bg-red-100' : ''}`}
                  >
                    Delete Room
                  </button>
                )}
              </Menu.Item>
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
};

export default ChatroomMenu;
