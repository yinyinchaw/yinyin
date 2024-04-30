import {
    IContent,
    IRoomTimelineData,
    MatrixEvent,
    MsgType,
    NotificationCountType,
    ReceiptType,
    Room,
    RoomEvent,
} from "matrix-js-sdk";
import { get, Writable, writable } from "svelte/store";
import { MediaEventContent, MediaEventInfo } from "matrix-js-sdk/lib/@types/media";
import { KnownMembership } from "matrix-js-sdk/lib/@types/membership";
import { ChatRoom } from "../ChatConnection";
import { selectedChatMessageToReply } from "../../Stores/ChatStore";
import { MatrixChatMessage } from "./MatrixChatMessage";
import { MapStore } from "@workadventure/store-utils";
import { MatrixChatMessageReaction } from "./MatrixChatMessageReaction";

export class MatrixChatRoom implements ChatRoom {
    id!: string;
    name!: Writable<string>;
    type!: "multiple" | "direct";
    hasUnreadMessages: Writable<boolean>;
    avatarUrl: string | undefined;
    messages!: Writable<Map<string, MatrixChatMessage>>;
    isInvited!: boolean;
    membersId: string[];
    messageReactions: MapStore<string, MapStore<string, MatrixChatMessageReaction>>;

    constructor(private matrixRoom: Room) {
        this.id = matrixRoom.roomId;
        this.name = writable(matrixRoom.name);
        this.type = this.getMatrixRoomType();
        this.hasUnreadMessages = writable(matrixRoom.getUnreadNotificationCount() > 0);
        this.avatarUrl = matrixRoom.getAvatarUrl(matrixRoom.client.baseUrl, 24, 24, "scale") ?? undefined;
        this.messages = writable(this.initMatrixRoomMessages(matrixRoom));
        this.sendMessage = this.sendMessage.bind(this);
        this.isInvited = matrixRoom.hasMembershipState(matrixRoom.myUserId, "invite");
        this.membersId = [
            ...matrixRoom.getMembersWithMembership(KnownMembership.Invite).map((member) => member.userId),
            ...matrixRoom.getMembersWithMembership(KnownMembership.Join).map((member) => member.userId),
        ];
        this.messageReactions = new MapStore<string, MapStore<string, MatrixChatMessageReaction>>();
        this.initMatrixRoomMessageReactions();
        this.startHandlingChatRoomEvents();
    }

    private startHandlingChatRoomEvents() {
        this.matrixRoom.on(RoomEvent.Timeline, this.onRoomTimeline.bind(this));
        this.matrixRoom.on(RoomEvent.Name, this.onRoomName.bind(this));
        this.matrixRoom.on(RoomEvent.Redaction, this.onRoomRedaction.bind(this));
    }

    private onRoomTimeline(
        event: MatrixEvent,
        room: Room | undefined,
        toStartOfTimeline: boolean | undefined,
        _: boolean,
        data: IRoomTimelineData
    ) {
        //Only get realtime event
        /*if (toStartOfTimeline || !data || !data.liveEvent) {
            return;
        }*/
        if (room !== undefined) {
            this.hasUnreadMessages.set(room.getUnreadNotificationCount() > 0);
            if (event.getType() === "m.room.message") {
                if (this.isEventReplacingExistingOne(event)) {
                    this.handleMessageModification(event);
                } else {
                    this.handleNewMessage(event);
                }
            }
            if (event.getType() === "m.reaction") {
                this.handleNewMessageReaction(event);
            }
            this.membersId = [
                ...room.getMembersWithMembership(KnownMembership.Invite).map((member) => member.userId),
                ...room.getMembersWithMembership(KnownMembership.Join).map((member) => member.userId),
            ];
        }
    }

    private onRoomName(room: Room) {
        this.name.set(room.name);
    }

    private onRoomRedaction(event: MatrixEvent) {
        this.handleMessageDeletion(event);
    }

    private handleNewMessage(event: MatrixEvent) {
        this.messages.update((existingMessages) =>
            existingMessages.set(
                event.getId() ?? "",
                new MatrixChatMessage(event, this.matrixRoom.client, this.matrixRoom)
            )
        );
    }

    private handleMessageModification(event: MatrixEvent) {
        const eventRelation = event.getRelation();
        if (eventRelation) {
            const event_id = eventRelation.event_id;
            if (event_id) {
                const messageToUpdate = get(this.messages).get(event_id);
                if (messageToUpdate !== undefined) {
                    messageToUpdate.modifyContent(event.getOriginalContent()["m.new_content"].body);
                }
            }
        }
    }

    private handleMessageDeletion(event: MatrixEvent) {
        const sourceEventId = event.getAssociatedId();
        if (sourceEventId !== undefined) {
            const messageToUpdate = get(this.messages).get(sourceEventId);
            if (messageToUpdate !== undefined) {
                messageToUpdate.markAsRemoved();
            }
        }
    }

    private handleNewMessageReaction(event: MatrixEvent) {
        const reactionEvent = this.getReactionEvent(event);
        if (reactionEvent !== undefined) {
            const { messageId, reactionKey } = reactionEvent;
            const existingMessageWithReactions = this.messageReactions.get(messageId);
            if (existingMessageWithReactions) {
                const existingMessageReaction = existingMessageWithReactions.get(reactionKey);
                if (existingMessageReaction) {
                    existingMessageReaction.addUser(event.getSender());
                    return;
                }
                existingMessageWithReactions.set(reactionKey, new MatrixChatMessageReaction(this.matrixRoom, event));
                return;
            }
            const newMessageReactionMap = new MapStore<string, MatrixChatMessageReaction>();
            newMessageReactionMap.set(reactionKey, new MatrixChatMessageReaction(this.matrixRoom, event));
            this.messageReactions.set(messageId, newMessageReactionMap);
        }
    }

    private isEventReplacingExistingOne(event: MatrixEvent): boolean {
        const eventRelation = event.getRelation();
        return eventRelation?.rel_type === "m.replace";
    }

    private initMatrixRoomMessages(matrixRoom: Room) {
        const messages = new Map<string, MatrixChatMessage>();
        this.replayMatrixRoomTimelineForMessages(matrixRoom).forEach((event, index) =>
            messages.set(event.getId() ?? index.toString(), new MatrixChatMessage(event, matrixRoom.client, matrixRoom))
        );
        return messages;
    }

    private replayMatrixRoomTimelineForMessages(matrixRoom: Room): MatrixEvent[] {
        return matrixRoom
            .getLiveTimeline()
            .getEvents()
            .filter((event) => event.getType() === "m.room.message")
            .reduce(this.applyRoomMessagesModifications(), []);
    }

    private applyRoomMessagesModifications() {
        return (events: MatrixEvent[], event: MatrixEvent) => {
            if (this.isEventReplacingExistingOne(event)) {
                const indexOfEventToReplace = events.findIndex(
                    (eventToReplace) => eventToReplace.getId() === event.getRelation()?.event_id
                );
                if (indexOfEventToReplace !== -1) {
                    events[indexOfEventToReplace].getOriginalContent().formatted_body =
                        event.getOriginalContent()["m.new_content"].formatted_body;
                    events[indexOfEventToReplace].getOriginalContent().body =
                        event.getOriginalContent()["m.new_content"].body;
                }
                return events;
            }
            return events.concat(event);
        };
    }

    private initMatrixRoomMessageReactions() {
        this.matrixRoom
            .getLiveTimeline()
            .getEvents()
            .filter((event) => event.getType() === "m.reaction")
            .forEach(this.handleNewMessageReaction.bind(this));
    }

    private getReactionEvent(event: MatrixEvent) {
        const relation = event.getRelation();
        if (relation) {
            if (relation.rel_type === "m.annotation") {
                const targetEventId = relation.event_id;
                const reactionKey = relation.key;
                if (targetEventId !== undefined && reactionKey !== undefined) {
                    return { messageId: targetEventId, reactionKey };
                }
            }
        }
        return;
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

    joinRoom(): void {
        this.matrixRoom.client.joinRoom(this.id).catch((error) => console.error("Unable to join", error));
    }

    leaveRoom(): void {
        this.matrixRoom.client.leave(this.id).catch((error) => console.error("Unable to leave", error));
    }

    private getMatrixRoomType() {
        const dmInviter = this.matrixRoom.getDMInviter();
        if (dmInviter !== undefined) {
            return "direct";
        }
        return this.matrixRoom.getMembers().some((member) => member.getDMInviter() !== undefined)
            ? "direct"
            : "multiple";
    }

    async sendFiles(files: FileList) {
        try {
            await Promise.allSettled(Array.from(files).map((file) => this.sendFile(file)));
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
}
