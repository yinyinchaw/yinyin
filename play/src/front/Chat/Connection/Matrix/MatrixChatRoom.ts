import { IContent, MatrixEvent, MsgType, NotificationCountType, ReceiptType, Room, RoomEvent } from "matrix-js-sdk";
import { get, Writable, writable } from "svelte/store";
import { MediaEventContent, MediaEventInfo } from "matrix-js-sdk/lib/@types/media";
import { ChatMessage, ChatRoom } from "../ChatConnection";
import { KnownMembership } from "matrix-js-sdk/lib/@types/membership";
import { MatrixChatMessage } from "./MatrixChatMessage";

export class MatrixChatRoom implements ChatRoom {
    id!: string;
    name!: Writable<string>;
    type!: "multiple" | "direct";
    hasUnreadMessages: Writable<boolean>;
    avatarUrl: string | undefined;
    messages!: Writable<ChatMessage[]>;
    isInvited!: boolean;
    membersId: string[];

    constructor(private matrixRoom: Room) {
        this.id = matrixRoom.roomId;
        this.name = writable(matrixRoom.name);
        this.type = this.getMatrixRoomType();
        this.hasUnreadMessages = writable(matrixRoom.getUnreadNotificationCount() > 0);
        this.avatarUrl = matrixRoom.getAvatarUrl(matrixRoom.client.baseUrl, 24, 24, "scale") ?? undefined;
        this.messages = writable(this.mapMatrixRoomMessageToChatMessage(matrixRoom));
        this.sendMessage = this.sendMessage.bind(this);
        this.isInvited = matrixRoom.hasMembershipState(matrixRoom.myUserId, "invite");
        this.membersId = [
            ...matrixRoom.getMembersWithMembership(KnownMembership.Invite).map((member) => member.userId),
            ...matrixRoom.getMembersWithMembership(KnownMembership.Join).map((member) => member.userId),
        ];
        this.startHandlingChatRoomEvents();
    }

    startHandlingChatRoomEvents() {
        this.matrixRoom.on(RoomEvent.Timeline, (_, room) => {
            if (room !== undefined) {
                this.hasUnreadMessages.set(room.getUnreadNotificationCount() > 0);
                this.messages.set(this.mapMatrixRoomMessageToChatMessage(room));
                this.membersId = [
                    ...room.getMembersWithMembership(KnownMembership.Invite).map((member) => member.userId),
                    ...room.getMembersWithMembership(KnownMembership.Join).map((member) => member.userId),
                ];
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
        this.matrixRoom.client
            .sendMessage(this.matrixRoom.roomId, this.getMessageContent(message))
            .then(() => {
                selectedChatMessageToReply.set(null);
            })
            .catch((error) => {
                console.error(error);
            });
    }

    private getMessageContent(message: string): IContent {
        const content: IContent = { body: message, msgtype: MsgType.Text, formatted_body: message };
        this.applyReplyContentIfReplyTo(content);
        return content;
    }

    private applyReplyContentIfReplyTo(content: IContent) {
        const selectedChatMessageIDToReply = get(selectedChatMessageToReply)?.id;
        if (selectedChatMessageIDToReply !== undefined) {
            content["m.relates_to"] = { "m.in_reply_to": { event_id: selectedChatMessageIDToReply } };
        }
    }

    async sendFiles(files: FileList) {
        try {
            await Promise.allSettled(Array.from(files).map((file) => this.sendFile(file)));
        } catch (error) {
            console.error(error);
        }
    }

    removeMessage(messageId: string) {
        try {
            this.matrixRoom.removeEvent(messageId);
        } catch (error) {
            console.error(error);
        }
    }

    private async sendFile(file: File) {
        try {
            const uploadResponse = await this.matrixRoom.client.uploadContent(file);
            const content: Omit<MediaEventContent, "info"> & {
                info: Partial<MediaEventInfo>;
                formatted_body?: string;
            } = {
                body: file.name,
                formatted_body: file.name,
                info: {
                    size: file.size,
                },
                msgtype: this.getMessageTypeFromFile(file),
                url: uploadResponse.content_uri, // set more specifically later
            };
            this.applyReplyContentIfReplyTo(content);

            return this.matrixRoom.client.sendMessage(this.matrixRoom.roomId, content);
        } catch (error) {
            console.error(error);
            return;
        }
    }

    private getMessageTypeFromFile(file: File) {
        if (file.type.startsWith("image/")) {
            return MsgType.Image;
        } else if (file.type.indexOf("audio/") === 0) {
            return MsgType.Audio;
        } else if (file.type.indexOf("video/") === 0) {
            return MsgType.Video;
        } else {
            return MsgType.File;
        }
    }

    joinRoom(): void {
        this.matrixRoom.client.joinRoom(this.id).catch((error) => console.error("Unable to join", error));
    }

    leaveRoom(): void {
        this.matrixRoom.client.leave(this.id).catch((error) => console.error("Unable to leave", error));
    }
}
