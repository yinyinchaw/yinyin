import { ChatMessageReaction, ChatUser } from "../ChatConnection";
import { MatrixEvent, Room } from "matrix-js-sdk";
import { MapStore } from "@workadventure/store-utils";
import { MatrixChatUser } from "./MatrixChatUser";

export class MatrixChatMessageReaction implements ChatMessageReaction {
    key: string;
    messageId: string;
    react(): void {}
    users: MapStore<string, ChatUser>;

    constructor(private matrixRoom: Room, event: MatrixEvent) {
        const relation = event.getRelation();
        if (relation === null || relation.rel_type !== "m.annotation") {
            throw Error("Wrong matrix event object for MessageReaction");
        }

        const reactionKey = relation.key;
        const targetEventId = relation.event_id;

        if (reactionKey === undefined || targetEventId === undefined) {
            throw Error("ReactionKey is undefined or event_id is undefined");
        }
        this.key = reactionKey;
        this.messageId = targetEventId;
        this.users = new MapStore<string, ChatUser>();
        this.addUser(event.getSender());
    }

    public addUser(userId: string | undefined) {
        if (userId === undefined) {
            return;
        }
        if (this.users.get(userId) !== undefined) {
            return;
        }
        const user = this.matrixRoom.client.getUser(userId);
        if (user) {
            this.users.set(user.userId, new MatrixChatUser(user, this.matrixRoom.client));
        }
    }

    public removeUser(userId: string) {
        this.users.delete(userId);
    }
}
