import { Room, RoomEvent } from "matrix-js-sdk";
import merge from "lodash/merge";
import { ChatRoom } from "../ChatConnection";
import { chatEventsEngineInstance } from "../../Event/ChatEventsEngine";

export class MatrixChatRoom implements ChatRoom {
    id!: string;
    name!: string;
    type!: string;
    hasUnreadMessages: boolean | undefined;

    constructor(private matrixRoom: Room, private chatEventsEngine = chatEventsEngineInstance) {
        merge(this, this.mapMatrixRoomToChatRoom(matrixRoom));
        this.startHandlingChatRoomEvents();
    }

    startHandlingChatRoomEvents() {
        this.matrixRoom.on(RoomEvent.Receipt, (_, room) => {
            console.debug("Room receipt : ", room);
            this.chatEventsEngine.emitRoomUpdateEvent(this.mapMatrixRoomToChatRoom(room));
        });
    }

    mapMatrixRoomToChatRoom(matrixRoom: Room): ChatRoom {
        return {
            id: matrixRoom.roomId,
            name: matrixRoom.name,
            type: matrixRoom.getType() ?? "",
            hasUnreadMessages: matrixRoom.hasThreadUnreadNotification(),
        };
    }
}
