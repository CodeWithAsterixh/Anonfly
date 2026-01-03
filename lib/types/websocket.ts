import { WebSocket } from 'ws';

export interface CustomWebSocket extends WebSocket {
  id: string;
  isAlive: boolean;
  userAid?: string; // Anonymous Identity
  chatroomId?: string; 
  username?: string; 
  allowedFeatures?: string[];
  joinedAt?: Date;
  syncing?: boolean; 
  messageQueue?: any[]; 
}
