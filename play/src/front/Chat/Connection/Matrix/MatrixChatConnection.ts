import { ClientEvent, MatrixClient, Room, SyncState, User } from "matrix-js-sdk";
import { RoomConnection } from "../../../Connection/RoomConnection";
import { ChatConnection, ChatRoom, ChatUser } from "../ChatConnection";
import { MatrixClientWrapper } from "./MatrixClientWrapper";
import { MatrixChatRoom } from "./MatrixChatRoom";
import { MatrixChatUser } from "./MatrixChatUser";

export class MatrixChatConnection extends ChatConnection {
    private client!: MatrixClient;
    constructor(roomConnection: RoomConnection, matrixClientWrapper: MatrixClientWrapper) {
        super(roomConnection);
        (async () => {
            this.client = await matrixClientWrapper.initMatrixClient();
            await this.startMatrixClient();
        })().catch((error) => {
            console.error(error);
        });
    }

    async startMatrixClient() {
        this.client.once(ClientEvent.Sync, (state) => {
            switch (state) {
                case SyncState.Prepared:
                    this.connectionStatus.set("ONLINE");
                    this.initChatRoomList(this.mapToRoomList());
                    this.initChatUserList(this.mapToUserList());
                    break;
                case SyncState.Error:
                    this.connectionStatus.set("ON_ERROR");
                    break;
                case SyncState.Reconnecting:
                    this.connectionStatus.set("CONNECTING");
                    break;
                case SyncState.Stopped:
                    this.connectionStatus.set("OFFLINE");
                    break;
            }
        });
        await this.client.store.startup();
        await this.client.startClient();
    }

    private mapToRoomList(): Map<string, ChatRoom> {
        const roomList = this.client
            .getRooms()
            .map((room: Room) => new MatrixChatRoom(room, (room) => this.handleChatRoomChanges(room)));
        return new Map(roomList.map((room) => [room.id, room]));
    }

    private mapToUserList(): Map<string, ChatUser> {
        const filteredChatUser = this.client
            .getUsers()
            .filter((user) => user.userId !== this.client.getUserId())
            .map((user: User) => new MatrixChatUser(user, (user) => this.handleChatUserChanges(user)));
        return new Map(filteredChatUser.map((user) => [user.id, user]));
    }

    initChatRoomList(rooms: Map<string, ChatRoom>) {
        super.initChatRoomList(rooms);
    }

    initChatUserList(users: Map<string, ChatUser>) {
        super.initChatUserList(users);
    }

    handleChatUserChanges(user: ChatUser) {
        super.handleChatUserChanges(user);
    }

    handleChatRoomChanges(room: ChatRoom) {
        super.handleChatRoomChanges(room);
    }
}
