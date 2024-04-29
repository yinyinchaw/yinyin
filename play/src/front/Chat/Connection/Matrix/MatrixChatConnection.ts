import { ClientEvent, MatrixClient, RoomEvent, SyncState, Visibility } from "matrix-js-sdk";
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
import { SpaceUserExtended } from "../../../Space/SpaceFilter/SpaceFilter";
import { AvailabilityStatus, ChatMemberData, PartialSpaceUser, SpaceUser } from "@workadventure/messages";
import { KnownMembership } from "matrix-js-sdk/lib/@types/membership";

export const defaultWoka =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAdCAYAAABBsffGAAAB/ElEQVRIia1WMW7CQBC8EAoqFy74AD1FqNzkAUi09DROwwN4Ag+gMQ09dcQXXNHQIucBPAJFc2Iue+dd40QZycLc7c7N7d7u+cU9wXw+ryyL0+n00eU9tCZIOp1O/f/ZbBbmzuczX6uuRVTlIAYpCSeTScumaZqw0OVyURd47SIGaZ7n6s4wjmc0Grn7/e6yLFtcr9dPaaOGhcTEeDxu2dxut2hXUJ9ioKmW0IidMg6/NPmD1EmqtojTBWAvE26SW8r+YhfIu87zbyB5BiRerVYtikXxXuLRuK058HABMyz/AX8UHwXgV0NRaEXzDKzaw+EQCioo1yrsLfvyjwZrTvK0yp/xh/o+JwbFhFYgFRNqzGEIB1ZhH2INkXJZoShn2WNSgJRNS/qoYSHxer1+qkhChnC320ULRI1LEsNhv99HISBkLmhP/7L8OfqhiKC6SzEJtSTLHMkGFhK6XC79L89rmtC6rv0YfjXV9COPDwtVQxEc2ZflIu7R+WADQrkA7eCH5BdFwQRXQ8bKxXejeWFoYZGCQM7Yh7BAkcw0DEnEEPHhbjBPQfCDvwzlEINlWZq3OAiOx2O0KwAKU8gehXfzu2Wz2VQMTXqCeLZZSNvtVv20MFsu48gQpDvjuHYxE+ZHESBPSJ/x3sqBvhe0hc5vRXkfypBY4xGcc9+lcFxartG6LgAAAABJRU5ErkJggg==";
export const defaultColor = "#626262";

export class MatrixChatConnection implements ChatConnectionInterface {
    private client!: MatrixClient;
    private readonly roomList: MapStore<string, MatrixChatRoom>;
    connectionStatus: Writable<ConnectionStatus>;
    directRooms: Readable<ChatRoom[]>;
    invitations: Readable<ChatRoom[]>;
    rooms: Readable<ChatRoom[]>;
    userList: MapStore<string, ChatUser>;

    constructor(private connection: Connection, matrixClientWrapper: MatrixClientWrapperInterface) {
        this.connectionStatus = writable("CONNECTING");
        this.userList = new MapStore<string, ChatUser>();
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
                    this.initUserList();
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

        this.client.on(RoomEvent.Timeline,(event,room)=>{
            const roomId = room?.roomId;

            if(event.getType()==="m.room.member" && roomId)
                this.roomList.set(roomId, new MatrixChatRoom(room));
            
        });

        this.client.on(RoomEvent.MyMembership, (room, membership, prevMembership) => {
            const { roomId } = room;
            if (membership !== prevMembership) {
                if (membership === KnownMembership.Join) { 
                    this.roomList.set(roomId, new MatrixChatRoom(room));
                }
                if (membership === KnownMembership.Leave || membership === KnownMembership.Ban) {
                    this.roomList.delete(roomId);
                }
                if (membership === KnownMembership.Invite) {
                    const inviter = room.getDMInviter();
                    const newRoom =  new MatrixChatRoom(room);
                    if(inviter && this.userList.has(inviter)) newRoom.joinRoom();
                    this.roomList.set(roomId,newRoom);
                }

            }
        });
        await this.client.store.startup();
        await this.client.startClient();
    }

    private initRoomList(): void {
        this.client.getRooms().forEach((room) => this.roomList.set(room.roomId, new MatrixChatRoom(room)));
    }

    private initUserList(): void {
        this.client
            .getUsers()
            .filter((user) => user.userId !== this.client.getUserId())
            .forEach((user) => {
                user.avatarUrl = user.avatarUrl ?? defaultWoka;
                this.userList.set(user.userId, new MatrixChatUser(user,this.client));
            });

        this.getWorldChatMembers().then((members) => {
            
            members.forEach((member) => {
                if (!member.chatId) return;

                this.userList.set(member.chatId, {
                    availabilityStatus: writable(AvailabilityStatus.UNCHANGED),
                    avatarUrl: defaultWoka,
                    id: member.chatId,
                    roomName: undefined,
                    playUri: undefined,
                    username: member.wokaName,
                    isAdmin: member.tags.includes("admin"),
                    isMember: member.tags.includes("member"),
                    uuid: undefined,
                    color: defaultColor,
                    spaceId: undefined,
                });
            });
        });
    }

    updateUserFromSpace(user: PartialSpaceUser): void {
        if (!user.chatID || !this.userList.has(user.chatID)) return;

        const userToUpdate: ChatUser | undefined = this.userList.get(user.chatID);

        if (!userToUpdate) return;

        if (user.availabilityStatus) userToUpdate.availabilityStatus.set(user.availabilityStatus);

        this.userList.set(user.chatID, {
            id: userToUpdate.id,
            uuid: userToUpdate.uuid,
            avatarUrl: userToUpdate.avatarUrl,
            availabilityStatus: userToUpdate.availabilityStatus,
            roomName: user.roomName ?? userToUpdate.roomName,
            playUri: user.playUri ?? userToUpdate.playUri,
            username: user.name ?? userToUpdate.username,
            isAdmin: user.tags && user.tags.length > 0 ? user.tags.includes("admin") : userToUpdate.isAdmin ,
            isMember: user.tags && user.tags.length > 0 ? user.tags.includes("member") : userToUpdate.isMember,
            visitCardUrl: user.visitCardUrl ?? userToUpdate.visitCardUrl,
            color: user.color || userToUpdate.color,
            spaceId: userToUpdate.spaceId,
        });
    }

    addUserFromSpace(user: SpaceUserExtended): void {
        if (!user.chatID) return;

        let updatedUser = {
            uuid: user.uuid,
            id: user.chatID,
            avatarUrl: user.getWokaBase64 ?? defaultWoka,
            availabilityStatus: writable(user.availabilityStatus),
            roomName: user.roomName,
            playUri: user.playUri,
            username: user.name,
            isAdmin: user.tags.includes("admin"),
            isMember: user.tags.includes("member"),
            visitCardUrl: user.visitCardUrl,
            color: user.color ?? defaultColor,
            spaceId: user.id,
        };

        const actualUser = this.userList.get(user.chatID);
        if (actualUser) {
            actualUser.availabilityStatus.set(AvailabilityStatus.ONLINE);
            updatedUser = {
                uuid: user.uuid,
                id: user.chatID,
                avatarUrl: user.getWokaBase64 ?? defaultWoka,
                availabilityStatus: actualUser.availabilityStatus || writable(AvailabilityStatus.ONLINE),
                roomName: user.roomName,
                playUri: user.playUri,
                username: user.name,
                isAdmin: user.tags.includes("admin"),
                isMember: user.tags.includes("member"),
                visitCardUrl: user.visitCardUrl,
                color: user.color ?? defaultColor,
                spaceId: user.id,
            };
        }

        this.userList.set(user.chatID, updatedUser);
    }

    disconnectSpaceUser(userId: number): void {
        //TODO: use UUID or ID from space user as main ID
        const userToDisconnect = Array.from(this.userList.values()).filter(({ spaceId }) => spaceId === userId)[0];

        if (!userToDisconnect ||userToDisconnect.id ) return;



        this.userList.set(userToDisconnect.id, {
            id: userToDisconnect.id,
            uuid: userToDisconnect.uuid,
            avatarUrl: userToDisconnect.avatarUrl,
            availabilityStatus: userToDisconnect.availabilityStatus,
            roomName: undefined,
            playUri: undefined,
            username: userToDisconnect.username,
            isAdmin: userToDisconnect.isAdmin,
            isMember: userToDisconnect.isMember,
            visitCardUrl: userToDisconnect.visitCardUrl,
            color: userToDisconnect.color,
            spaceId: undefined,
        });

        userToDisconnect?.availabilityStatus.set(AvailabilityStatus.UNCHANGED);
    }

    async getWorldChatMembers(searchText?: string): Promise<ChatMemberData[]> {
        const { members } = await this.connection.queryChatMembers(searchText ?? "");
        return members;
    }

    sendBan(id: string): void {
        //TODO : send invite to matrix to ban user (ban to space or ban 1 to 1 ?)
        const user = this.userList.get(id);
        if (!user || user.uuid || user.username) return;
        if (user.uuid && user.username && this.connection.emitBanPlayerMessage)
            this.connection.emitBanPlayerMessage(user.uuid, user.username);
    }

    //TODO createOptions only on matrix size
    async createRoom(roomOptions?: CreateRoomOptions): Promise<{
        room_id: string;
    }> {
        return await this.client.createRoom({
            name: roomOptions?.name,
            visibility: roomOptions?.visibility as Visibility | undefined,
            room_alias_name: roomOptions?.name,
            invite: roomOptions?.invite,
            is_direct: roomOptions?.is_direct,
        });
    }

    async createDirectRoom(userToInvite: string): Promise<ChatRoom | undefined> {

        const existingDirectRoom = this.getDirectRoomFor(userToInvite);

        if(existingDirectRoom) return existingDirectRoom;

        const { room_id } = await this.createRoom({
            invite: [userToInvite],
            is_direct: true,
            preset: "private_chat",
            visibility: "private",
        });

        const room = this.client.getRoom(room_id);
        if (!room) return;
        const newRoom = new MatrixChatRoom(room);
        this.roomList.set(room_id, newRoom);
        return newRoom;
    }


    getDirectRoomFor(userID : string): ChatRoom | undefined {
        const directRooms = Array.from(this.roomList)
        .filter(([_, room]) => {
            return (
                room.type === "direct" &&
                room.membersId.some((memberId) => memberId === userID && room.membersId.length === 2)
            );
        })
        .map(([_, room]) => room);

        if (directRooms.length > 0) return directRooms[0];

        return undefined;
        
    }
}
