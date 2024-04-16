import { MsgType, NotificationCountType, ReceiptType, Room, RoomEvent } from "matrix-js-sdk";
import { Writable, writable } from "svelte/store";
import { ChatMessage, ChatRoom } from "../ChatConnection";

export class MatrixChatRoom implements ChatRoom {
    id!: string;
    name!: Writable<string>;
    type!: "multiple" | "direct";
    hasUnreadMessages: Writable<boolean>;
    avatarUrl: string | undefined;
    messages!: Writable<ChatMessage[]>;
    isInvited!: boolean;

    constructor(private matrixRoom: Room) {
        this.id = matrixRoom.roomId;
        this.name = writable(matrixRoom.name);
        this.type = matrixRoom.getDMInviter() ? "direct" : "multiple";
        this.hasUnreadMessages = writable(matrixRoom.getUnreadNotificationCount() > 0);
        this.avatarUrl = matrixRoom.getAvatarUrl("/", 23, 34, "scale") ?? undefined;
        this.messages = writable(this.mapMatrixRoomMessageToChatMessage(matrixRoom));
        this.sendMessage = this.sendMessage.bind(this);
        this.isInvited = matrixRoom.hasMembershipState(matrixRoom.myUserId, "invite");
        this.startHandlingChatRoomEvents();
    }

    startHandlingChatRoomEvents() {
        this.matrixRoom.on(RoomEvent.Timeline, (_, room) => {
            if (room !== undefined) {
                this.hasUnreadMessages.set(room.getUnreadNotificationCount() > 0);
                this.messages.set(this.mapMatrixRoomMessageToChatMessage(room));
            }
        });
        this.matrixRoom.on(RoomEvent.Name, (room) => {
            this.name.set(room.name);
        });
    }

    private mapMatrixRoomMessageToChatMessage(matrixRoom: Room): ChatMessage[] {
        return matrixRoom
            .getLiveTimeline()
            .getEvents()
            .filter((event) => event.getType() === "m.room.message")
            .map((event, index) => ({
                id: event.getId() ?? index.toString(),
                userId: event.getSender() ?? index.toString(),
                content: event.getContent().body,
                isMyMessage: this.matrixRoom.myUserId === event.getSender(),
                date: event.getDate(),
            }));
    }

    setTimelineAsRead() {
        this.matrixRoom.setUnreadNotificationCount(NotificationCountType.Highlight, 0);
        this.matrixRoom.setUnreadNotificationCount(NotificationCountType.Total, 0);
        this.hasUnreadMessages.set(false);
        //TODO check doc with liveEvent
        this.matrixRoom.client
            .sendReadReceipt(this.matrixRoom.getLastLiveEvent() ?? null, ReceiptType.Read)
            .catch((error) => console.error(error));
    }

    sendMessage(message: string) {
        this.matrixRoom.client
            .sendMessage(this.matrixRoom.roomId, { body: message, msgtype: MsgType.Text })
            .catch((error) => {
                console.error(error);
            });
    }

    joinRoom(): void {
        this.matrixRoom.client.joinRoom(this.id).catch((error) => console.error("Unable to join", error));
    }

    leaveRoom(): void {
        this.matrixRoom.client.leave(this.id).catch((error) => console.error("Unable to leave", error));
    }
}
