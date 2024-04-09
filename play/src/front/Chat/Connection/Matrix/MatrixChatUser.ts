import { User, UserEvent } from "matrix-js-sdk";
import { ChatUser } from "../ChatConnectionInterface";

export class MatrixChatUser implements ChatUser {
    id: string;
    presence: string;
    username: string | undefined;
    avatarUrl: string | undefined;
    constructor(private matrixChatUser: User) {
        this.id = matrixChatUser.userId;
        this.presence = matrixChatUser.presence;
        this.username = matrixChatUser.displayName;
        this.avatarUrl = matrixChatUser.avatarUrl;
        this.startHandlingChatUserEvent();
    }

    startHandlingChatUserEvent() {
        this.matrixChatUser.on(UserEvent.Presence, (_, user) => {
            console.debug("UserEvent presence : ", user);
            this.presence = user.presence;
        });
    }
}
