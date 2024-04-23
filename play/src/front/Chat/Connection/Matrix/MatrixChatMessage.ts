import { IContent, MatrixClient, MatrixEvent, Room } from "matrix-js-sdk";
import { ChatMessage, ChatUser } from "../ChatConnection";
import { MatrixChatUser } from "./MatrixChatUser";

export class MatrixChatMessage implements ChatMessage {
    id: string;
    content: string;
    sender: ChatUser | undefined;
    isMyMessage: boolean;
    date: Date | null;
    responseTo: ChatMessage | undefined;

    constructor(
        private event: MatrixEvent,
        private client: MatrixClient,
        private room: Room,
        isReplyMessage?: boolean
    ) {
        console.debug(this.event);
        this.id = event.getId() ?? "";
        this.content = this.parseMessageContent();
        this.sender = this.getSender();
        this.isMyMessage = isReplyMessage ? false : this.client.getUserId() === event.getSender();
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

    private parseMessageContent() {
        const content = this.event.getContent();
        this.setResponseToMessageIfExist(content);
        if (content.formatted_body) {
            return content.formatted_body;
        }
        return content.body;
    }

    private setResponseToMessageIfExist(content: IContent) {
        if (content["m.relates_to"]) {
            if (content["m.relates_to"]["m.in_reply_to"]) {
                const { event_id } = content["m.relates_to"]["m.in_reply_to"];
                if (event_id) {
                    const replyToEvent = this.room.findEventById(event_id);
                    if (replyToEvent) {
                        this.responseTo = new MatrixChatMessage(replyToEvent, this.client, this.room, true);
                    }
                }
            }
        }
    }
}
