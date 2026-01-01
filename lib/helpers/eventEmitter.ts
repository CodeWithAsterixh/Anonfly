import { EventEmitter } from 'events';

class ChatEventEmitter extends EventEmitter {
  constructor() {
    super();
    // Increase the limit to handle many concurrent chatroom participants
    this.setMaxListeners(100);
  }
}

const chatEventEmitter = new ChatEventEmitter();

export default chatEventEmitter;
