import { MsgType, NotificationCountType, ReceiptType, Room, RoomEvent } from "matrix-js-sdk";
import merge from "lodash/merge";
import { ChatMessage, ChatRoom } from "../ChatConnection";
import { chatEventsEngineInstance } from "../../Event/ChatEventsEngine";

export class MatrixChatRoom implements ChatRoom {
    id!: string;
    name!: string;
    type!: "multiple" | "direct";
    hasUnreadMessages: boolean | undefined;
    avatarUrl: string | undefined;
    messages!: ChatMessage[];

    constructor(private matrixRoom: Room, private chatEventsEngine = chatEventsEngineInstance) {
        merge(this, this.mapMatrixRoomToChatRoom(matrixRoom));
        this.startHandlingChatRoomEvents();
    }

    startHandlingChatRoomEvents() {
        this.matrixRoom.on(RoomEvent.Timeline, (_, room) => {
            if (room !== undefined) {
                this.chatEventsEngine.emitRoomUpdateEvent({
                    ...this,
                    hasUnreadMessages: room.getUnreadNotificationCount() > 0,
                    messages: this.mapMatrixRoomMessageToChatMessage(room),
                });
            }
        });
    }

    mapMatrixRoomToChatRoom(matrixRoom: Room): ChatRoom {
        return {
            id: matrixRoom.roomId,
            name: matrixRoom.name,
            type: matrixRoom.getDMInviter() ? "direct" : "multiple",
            hasUnreadMessages: matrixRoom.getUnreadNotificationCount() > 0,
            avatarUrl: matrixRoom.getAvatarUrl("/", 23, 34, "scale") ?? undefined,
            messages: this.mapMatrixRoomMessageToChatMessage(matrixRoom),
            setTimelineAsRead: this.setTimelineAsRead.bind(this),
            sendMessage: this.sendMessage.bind(this),
        };
    }

    private mapMatrixRoomMessageToChatMessage(matrixRoom: Room): ChatMessage[] {
        return matrixRoom
            .getLiveTimeline()
            .getEvents()
            .map((event, index) => ({
                id: event.getId() ?? index.toString(),
                userId: event.getSender() ?? index.toString(),
                content: event.getContent().body,
                isMyMessage: this.matrixRoom.client.getUserId() === event.getSender(),
                date: event.getDate(),
            }));
    }

    setTimelineAsRead() {
        this.matrixRoom.setUnreadNotificationCount(NotificationCountType.Highlight, 0);
        this.matrixRoom.setUnreadNotificationCount(NotificationCountType.Total, 0);
        this.chatEventsEngine.emitRoomUpdateEvent({ ...this, hasUnreadMessages: 0 });
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
}
