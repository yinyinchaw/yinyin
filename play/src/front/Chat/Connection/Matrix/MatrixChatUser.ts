import { User, UserEvent } from "matrix-js-sdk";
import merge from "lodash/merge";
import { ChatUser } from "../ChatConnectionInterface";

export class MatrixChatUser implements ChatUser {
    id!: string;
    presence!: string;
    username: string | undefined;
    avatarUrl: string | undefined;
    constructor(private matrixChatUser: User, private handleUserEvent: (user: ChatUser) => void) {
        merge(this, this.mapMatrixUserToChatUser(matrixChatUser));
        this.startHandlingChatUserEvent();
    }

    startHandlingChatUserEvent() {
        this.matrixChatUser.on(UserEvent.Presence, (_, user) => {
            console.debug("UserEvent presence : ", user);
            this.handleUserEvent(this.mapMatrixUserToChatUser(user));
        });
    }

    mapMatrixUserToChatUser(matrixUser: User): ChatUser {
        return {
            id: matrixUser.userId,
            username: matrixUser.displayName,
            avatarUrl: matrixUser.avatarUrl,
            presence: matrixUser.presence,
        };
    }
}
