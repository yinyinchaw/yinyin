import { Readable } from "svelte/store";
import { AtLeast } from "@workadventure/map-editor";
import { RoomConnection } from "../../Connection/RoomConnection";

export interface ChatUser {
    id: string;
    presence: Readable<string>;
    username: string | undefined;
    avatarUrl: string | undefined;
}

export interface ChatRoom {
    id: string;
    name: Readable<string>;
    type: "direct" | "multiple";
    hasUnreadMessages: Readable<boolean>;
    avatarUrl: string | undefined;
    messages: Readable<ChatMessage[]>;
    sendMessage: (message: string) => void;
    isInvited: boolean;
    setTimelineAsRead: () => void;
    leaveRoom: () => void;
    joinRoom: () => void;
}

export interface ChatMessage {
    id: string;
    userId: string;
    content: string;
    isMyMessage: boolean;
    date: Date | null;
}

export interface CreateRoomOptions {
    name?: string;
    visibility?: "private" | "public";
}

export type ConnectionStatus = "ONLINE" | "ON_ERROR" | "CONNECTING" | "OFFLINE";

export interface ChatConnectionInterface {
    connectionStatus: Readable<ConnectionStatus>;
    userList: Readable<Map<string, ChatUser>>;
    directRooms: Readable<ChatRoom[]>;
    rooms: Readable<ChatRoom[]>;
    invitations: Readable<ChatRoom[]>;
}

export type Connection = AtLeast<RoomConnection, "queryChatMembers">;
