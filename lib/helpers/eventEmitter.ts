import { EventEmitter } from 'events';

class ChatEventEmitter extends EventEmitter {}

const chatEventEmitter = new ChatEventEmitter();

export default chatEventEmitter;
