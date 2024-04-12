import { ChatMemberData } from "@workadventure/messages";
import { writable, Writable } from "svelte/store";
import merge from "lodash/merge";
import { Subscription } from "rxjs";
import { ChatEventsEngine, chatEventsEngineInstance } from "../Event/ChatEventsEngine";
import { AtLeast } from "@workadventure/map-editor";
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
    type: "direct" | "multiple";
    hasUnreadMessages: boolean | undefined;
    avatarUrl: string | undefined;
    messages: ChatMessage[];
    sendMessage: (message: string) => void;
    setTimelineAsRead: () => void;
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
    getWorldChatMembers(searchText?: string): Promise<ChatMemberData[]>;
    initChatUserList: (users: Map<string, ChatUser>) => void;
    initChatRoomList: (rooms: Map<string, ChatRoom>) => void;
    createRoom: (roomOptions?: CreateRoomOptions) => void;
}

export type Connection = AtLeast<RoomConnection, "queryChatMembers">;

export abstract class ChatConnection implements ChatConnectionInterface {
    public connectionStatus: Writable<ConnectionStatus> = writable("OFFLINE");
    public userList: Writable<Map<string, ChatUser>> = writable(new Map());
    public roomList: Writable<Map<string, ChatRoom>> = writable(new Map());
    private subscriptionsToChatEvents: Subscription[] = [];

    protected constructor(
        private connection: Connection,
        private chatEventsEngine: ChatEventsEngine = chatEventsEngineInstance
    ) {
        this.connectionStatus.set("CONNECTING");
        this.subscribeToChatEvents();
    }

    createRoom(roomOptions?: CreateRoomOptions) {
        throw new Error("This method is not implemented");
    }

    private subscribeToChatEvents() {
        this.subscriptionsToChatEvents.push(
            this.chatEventsEngine.userUpdateMessageStream.subscribe((user) => this.handleChatUserChanges(user))
        );
        this.subscriptionsToChatEvents.push(
            this.chatEventsEngine.roomUpdateMessageStream.subscribe((room) => this.handleChatRoomChanges(room))
        );
    }

    async getWorldChatMembers(searchText?: string): Promise<ChatMemberData[]> {
        const { members } = await this.connection.queryChatMembers(searchText ?? "");
        return members;
    }

    initChatUserList(users: Map<string, ChatUser>) {
        this.userList.set(users);
    }

    initChatRoomList(rooms: Map<string, ChatRoom>) {
        this.roomList.set(rooms);
    }

    handleChatRoomChanges(room: ChatRoom) {
        this.roomList.update((prevRoomList) => {
            const existingRoom = prevRoomList.get(room.id);
            if (existingRoom) {
                merge(existingRoom, room);
            } else {
                prevRoomList.set(room.id, room);
            }
            return prevRoomList;
        });
    }

    handleChatUserChanges(user: ChatUser): void {
        this.userList.update((prevUserList) => {
            const existingUser = prevUserList.get(user.id);
            if (existingUser) {
                merge(existingUser, user);
            } else {
                prevUserList.set(user.id, user);
            }
            return prevUserList;
        });
    }

    public destroy(): void {
        this.subscriptionsToChatEvents.forEach((subscription) => subscription.unsubscribe());
    }
}
