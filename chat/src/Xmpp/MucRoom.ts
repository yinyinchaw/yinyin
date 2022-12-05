import type { Readable, Writable } from "svelte/store";
import { get, writable } from "svelte/store";
import { mucRoomsStore } from "../Stores/MucRoomsStore";
import { v4 as uuid } from "uuid";
import { userStore } from "../Stores/LocalUserStore";
import { fileMessageManager } from "../Services/FileMessageManager";
import { mediaManager, NotificationType } from "../Media/MediaManager";
import { availabilityStatusStore, filesUploadStore, mentionsUserStore } from "../Stores/ChatStore";
import { AbstractRoom, MessageType, User } from "./AbstractRoom";
import { XmppClient } from "./XmppClient";
import * as StanzaProtocol from "stanza/protocol";
import { WaLink, WaReceivedReactions, WaUserInfo } from "./Lib/Plugin";
import { ParsedJID } from "stanza/JID";
import { ChatStateMessage, JID } from "stanza";
import { ChatState, MUCAffiliation } from "stanza/Constants";
import { Message } from "../Model/Message";

const _VERBOSE = true;

export type UserList = Map<string, User>;
export type UsersStore = Readable<UserList>;

export class MucRoom extends AbstractRoom {
    private presenceStore: Writable<UserList>;
    private canLoadOlderMessagesStore: Writable<boolean>;
    private showDisabledLoadOlderMessagesStore: Writable<boolean>;
    private description: string = "";
    private loadingSubscribers: Writable<boolean>;
    private readyStore: Writable<boolean>;

    constructor(
        xmppClient: XmppClient,
        public readonly name: string,
        protected roomJid: ParsedJID,
        public type: string,
        public subscribe: boolean
    ) {
        super(xmppClient, _VERBOSE);
        this.presenceStore = writable<UserList>(new Map<string, User>());
        this.canLoadOlderMessagesStore = writable<boolean>(true);
        this.showDisabledLoadOlderMessagesStore = writable<boolean>(false);
        this.loadingSubscribers = writable<boolean>(false);
        this.readyStore = writable<boolean>(type === "default");
    }

    get recipient(): string {
        return JID.create({
            local: this.roomJid.local,
            domain: this.roomJid.domain,
            resource: this.xmppClient.getMyResource(),
        });
    }
    get url(): string {
        return this.roomJid.bare;
    }

    public getUserByJid(jid: string): User {
        const user = get(this.presenceStore).get(jid);
        if (!user) {
            throw new Error("No user found for this JID");
        }
        return user;
    }

    public reInitialize() {
        // Destroy room in ejabberd
        void this.sendDestroy();
        // Recreate room in ejabberd
        //setTimeout(() => this.sendPresence(), 100);
        // Tell all users to subscribe to it
        //setTimeout(() => this.xmppClient.getConnection().emitJoinMucRoom(this.name, this.type, this.roomJid.local), 200);
    }

    public connect() {
        this.sendPresence(true);
    }

    // Functions used to send message to the server
    public sendPresence(first: boolean = false) {
        if (this.closed) {
            return;
        }
        const presenceId = uuid();
        if (first) {
            this.subscriptions.set("firstPresence", presenceId);
        }
        //this.xmppClient.socket.sendPresence({ to: this.recipient, id: presenceId });
        this.sendUserInfo(presenceId);
        if (_VERBOSE)
            console.warn(
                `[XMPP][${this.name}]`,
                ">> ",
                first && "First",
                "Presence sent",
                get(userStore).uuid,
                presenceId
            );
    }
    sendUserInfo(presenceId: string = uuid()) {
        this.xmppClient.socket.sendUserInfo(this.recipient, presenceId, {
            jid: this.xmppClient.getMyJID(),
            roomPlayUri: get(userStore).playUri,
            roomName: get(userStore).roomName ?? "",
            userUuid: get(userStore).uuid,
            userColor: get(userStore).color,
            userWoka: get(userStore).woka,
            name: this.playerName,
            // If you can subscribe to the default muc room, this is that you are a member
            userIsMember: mucRoomsStore.getDefaultRoom()?.subscribe ?? false,
            userAvailabilityStatus: get(availabilityStatusStore),
            userVisitCardUrl: get(userStore).visitCardUrl ?? "",
        });
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> UserInfo sent");
    }
    public sendDisconnect() {
        if (this.closed) {
            this.xmppClient.removeMuc(this);
            return;
        }
        void this.xmppClient.socket.leaveRoom(this.recipient);
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Disconnect sent");
        this.xmppClient.removeMuc(this);
    }
    private async sendRequestAllSubscribers() {
        if (this.closed) {
            return;
        }
        const iqId = uuid();
        this.subscriptions.set("subscriptions", iqId);
        this.loadingSubscribers.set(true);
        try {
            if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Get all subscribers sent");
            const response = await this.xmppClient.socket.sendIQ({
                type: "get",
                to: this.url,
                subscriptions: { usersNick: [], usersJid: [] },
            });
            if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, "<< Get all subscribers received");
            response.subscriptions.usersJid.forEach((userJid, i) => {
                if (![...get(this.presenceStore)].find(([_userJid, _]) => _userJid.includes(userJid))) {
                    this.addUserInactive(userJid, response.subscriptions.usersNick[i]);
                }
            });
        } catch (e) {
            console.error("sendRequestAllSubscribers => error", e);
        }
        this.loadingSubscribers.set(false);
    }
    public sendRankUp(userJID: string) {
        void this.sendAffiliate("admin", userJID);
    }
    public sendRankDown(userJID: string) {
        void this.sendAffiliate("none", userJID);
    }
    private async sendAffiliate(type: MUCAffiliation, userJID: string) {
        if (this.closed) {
            return;
        }
        const response = await this.xmppClient.socket.setRoomAffiliation(this.roomJid.bare, userJID, type, "test");
        console.warn(response);
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Affiliation sent");
    }
    public sendBan(userJID: string, name: string, playUri: string) {
        if (this.closed) {
            return;
        }
        console.warn("Implement the ban method to send the message to the front > pusher (> admin)", {
            userJID,
            name,
            playUri,
        });
        void this.sendAffiliate("outcast", userJID);
        //this.xmppClient.getConnection().emitBanUserByUuid(playUri, userJID.local, name, "Test message de ban");
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Ban user message sent");
    }
    public sendChatState(state: ChatState) {
        if (this.closed) {
            return;
        }
        this.xmppClient.socket.sendGroupChatMessage({
            to: this.roomJid.full,
            chatState: state,
            jid: this.xmppClient.getMyPersonalJID(),
        });
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Chat state sent");
    }
    public sendMessage(text: string, messageReply?: Message) {
        if (this.closed) {
            return;
        }
        const idMessage = uuid();
        let links_: WaLink[] = [];
        let links = {};
        if (get(filesUploadStore).size > 0) {
            links = { links: fileMessageManager.jsonFiles };
            links_ = fileMessageManager.jsonFiles;
        }
        if (messageReply) {
            let messageReplyLinks = {};
            if (messageReply.links != undefined) {
                messageReplyLinks = { links: JSON.stringify(messageReply.links) };
            }
            this.xmppClient.socket.sendGroupChatMessage({
                to: this.roomJid.full,
                id: idMessage,
                jid: this.xmppClient.getMyPersonalJID(),
                body: text,
                messageReply: {
                    to: messageReply.from,
                    id: messageReply.id,
                    senderName: messageReply.name,
                    body: messageReply.body,
                    ...messageReplyLinks,
                },
                ...links,
            });
        } else {
            this.xmppClient.socket.sendGroupChatMessage({
                to: this.roomJid.full,
                id: idMessage,
                jid: this.xmppClient.getMyPersonalJID(),
                body: text,
                ...links,
            });
        }

        const message = new Message(
            text,
            this.xmppClient.getPlayerName(),
            this.xmppClient.getMyPersonalJID(),
            new Date(),
            idMessage,
            false,
            false,
            this.xmppClient.getMyJID(),
            messageReply ? MessageType.reply : MessageType.message,
            messageReply
                ? {
                      id: messageReply.id,
                      senderName: messageReply.name,
                      body: messageReply.body,
                      links: messageReply.links,
                  }
                : undefined,
            undefined,
            links_,
            [...get(mentionsUserStore).values()]
        );

        this.messageStore.push(message);

        fileMessageManager.reset();
        mentionsUserStore.set(new Set<User>());

        this.updateLastMessageSeen();

        if (this.sendTimeOut) {
            clearTimeout(this.sendTimeOut);
            this.sendTimeOut = undefined;
        }
        this.sendTimeOut = setTimeout(() => this.messageStore.get(message.id)?.setError(true), 10_000);
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Message sent");
    }
    public sendRemoveMessage(messageId: string) {
        if (this.closed) {
            return;
        }
        this.xmppClient.socket.sendGroupChatMessage({
            to: this.roomJid.full,
            id: uuid(),
            jid: this.xmppClient.getMyPersonalJID(),
            body: "",
            remove: {
                id: messageId,
            },
        });
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Remove message sent");
    }
    public sendReactionMessage(emojiTargeted: string, messageId: string) {
        if (this.closed) {
            return;
        }
        let newReactions = [];
        const myReaction = this.reactionMessageStore
            .get(messageId)
            ?.find((reactionMessage) => reactionMessage.userJid === this.xmppClient.getMyPersonalJID());
        if (myReaction) {
            if (myReaction.userReactions.find((emoji) => emoji === emojiTargeted)) {
                newReactions = myReaction.userReactions.filter((emoji) => emoji !== emojiTargeted);
            } else {
                newReactions = [...myReaction.userReactions, emojiTargeted];
            }
        } else {
            newReactions.push(emojiTargeted);
        }
        this.xmppClient.socket.sendGroupChatMessage({
            to: this.roomJid.full,
            id: uuid(),
            jid: this.xmppClient.getMyPersonalJID(),
            body: "",
            reactions: {
                id: messageId,
                reaction: newReactions,
            },
        });
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Reaction message sent");

        this.toggleReactionsMessage(this.xmppClient.getMyPersonalJID(), messageId, newReactions);
    }
    public sendDestroy() {
        if (this.closed) {
            return;
        }
        const destroyId = uuid();
        this.subscriptions.set("destroy", destroyId);
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Destroy room sent");
        this.readyStore.set(false);
        try {
            void this.xmppClient.socket.destroyRoom(this.roomJid.full, {
                reason: `Re initialisation by administrator (${destroyId})`,
            });
        } catch (e) {
            console.error("Error on sendDestroy", e);
            this.subscriptions.delete("destroy");
            this.readyStore.set(true);
        }
    }
    public async sendRetrieveLastMessages(max: number = 50) {
        if (this.closed) {
            return;
        }
        const firstMessage = [...get(this.messageStore).values()]
            .sort((a, b) => a.time.getTime() - b.time.getTime())
            .shift();
        this.loadingStore.set(true);
        const now = new Date();
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, ">> Retrieve last messages sent");
        const response = await this.xmppClient.socket.searchHistory(this.roomJid.bare, {
            version: "2",
            form: {
                type: "submit",
                fields: [
                    {
                        name: "FORM_TYPE",
                        type: "hidden",
                        value: "urn:xmpp:mam:2",
                    },
                    {
                        name: "end",
                        value: firstMessage ? firstMessage.time.toISOString() : now.toISOString(),
                    },
                ],
            },
            paging: {
                max,
            },
        });
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, "<< Retrieve last messages received");
        if (response.paging && response.paging.count !== undefined) {
            const newMessages: Message[] = [];
            response.results?.reverse();
            response.results?.forEach((result) => {
                if (result.item.message) {
                    const message = result.item.message as StanzaProtocol.ReceivedMessage;
                    this.parseMessageType(message);
                    if (this.parseMessageType(message) !== "new") {
                        this.onMessage(message, result.item.delay);
                    } else {
                        newMessages.push(this.parseMessage(message, result.item.delay));
                    }
                }
            });
            if (newMessages.length > 0) {
                this.messageStore.unshift(...newMessages);
            }
            if (response.paging.count < 50) {
                this.canLoadOlderMessagesStore.set(false);
            }
        }
        this.loadingStore.set(false);
    }

    // Function used to interpret message from the server
    onMessage(receivedMessage: StanzaProtocol.ReceivedMessage, delay: StanzaProtocol.Delay | null = null): boolean {
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, "<< Message received");
        if (!receivedMessage.jid) {
            throw new Error("No JID set for the message");
        } else if (!receivedMessage.id) {
            throw new Error("No id set for the message");
        }
        let response = false;
        const messageId = receivedMessage.id ?? "";
        switch (this.parseMessageType(receivedMessage)) {
            case "subject": {
                // If subject message, we do nothing for the moment
                response = true;
                break;
            }
            case "exist": {
                this.updateLastMessageSeen();
                this.messageStore.get(messageId)?.setError(false);
                this.messageStore.get(messageId)?.setDelivered(true);
                response = true;
                break;
            }
            case "remove": {
                const removedId = receivedMessage.remove?.id;
                if (removedId) {
                    this.deletedMessagesStore.update((deletedMessages) => {
                        deletedMessages.set(removedId, JID.toBare(receivedMessage.jid));
                        return deletedMessages;
                    });
                    response = true;
                }
                break;
            }
            case "new": {
                let date = new Date();
                if (delay) {
                    // Only in case where the message received is an archive (a message automatically sent by the server when joining a room)
                    date = new Date(delay.timestamp);
                }
                if (date !== null && date > this.lastMessageSeen && !delay) {
                    this.countMessagesToSee.update((last) => last + 1);
                    if (/*get(activeThreadStore) !== this ||*/ get(availabilityStatusStore) !== 1) {
                        if (receivedMessage.nick) {
                            mediaManager.playNewMessageNotification();
                            mediaManager.createNotification(receivedMessage.nick, NotificationType.message, this.name);
                        }
                    }
                }

                const message = this.parseMessage(receivedMessage, delay);
                this.messageStore.push(message);
                response = true;
                break;
            }
        }
        return response;
    }
    onReactions(receivedMessage: WaReceivedReactions) {
        if (!receivedMessage.jid) {
            throw new Error("No JID set for the message");
        }
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, "<< Reaction message received");
        this.toggleReactionsMessage(
            receivedMessage.jid,
            receivedMessage.reactions.id,
            receivedMessage.reactions.reaction
        );
        return true;
    }
    onChatState(chatState: ChatStateMessage): boolean {
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, "<< Chat state received");
        if (!chatState.jid) {
            throw new Error("No jid");
        }
        const from = JID.parse(chatState.jid);
        this.updateChatState(from, chatState.chatState as ChatState);
        return true;
    }
    onPresence(presence: StanzaProtocol.ReceivedPresence): boolean {
        if (_VERBOSE) console.warn(`[XMPP][${this.name}]`, "<< Presence received");
        let response = false;

        if (presence.id) {
            // If last registered presence received
            if (this.subscriptions.get("firstPresence") === presence.id) {
                this.subscriptions.delete("firstPresence");
                this.readyStore.set(true);
                this.closed = false;
                this.sendUserInfo();
                if (this.type === "live") {
                    void this.sendRetrieveLastMessages(20);
                }
                if (userStore.get().isLogged && this.subscribe && this.type === "default") {
                    void this.sendRequestAllSubscribers();
                }
            } else if (this.subscriptions.get("firstSubscribe") === presence.id) {
                this.subscriptions.delete("firstSubscribe");
                this.closed = false;
            }
        }
        const from = JID.parse(presence.from);
        if (!from.resource) {
            // Signify that this presence is coming from the room and not from a user
            if (presence.type === "unavailable") {
                this.readyStore.set(false);
                //this.xmppClient.removeMuc(this);
                response = true;
            }
        } else {
            if (presence.userInfo) {
                this.updateUserInfo(presence.userInfo);
                response = true;
            }
            const muc = presence.muc as StanzaProtocol.MUCInfo;
            if (muc && muc.jid) {
                this.updateActive(JID.parse(muc.jid), presence.type !== "unavailable");
                if (muc.role) {
                    this.updateRole(JID.parse(muc.jid), muc.role);
                }
                response = true;
            }
        }

        const muc = presence.muc as StanzaProtocol.MUCInfo;
        if (muc && muc.action === "destroy") {
            if (muc.destroy?.reason?.includes("Re initialisation by administrator")) {
                this.subscriptions.clear();
                if (
                    this.subscriptions.has("destroy") &&
                    muc.destroy?.reason?.includes(this.subscriptions.get("destroy") ?? "unknown")
                ) {
                    this.sendPresence(true);
                } else {
                    setTimeout(() => this.sendPresence(true), 1000);
                }
            } else {
                this.closed = true;
            }
            response = true;
        }

        return response;
    }

    // Update presenceStore
    updateActive(jid: ParsedJID, active: boolean) {
        this.presenceStore.update((presenceStore: UserList) => {
            const user = presenceStore.get(jid.full);
            if (user) {
                // If disconnected user : [1) It's the default room, 2) I'm a member, 3) The user is a member, 4) The user is not connected with another ressource] else if the user is connected
                if (
                    (this.type === "default" &&
                        !active &&
                        this.subscribe &&
                        user.isMember &&
                        [...presenceStore.keys()].filter((userJid) => JID.toBare(userJid) === jid.bare).length <= 1) ||
                    active
                ) {
                    presenceStore.set(jid.full, { ...user, active });
                } else {
                    presenceStore.delete(jid.full);
                }
            }
            return presenceStore;
        });
    }
    updateRole(jid: ParsedJID, role: string) {
        this.presenceStore.update((presenceStore: UserList) => {
            const user = presenceStore.get(jid.full);
            if (user) {
                presenceStore.set(jid.full, { ...user, role, isAdmin: ["admin", "moderator", "owner"].includes(role) });
            }
            return presenceStore;
        });
    }
    updateChatState(jid: ParsedJID, state: ChatState) {
        this.presenceStore.update((presenceStore: UserList) => {
            const user = presenceStore.get(jid.full);
            if (user) {
                presenceStore.set(jid.full, { ...user, chatState: state });
            }
            return presenceStore;
        });
    }
    updateUserInfo(userInfo: WaUserInfo) {
        this.presenceStore.update((presenceStore: UserList) => {
            const userJID = JID.parse(userInfo.jid);
            const user = presenceStore.get(userJID.full);
            if (user) {
                presenceStore.set(userJID.full, {
                    ...user,
                    jid: userJID.full,
                    name: userInfo.name,
                    playUri: userInfo.roomPlayUri,
                    roomName: userInfo.roomName,
                    uuid: userInfo.userUuid,
                    color: userInfo.userColor,
                    woka: userInfo.userWoka,
                    isMember: userInfo.userIsMember,
                    isInSameMap: userInfo.roomPlayUri === userStore.get().playUri,
                    availabilityStatus: userInfo.userAvailabilityStatus,
                    visitCardUrl: userInfo.userVisitCardUrl,
                });
            } else {
                presenceStore.forEach((user, jid) => {
                    if (JID.toBare(jid) === userJID.bare) {
                        presenceStore.delete(jid);
                    }
                });
                presenceStore.set(userJID.full, {
                    jid: userJID.full,
                    name: userInfo.name,
                    active: true,
                    isMe: this.xmppClient.getMyJID() === userJID.full,
                    playUri: userInfo.roomPlayUri,
                    roomName: userInfo.roomName,
                    uuid: userInfo.userUuid,
                    color: userInfo.userColor,
                    woka: userInfo.userWoka,
                    isMember: userInfo.userIsMember,
                    isInSameMap: userInfo.roomPlayUri === userStore.get().playUri,
                    availabilityStatus: userInfo.userAvailabilityStatus,
                    visitCardUrl: userInfo.userVisitCardUrl,
                });
            }
            return presenceStore;
        });
    }
    addUserInactive(userJid: string, nickname: string) {
        this.presenceStore.update((presenceStore: UserList) => {
            const userJID = JID.parse(userJid);
            const user = presenceStore.get(userJID.full);
            if (!user) {
                presenceStore.set(userJid, {
                    jid: userJid,
                    name: nickname,
                    active: false,
                    isMe: this.xmppClient.getMyJID() === userJid,
                    isMember: true,
                });
            }
            return presenceStore;
        });
    }

    // Update reaction and messages
    public sendBack(idMessage: string): boolean {
        throw new Error("Not implemented yet");
        // this.messageStore.update((messages) => {
        //     this.sendMessage(messages.find((message) => message.id === idMessage)?.body ?? "");
        //     return messages.filter((message) => message.id !== idMessage);
        // });
    }

    // Get all stores
    public getPresenceStore(): UsersStore {
        return this.presenceStore;
    }
    public getLoadingSubscribersStore() {
        return this.loadingSubscribers;
    }
    public getCanLoadOlderMessagesStore() {
        return this.canLoadOlderMessagesStore;
    }
    public getShowDisabledLoadOlderMessagesStore() {
        return this.showDisabledLoadOlderMessagesStore;
    }
    public getRoomReadyStore() {
        return this.readyStore;
    }
}
