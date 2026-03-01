import { EventEmitter } from "events";
import { IEventEmitter } from "../IEventEmitter";

export class LocalEventEmitter implements IEventEmitter {
    private emitter = new EventEmitter();

    emit(event: string, data: any): void {
        this.emitter.emit(event, data);
    }

    on(event: string, callback: (data: any) => void): void {
        this.emitter.on(event, callback);
    }
}
