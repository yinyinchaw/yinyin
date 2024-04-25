import { MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { ChatMessage, ChatUser } from "../ChatConnection";
import { MatrixChatUser } from "./MatrixChatUser";

export class MatrixChatMessage implements ChatMessage {
    id: string;
    content: string;
    sender: ChatUser | undefined;
    isMyMessage: boolean;
    date: Date | null;
    isQuotedMessage: boolean | undefined;
    quotedMessage: ChatMessage | undefined;

    constructor(
        private event: MatrixEvent,
        private client: MatrixClient,
        private room: Room,
        isQuotedMessage?: boolean
    ) {
        this.id = event.getId() ?? "";
        this.content = this.getMessageContent();
        this.sender = this.getSender();
        this.isMyMessage = this.client.getUserId() === event.getSender();
        this.isQuotedMessage = isQuotedMessage;
        this.date = event.getDate();
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

    private getMessageContent() {
        const content = this.event.getOriginalContent();
        const quotedMessage = this.getQuotedMessage();
        if (quotedMessage !== undefined) {
            this.quotedMessage = quotedMessage;
            return content.formatted_body.replace(/(<([^>]+)>).*(<([^>]+)>)/, "");
        }
        return content.body;
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
}
