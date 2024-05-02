import { MatrixClient, SetPresence, User, UserEvent } from "matrix-js-sdk";
import { writable, Writable } from "svelte/store";
import { AvailabilityStatus } from "@workadventure/messages";
import { ChatUser } from "../ChatConnection";

export class MatrixChatUser implements ChatUser {
    id!: string;
    availabilityStatus: Writable<AvailabilityStatus>;
    username: string | undefined;
    avatarUrl: string | null;
    roomName: string | undefined;
    playUri: string | undefined;
    isAdmin = false;
    isMember = false;
    uuid = undefined;
    color : string | undefined = undefined;
    spaceId : number | undefined;
    
    constructor(private matrixChatUser: User) {
        this.id = matrixChatUser.userId;
        this.username = matrixChatUser.displayName;
        this.avatarUrl = matrixChatUser.avatarUrl ?? null;
        this.availabilityStatus = writable(AvailabilityStatus.UNCHANGED);
    }
}
