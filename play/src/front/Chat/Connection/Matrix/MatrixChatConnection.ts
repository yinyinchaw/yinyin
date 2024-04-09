import { ClientEvent, MatrixClient, Room, SyncState, User } from "matrix-js-sdk";
import { RoomConnection } from "../../../Connection/RoomConnection";
import { ChatConnection, ChatRoom, ChatUser } from "../ChatConnectionInterface";
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
                    this.handleChatRoomsChanges(this.mapToRoomList());
                    this.handleChatConnectedUsersChanges(this.mapToUserList());
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

    private mapToRoomList(): ChatRoom[] {
        return this.client.getRooms().map((room: Room) => new MatrixChatRoom(room));
    }

    private mapToUserList(): ChatUser[] {
        return this.client
            .getUsers()
            .filter((user) => user.userId !== this.client.getUserId())
            .map((user: User) => new MatrixChatUser(user));
    }

    handleChatConnectedUsersChanges(users: ChatUser[]) {
        super.handleChatConnectedUsersChanges(users);
    }

    handleChatRoomsChanges(rooms: ChatRoom[]) {
        super.handleChatRoomsChanges(rooms);
    }
}
