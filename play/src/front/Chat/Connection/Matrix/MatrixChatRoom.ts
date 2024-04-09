import { Room, RoomEvent } from "matrix-js-sdk";
import merge from "lodash/merge";
import { ChatRoom } from "../ChatConnectionInterface";

export class MatrixChatRoom implements ChatRoom {
    id!: string;
    name!: string;
    type!: string;
    hasUnreadMessages: boolean | undefined;

    constructor(private matrixRoom: Room, private handleRoomEvent: (room: ChatRoom) => void) {
        merge(this, this.mapMatrixRoomToChatRoom(matrixRoom));
        this.startHandlingChatRoomEvents();
    }

    startHandlingChatRoomEvents() {
        this.matrixRoom.on(RoomEvent.Receipt, (event, room) => {
            console.debug("Room receipt : ", room);
            this.handleRoomEvent(this.mapMatrixRoomToChatRoom(room));
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
