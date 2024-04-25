import { IContent, MatrixEvent, MsgType, NotificationCountType, ReceiptType, Room, RoomEvent } from "matrix-js-sdk";
import { get, Writable, writable } from "svelte/store";
import { ChatMessage, ChatRoom } from "../ChatConnection";
import { MatrixChatMessage } from "./MatrixChatMessage";
import { selectedChatMessageToReply } from "../../Stores/ChatStore";

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
        this.type = this.getMatrixRoomType();
        this.hasUnreadMessages = writable(matrixRoom.getUnreadNotificationCount() > 0);
        this.avatarUrl = matrixRoom.getAvatarUrl(matrixRoom.client.baseUrl, 24, 24, "scale") ?? undefined;
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

    getMatrixRoomType() {
        const dmInviter = this.matrixRoom.getDMInviter();
        if (dmInviter !== undefined) {
            return "direct";
        }
        return this.matrixRoom.getMembers().some((member) => member.getDMInviter() !== undefined)
            ? "direct"
            : "multiple";
    }

    static replayMatrixRoomMessageEvents(matrixRoom: Room): MatrixEvent[] {
        return matrixRoom
            .getLiveTimeline()
            .getEvents()
            .filter((event) => event.getType() === "m.room.message")
            .reduce(replayMessageModifications(), []);

        function replayMessageModifications() {
            return (events: MatrixEvent[], event: MatrixEvent) => {
                const eventRelation = event.getRelation();
                if (eventRelation?.rel_type === "m.replace") {
                    const indexOfEventToReplace = events.findIndex(
                        (eventToReplace) => eventToReplace.getId() === eventRelation.event_id
                    );
                    if (indexOfEventToReplace !== -1) {
                        events[indexOfEventToReplace].getOriginalContent().formatted_body =
                            event.getOriginalContent()["m.new_content"].formatted_body;
                        events[indexOfEventToReplace].getOriginalContent().body =
                            event.getOriginalContent()["m.new_content"].body;
                        return events;
                    }
                }
                return events.concat(event);
            };
        }
    }

    private mapMatrixRoomMessageToChatMessage(matrixRoom: Room): MatrixChatMessage[] {
        return MatrixChatRoom.replayMatrixRoomMessageEvents(matrixRoom).map(
            (event) => new MatrixChatMessage(event, matrixRoom.client, matrixRoom)
        );
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
        function getMessageContent() {
            const selectedChatMessageIDToReply = get(selectedChatMessageToReply)?.id;
            const content: IContent = { body: message, msgtype: MsgType.Text, formatted_body: message };
            if (selectedChatMessageIDToReply !== undefined) {
                content["m.relates_to"] = { "m.in_reply_to": { event_id: selectedChatMessageIDToReply } };
            }
            return content;
        }

        this.matrixRoom.client
            .sendMessage(this.matrixRoom.roomId, getMessageContent())
            .then(() => {
                selectedChatMessageToReply.set(null);
            })
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
