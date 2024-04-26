import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { ChatMessage, ChatMessageContent, ChatMessageType, ChatUser } from "../ChatConnection";
import { MatrixChatUser } from "./MatrixChatUser";

export class MatrixChatMessage implements ChatMessage {
    id: string;
    content: ChatMessageContent;
    sender: ChatUser | undefined;
    isMyMessage: boolean;
    date: Date | null;
    isQuotedMessage: boolean | undefined;
    quotedMessage: ChatMessage | undefined;
    type: ChatMessageType;

    constructor(
        private event: MatrixEvent,
        private client: MatrixClient,
        private room: Room,
        isQuotedMessage?: boolean
    ) {
        this.id = event.getId() ?? "";
        this.type = this.mapMatrixMessageTypeToChatMessage();
        this.date = event.getDate();
        this.sender = this.getSender();
        this.isMyMessage = this.client.getUserId() === event.getSender();
        this.content = this.getMessageContent();
        this.isQuotedMessage = isQuotedMessage;
    }

    private getSender() {
        let messageUser;
        const senderUserId = this.event.getSender();
        if (senderUserId) {
            const matrixUser = this.client.getUser(senderUserId);
            messageUser = matrixUser ? new MatrixChatUser(matrixUser, this.client) : undefined;
        }
        return messageUser;
    }

    private getMessageContent(): ChatMessageContent {
        const content = this.event.getOriginalContent();
        const quotedMessage = this.getQuotedMessage();
        if (quotedMessage !== undefined) {
            this.quotedMessage = quotedMessage;
            return { body: content.formatted_body.replace(/(<([^>]+)>).*(<([^>]+)>)/, ""), url: undefined };
        }

        if (this.type !== "text") {
            return {
                body: content.body,
                url: this.client.mxcUrlToHttp(this.event.getOriginalContent().url) ?? undefined,
            };
        }

        return { body: content.body, url: undefined };
    }

    private getQuotedMessage() {
        const replyEventId = this.event.replyEventId;
        if (replyEventId) {
            const replyToEvent = this.room.findEventById(replyEventId);
            if (replyToEvent) {
                return new MatrixChatMessage(replyToEvent, this.client, this.room, true);
            }
        }
        return;
    }

    private mapMatrixMessageTypeToChatMessage() {
        const matrixMessageType = this.event.getOriginalContent().msgtype;
        switch (matrixMessageType) {
            case "m.text":
                return "text";
            case "m.image":
                return "image";
            case "m.file":
                return "file";
            case "m.audio":
                return "audio";
            case "m.video":
                return "video";
        }
        return "text";
    }
}
