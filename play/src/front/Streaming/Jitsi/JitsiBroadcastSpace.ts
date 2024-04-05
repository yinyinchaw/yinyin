import { SpaceFilterMessage } from "@workadventure/messages";
import debug from "debug";
import pLimit from "p-limit";
import { derived, get, Readable, Unsubscriber } from "svelte/store";
import type JitsiConnection from "lib-jitsi-meet/types/hand-crafted/JitsiConnection";
import { ForwardableStore } from "@workadventure/store-utils";
import { RoomConnection } from "../../Connection/RoomConnection";
import { gameManager } from "../../Phaser/Game/GameManager";
import { liveStreamingEnabledStore } from "../../Stores/MegaphoneStore";
import { BroadcastService, jitsiLoadingStore } from "../BroadcastService";
import { BroadcastSpace } from "../Common/BroadcastSpace";
import { JITSI_DOMAIN, JITSI_MUC_DOMAIN, JITSI_XMPP_DOMAIN } from "../../Enum/EnvironmentVariable";
import { SpaceInterface } from "../../Space/SpaceInterface";
import { Space } from "../../Space/Space";
import { LocalSpaceProviderSingleton } from "../../Space/SpaceProvider/SpaceStore";
import { jitsiConferencesStore } from "./JitsiConferencesStore";
import { JitsiConferenceWrapper } from "./JitsiConferenceWrapper";
import { JitsiTrackWrapper } from "./JitsiTrackWrapper";
import { libJitsiFactory } from "./LibJitsiFactory";
// eslint-disable-next-line import/no-unresolved

const limit = pLimit(1);
const jitsiBroadcastSpaceLogger = debug("JitsiBroadcastSpace");

/**
 * This service is in charge of:
 * - tracking in which broadcast zone the user is
 * - sending this zone to the server
 * - listening for clicks on the broadcast button + listening to people entering the stage
 * - listening for a signal we should join a broadcast
 * - keep track of the Jitsi connection / room and restart it if connection is lost
 */
export class JitsiBroadcastSpace extends EventTarget implements BroadcastSpace {
    private conference: JitsiConferenceWrapper | undefined;
    private unsubscribes: Unsubscriber[] = [];
    private jitsiTracks: ForwardableStore<Map<string, JitsiTrackWrapper>>;
    readonly space: SpaceInterface;
    readonly provider = "jitsi";

    constructor(
        private roomConnection: RoomConnection,
        spaceName: string,
        private spaceFilter: SpaceFilterMessage,
        private broadcastService: BroadcastService,
        private playSound: boolean
    ) {
        super();

        this.space = LocalSpaceProviderSingleton.getInstance().add(spaceName);

        this.space.watch(spaceFilter.filterName).setFilter(spaceFilter.filter);

        this.space.setMetadata(new Map([["test", "test"]]));

        this.jitsiTracks = new ForwardableStore<Map<string, JitsiTrackWrapper>>(new Map());

        // When the user leaves the space, we leave the Jitsi conference
        this.unsubscribes.push(
            this.space.getSpaceFilter(spaceFilter.filterName).users.subscribe((users) => {
                if (users.size === 0) {
                    if (this.conference !== undefined) {
                        limit(() => this.conference?.leave("Nobody is streaming anymore ..."))
                            .then(() => {
                                this.conference = undefined;
                            })
                            .catch((e) => {
                                // TODO : Handle the error and retry to leave the conference
                                console.error(e);
                            })
                            .finally(() => {
                                jitsiLoadingStore.set(false);
                                broadcastService.checkIfCanDisconnect(this.provider);
                            });
                    }
                } else {
                    limit(async () => {
                        if (this.conference === undefined) {
                            jitsiLoadingStore.set(true);
                            this.conference = await this.joinJitsiConference(spaceName);
                            this.space.emitJitsiParticipantId(this.conference.participantId);
                            jitsiLoadingStore.set(false);
                        }
                    }).catch((e) => {
                        // TODO : Handle the error and retry to join the conference
                        console.error("Error while joining the conference", e);
                    });
                }
            })
        );
    }

    async joinJitsiConference(roomName: string): Promise<JitsiConferenceWrapper> {
        if (!JITSI_DOMAIN || !JITSI_XMPP_DOMAIN || !JITSI_MUC_DOMAIN) {
            throw new Error("Cannot use Jitsi with a no domain defined, please check your environment variables");
        }

        let jitsiConnection = this.broadcastService.getBroadcastConnection(this.provider);

        if (!jitsiConnection) {
            try {
                jitsiConnection = await libJitsiFactory.createConnection(
                    JITSI_DOMAIN,
                    JITSI_XMPP_DOMAIN,
                    JITSI_MUC_DOMAIN
                );
            } catch (e) {
                jitsiBroadcastSpaceLogger("Error while connecting to Jitsi", e);
            }

            if (!jitsiConnection) {
                jitsiLoadingStore.set(false);
                throw new Error("Could not connect to Jitsi");
            }

            this.broadcastService.setBroadcastConnection(this.provider, jitsiConnection);
        }

        const certifiedJitsiConnection = jitsiConnection as JitsiConnection;

        jitsiBroadcastSpaceLogger("Joining Jitsi conference, jitsiConnection is defined " + roomName);

        const jitsiConference = await JitsiConferenceWrapper.join(certifiedJitsiConnection, roomName);
        jitsiConferencesStore.set(roomName, jitsiConference);

        if (get(liveStreamingEnabledStore)) {
            jitsiConference.broadcast(["video", "audio"]);
        } else if (this.playSound) {
            gameManager.getCurrentGameScene().playSound("audio-megaphone");
        }

        const associatedStreamStore: Readable<Map<string, JitsiTrackWrapper>> = derived(
            [jitsiConference.streamStore, this.space.getSpaceFilter(this.spaceFilter.filterName).users],
            ([$streamStore, $users]) => {
                const filtered = new Map<string, JitsiTrackWrapper>();
                for (const [participantId, stream] of $streamStore) {
                    let found = false;
                    if (stream.spaceUser !== undefined) {
                        if ($users.has(stream.spaceUser.id)) {
                            filtered.set(participantId, stream);
                        }
                        continue;
                    }
                    for (const user of $users.values()) {
                        if (user.jitsiParticipantId === stream.uniqueId) {
                            stream.spaceUser = user;
                            filtered.set(participantId, stream);
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        jitsiBroadcastSpaceLogger(
                            "joinJitsiConference => No associated spaceUser found for participantId" +
                                stream.uniqueId +
                                $users.values()
                        );
                    }
                }
                return filtered;
            }
        );

        this.jitsiTracks.forward(associatedStreamStore);
        return jitsiConference;
    }

    get tracks(): Readable<Map<string, JitsiTrackWrapper>> {
        return this.jitsiTracks;
    }

    destroy() {
        limit(() => this.conference?.leave("I want to leave this space ..."))
            .then(() => {
                this.conference = undefined;
            })
            .catch((e) => {
                console.error(e);
            })
            .finally(() => {
                this.broadcastService.checkIfCanDisconnect(this.provider);
                jitsiLoadingStore.set(false);
            });
        jitsiConferencesStore.delete(this.space.getName());
        this.unsubscribes.forEach((unsubscribe) => unsubscribe());
        this.space.destroy();
    }
}
