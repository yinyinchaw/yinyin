import { Readable } from "svelte/store";
import { AtLeast } from "@workadventure/map-editor";
import { RoomConnection } from "../../Connection/RoomConnection";

export interface ChatUser {
    id: string;
    presence: Readable<string>;
    username: string | undefined;
    avatarUrl: string | null;
}

export interface ChatRoom {
    id: string;
    name: Readable<string>;
    type: "direct" | "multiple";
    hasUnreadMessages: Readable<boolean>;
    avatarUrl: string | undefined;
    messages: Readable<ChatMessage[]>;
    sendMessage: (message: string) => void;
    sendFiles: (files: FileList) => Promise<void>;
    removeMessage: (messageId: string) => void;
    isInvited: boolean;
    setTimelineAsRead: () => void;
    leaveRoom: () => void;
    joinRoom: () => void;
}

export interface ChatMessage {
    id: string;
    sender: ChatUser | undefined;
    content: ChatMessageContent;
    isMyMessage: boolean;
    isQuotedMessage: boolean | undefined;
    date: Date | null;
    quotedMessage: ChatMessage | undefined;
    type: ChatMessageType;
}

export type ChatMessageType = "text" | "image" | "file" | "audio" | "video";
export type ChatMessageContent = { body: string; url: string | undefined };

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
