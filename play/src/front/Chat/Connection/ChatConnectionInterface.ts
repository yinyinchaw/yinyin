import { ChatMemberData } from "@workadventure/messages";
import { writable, Writable } from "svelte/store";
import { RoomConnection } from "../../Connection/RoomConnection";

export interface ChatUser {
    id: string;
    presence: string;
    username: string | undefined;
    avatarUrl: string | undefined;
}

export interface ChatRoom {
    id: string;
    name: string;
    type: string;
}

export type ConnectionStatus = "ONLINE" | "ON_ERROR" | "CONNECTING" | "OFFLINE";

export interface ChatConnectionInterface {
    getWorldChatMembers(searchText?: string): Promise<ChatMemberData[]>;
    handleChatConnectedUsersChanges: (users: ChatUser[]) => void;
    handleChatRoomsChanges: (rooms: ChatRoom[]) => void;
}

export abstract class ChatConnection implements ChatConnectionInterface {
    public connectionStatus: Writable<ConnectionStatus> = writable("OFFLINE");
    public chatMembers: Writable<ChatUser[]> = writable([]);
    public chatRooms: Writable<ChatRoom[]> = writable([]);
    protected constructor(private readonly connection: RoomConnection) {
        this.connectionStatus.set("CONNECTING");
    }
    async getWorldChatMembers(searchText?: string): Promise<ChatMemberData[]> {
        const { members } = await this.connection.queryChatMembers(searchText ?? "");
        return members;
    }

    handleChatConnectedUsersChanges(users: ChatUser[]) {
        this.chatMembers.update((prevChatUsers) => [...prevChatUsers, ...users]);
    }

    handleChatRoomsChanges(rooms: ChatRoom[]) {
        this.chatRooms.update((prevChatRooms) => [...prevChatRooms, ...rooms]);
    }
}
