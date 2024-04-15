import { User, UserEvent } from "matrix-js-sdk";
import { writable, Writable } from "svelte/store";
import { ChatUser } from "../ChatConnection";

export class MatrixChatUser implements ChatUser {
    id!: string;
    presence!: Writable<string>;
    username: string | undefined;
    avatarUrl: string | undefined;

    constructor(private matrixChatUser: User) {
        this.id = matrixChatUser.userId;
        this.username = matrixChatUser.displayName;
        this.avatarUrl = matrixChatUser.avatarUrl;
        this.presence = writable(matrixChatUser.presence);
        this.startHandlingChatUserEvent();
    }

    startHandlingChatUserEvent() {
        this.matrixChatUser.on(UserEvent.Presence, (_, user) => {
            this.presence.set(user.presence);
        });
    }
}
