import { Room, RoomEvent } from "matrix-js-sdk";
import { ChatRoom } from "../ChatConnectionInterface";

export class MatrixChatRoom implements ChatRoom {
    id: string;
    name: string;
    type: string;
    constructor(private matrixRoom: Room) {
        this.id = matrixRoom.roomId;
        this.name = matrixRoom.name;
        this.type = matrixRoom.getType() ?? "";
        this.startHandlingChatRoomEvents();
    }

    startHandlingChatRoomEvents() {
        this.matrixRoom.on(RoomEvent.Receipt, (event, room) => {
            console.debug("UserEvent presence : ", event.getContent());
        });
    }
}
