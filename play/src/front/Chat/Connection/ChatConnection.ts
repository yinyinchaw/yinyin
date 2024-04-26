import { Readable, Writable } from "svelte/store";
import { AtLeast } from "@workadventure/map-editor";
import { RoomConnection } from "../../Connection/RoomConnection";
import { SpaceUserExtended } from "../../Space/SpaceFilter/SpaceFilter";
import { AvailabilityStatus, PartialSpaceUser } from "@workadventure/messages";

export interface ChatUser {
    id: string;
    uuid?: string;
    availabilityStatus: Writable<AvailabilityStatus>;
    username: string | undefined;
    avatarUrl: string | null;
    roomName: string | undefined;
    playUri: string | undefined;
    isAdmin?: boolean;
    isMember?: boolean;
    visitCardUrl?: string;
    color: string | undefined;
    spaceId : number | undefined;
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
    membersId: string[];
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
    is_direct?: boolean;
    invite?: string[];
    preset?: "private_chat" | "public_chat" | "trusted_private_chat";
}

export type ConnectionStatus = "ONLINE" | "ON_ERROR" | "CONNECTING" | "OFFLINE";

export interface ChatConnectionInterface {
    connectionStatus: Readable<ConnectionStatus>;
    userList: Readable<Map<string, ChatUser>>;
    directRooms: Readable<ChatRoom[]>;
    rooms: Readable<ChatRoom[]>;
    invitations: Readable<ChatRoom[]>;
    addUserFromSpace(user: SpaceUserExtended): void;
    updateUserFromSpace(user: PartialSpaceUser): void;
    disconnectSpaceUser(userId:number):void
    sendBan: (id: string) => void;
    createRoom : (roomOptions : CreateRoomOptions) => Promise<{room_id: string;}>;
    createDirectRoom(userChatId: string): Promise<ChatRoom|undefined>;
    getDirectRoomFor(uuserChatId : string): ChatRoom | undefined;
}

export type Connection = AtLeast<RoomConnection, "queryChatMembers">;
