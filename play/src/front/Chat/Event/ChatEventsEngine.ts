import { Subject } from "rxjs";
import { ChatRoom, ChatUser } from "../Connection/ChatConnection";

export class ChatEventsEngine {
    private _userUpdateMessageStream = new Subject<ChatUser>();
    public userUpdateMessageStream = this._userUpdateMessageStream.asObservable();
    private _roomUpdateMessageStream = new Subject<ChatRoom>();
    public roomUpdateMessageStream = this._roomUpdateMessageStream.asObservable();

    public emitUserUpdateEvent(user: ChatUser) {
        this._userUpdateMessageStream.next(user);
    }

    public emitRoomUpdateEvent(room: ChatRoom) {
        this._roomUpdateMessageStream.next(room);
    }
}

export const chatEventsEngineInstance = new ChatEventsEngine();
