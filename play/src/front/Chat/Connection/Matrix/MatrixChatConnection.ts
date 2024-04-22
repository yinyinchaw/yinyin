import { ClientEvent, MatrixClient, RoomEvent, SyncState, User, Visibility } from "matrix-js-sdk";
import { derived, Readable, writable, Writable } from "svelte/store";
import { MapStore } from "@workadventure/store-utils";
import {
    ChatConnectionInterface,
    ChatRoom,
    ChatUser,
    Connection,
    ConnectionStatus,
    CreateRoomOptions,
} from "../ChatConnection";
import { MatrixClientWrapperInterface } from "./MatrixClientWrapper";
import { MatrixChatRoom } from "./MatrixChatRoom";
import { MatrixChatUser } from "./MatrixChatUser";

export class MatrixChatConnection implements ChatConnectionInterface {
    private client!: MatrixClient;
    private readonly roomList: MapStore<string, MatrixChatRoom>;
    connectionStatus: Writable<ConnectionStatus>;
    directRooms: Readable<ChatRoom[]>;
    invitations: Readable<ChatRoom[]>;
    rooms: Readable<ChatRoom[]>;
    userList: Writable<Map<string, ChatUser>>;

    constructor(connection: Connection, matrixClientWrapper: MatrixClientWrapperInterface) {
        this.connectionStatus = writable("CONNECTING");
        this.roomList = new MapStore<string, MatrixChatRoom>();
        this.directRooms = derived(this.roomList, (roomList) => {
            return Array.from(roomList.values()).filter((room) => !room.isInvited && room.type === "direct");
        });
        this.invitations = derived(this.roomList, (roomList) => {
            return Array.from(roomList.values()).filter((room) => room.isInvited);
        });
        this.rooms = derived(this.roomList, (roomList) => {
            return Array.from(roomList.values()).filter((room) => !room.isInvited && room.type === "multiple");
        });
        this.userList = writable(new Map());
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
                    this.userList.set(this.mapToUserList());
                    this.initRoomList();
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
        this.client.on(ClientEvent.Room, (room) => {
            const matrixRoom = new MatrixChatRoom(room);
            this.roomList.set(matrixRoom.id, matrixRoom);
        });
        this.client.on(ClientEvent.DeleteRoom, (roomId) => {
            this.roomList.delete(roomId);
        });

        // The chat connection is keeping the room list alive, this is why
        // we register RoomEvent.MyMembership here
        this.client.on(RoomEvent.MyMembership, (room, membership, prevMembership) => {
            const { roomId } = room;
            if (membership !== prevMembership) {
                if (membership === "join") {
                    this.roomList.set(roomId, new MatrixChatRoom(room));
                }
                if (membership === "leave" || membership === "ban") {
                    this.roomList.delete(roomId);
                }
            }
        });
        await this.client.store.startup();
        await this.client.startClient();
    }

    private mapToUserList(): Map<string, ChatUser> {
        const filteredChatUser = this.client
            .getUsers()
            .filter((user) => user.userId !== this.client.getUserId())
            .map((user: User) => new MatrixChatUser(user, this.client));
        return new Map(filteredChatUser.map((user) => [user.id, user]));
    }

    private initRoomList(): void {
        this.client.getRooms().forEach((room) => this.roomList.set(room.roomId, new MatrixChatRoom(room)));
    }

    //TODO createOptions only on matrix size
    async createRoom(roomOptions?: CreateRoomOptions) {
        return await this.client.createRoom({
            name: roomOptions?.name,
            visibility: roomOptions?.visibility as Visibility | undefined,
            room_alias_name: roomOptions?.name,
        });
    }
}
