import { MatrixClient, User, UserEvent,SetPresence } from "matrix-js-sdk";
import { writable, Writable } from "svelte/store";
import { ChatUser } from "../ChatConnection";
import { AvailabilityStatus } from "@workadventure/messages";

export class MatrixChatUser implements ChatUser {
    id!: string;
    availabilityStatus: Writable<AvailabilityStatus>;
    username: string | undefined;
    avatarUrl: string | null;
    roomName: string | undefined;
    playUri:string |undefined;
    isAdmin = false;
    isMember = false;
    uuid = undefined;
    color : string | undefined = undefined;
    spaceId : number | undefined;

    constructor(private matrixChatUser: User, private matrixClient: MatrixClient) {
        this.id = matrixChatUser.userId;
        this.username = matrixChatUser.displayName;
        this.avatarUrl = matrixClient.mxcUrlToHttp(matrixChatUser.avatarUrl ?? "", 48, 48);
        this.availabilityStatus = writable(this.mapMatrixPresenceToAvailabilityStatus(matrixChatUser.presence));
        this.startHandlingChatUserEvent();
    }
    

    startHandlingChatUserEvent() {
        this.matrixChatUser.on(UserEvent.Presence, (_, user) => {
            this.availabilityStatus.set(this.mapMatrixPresenceToAvailabilityStatus(user.presence));
        });
    }

    private mapMatrixPresenceToAvailabilityStatus(presence : string = SetPresence.Offline): AvailabilityStatus{
        switch(presence){
            case SetPresence.Offline:
                return AvailabilityStatus.UNCHANGED;
            case SetPresence.Online:
                return AvailabilityStatus.ONLINE;
            case SetPresence.Unavailable:
                return AvailabilityStatus.AWAY;
            default : 
            //TODO : Create Error
                throw new Error(`Do not handle the status ${presence}`);
        }
    }
}
