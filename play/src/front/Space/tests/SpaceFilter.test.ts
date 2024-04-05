import { describe, it, expect, vi } from "vitest";

vi.mock("../../Phaser/Entity/CharacterLayerManager", async () => {
    return {
        wokaBase64(): Promise<string> {
            return Promise.resolve("");
        },
    };
});

import { SpaceFilterMessage, SpaceUser } from "@workadventure/messages";
import { Writable, get, writable } from "svelte/store";
import {
    SpaceFilterInterface,
    SpaceFilter,
    Filter,
    SpaceUserExtended,
} from "../SpaceFilter/SpaceFilter";

describe("SpaceFilter", () => {
    describe("userExist", () => {
        it("should return false if user does not exist", () => {
            const spaceFilterName = "space-filter-name";
            const spaceName = "space-name";
            const user: SpaceUserExtended = {
                id: 0,
                name: "",
                playUri: "",
                color: "",
                characterTextures: [],
                isLogged: false,
                availabilityStatus: 0,
                roomName: undefined,
                visitCardUrl: undefined,
                tags: [],
                cameraState: false,
                microphoneState: false,
                screenSharingState: false,
                megaphoneState: false,
                jitsiParticipantId: undefined,
                uuid: "",
            };

            const userMap: Writable<Map<number, SpaceUserExtended>> = writable(
                new Map<number, SpaceUserExtended>([[user.id, user]])
            );

            const spaceFilter: SpaceFilterInterface = new SpaceFilter(
                spaceFilterName,
                spaceName,
                undefined,
                undefined,
                userMap
            );

            const result = spaceFilter.userExist(user.id);

            expect(result).toBeTruthy();
        });
        it("should return true if user exist in list ", () => {
            const spaceFilterName = "space-filter-name";
            const spaceName = "space-name";
            const user: SpaceUser = {
                id: 0,
            };

            const spaceFilter: SpaceFilterInterface = new SpaceFilter(spaceFilterName, spaceName);

            const result = spaceFilter.userExist(user.id);

            expect(result).toBeFalsy();
        });
    });
    describe("addUser", () => {
        //not throw a error because this function is call when you receive a message by the pusher
        it("should add user when user is not exist in list  ", () => {
            const spaceFilterName = "space-filter-name";
            const spaceName = "space-name";
            const id = 0;
            const user: SpaceUserExtended = {
                id,
            };

            const spaceFilter: SpaceFilterInterface = new SpaceFilter(spaceFilterName, spaceName);
            spaceFilter.addUser(user);
            expect(get(spaceFilter.users).has(user.id)).toBeTruthy();
        });

        it("should not overwrite user when you add a new user and he already exist", () => {
            const spaceFilterName = "space-filter-name";
            const spaceName = "space-name";
            const id = 0;
            const user: SpaceUserExtended = {
                id,
            };

            const userWithSameID: SpaceUserExtended = {
                id,
                name: "user-name",
            };

            const userMap: Writable<Map<number, SpaceUserExtended>> = writable(
                new Map<number, SpaceUserExtended>([[user.id, user]])
            );

            const spaceFilter: SpaceFilterInterface = new SpaceFilter(
                spaceFilterName,
                spaceName,
                undefined,
                undefined,
                userMap
            );
            spaceFilter.addUser(userWithSameID);

            const userInStore = get(spaceFilter.users).get(id);

            expect(userInStore?.id).toEqual(id);
            expect(userInStore?.name).toBeUndefined();
        });
    });
    describe("updateUserData", () => {
        it("should not update userdata when user object do not have id ", () => {
            const spaceFilterName = "space-name";
            const spaceName = "space-name";
            const id = 0;

            const user: SpaceUserExtended = {
                id,
                name: "user-1",
            };

            const newData: Partial<SpaceUserExtended> = {
                name: "user-2",
                availabilityStatus: 1,
                roomName: "world",
            };

            const userMap: Writable<Map<number, SpaceUserExtended>> = writable(
                new Map<number, SpaceUserExtended>([[user.id, user]])
            );

            const spaceFilter: SpaceFilterInterface = new SpaceFilter(
                spaceFilterName,
                spaceName,
                undefined,
                undefined,
                userMap
            );

            spaceFilter.updateUserData(newData);

            expect(spaceFilter.getUser(id)).toStrictEqual(user);
        });
        it("should update user data when user object have a id ", () => {
            const spaceFilterName = "space-filter-name";
            const spaceName = "space-name";
            const id = 0;

            const user: SpaceUserExtended = {
                id,
                name: "user-1",
            };

            const newData: Partial<SpaceUserExtended> = {
                id,
                name: "user-2",
                availabilityStatus: 1,
                roomName: "world",
            };

            const updatedUserResult = {
                ...user,
                ...newData,
            };
            const userMap: Writable<Map<number, SpaceUserExtended>> = writable(
                new Map<number, SpaceUserExtended>([[user.id, user]])
            );

            const spaceFilter: SpaceFilterInterface = new SpaceFilter(
                spaceFilterName,
                spaceName,
                undefined,
                undefined,
                userMap
            );

            spaceFilter.updateUserData(newData);

            const updatedUser = spaceFilter.getUser(id);

            expect(updatedUser).toStrictEqual(updatedUserResult);
        });
        it("should not update userdata when user object have a incorrect id ", () => {
            const spaceFilterName = "space-filter-name";
            const spaceName = "space-name";
            const id = 0;

            const user: SpaceUserExtended = {
                id,
                name: "user-1",
            };

            const newData: Partial<SpaceUser> = {
                id: 404,
                name: "user-2",
                availabilityStatus: 1,
                roomName: "world",
            };

            const userMap: Writable<Map<number, SpaceUserExtended>> = writable(
                new Map<number, SpaceUserExtended>([[user.id, user]])
            );

            const spaceFilter: SpaceFilterInterface = new SpaceFilter(
                spaceFilterName,
                spaceName,
                undefined,
                undefined,
                userMap
            );

            spaceFilter.updateUserData(newData);

            const updatedUser = spaceFilter.getUser(id);

            expect(updatedUser).toStrictEqual(user);
        });
    });

    describe("emitFilterEvent", () => {
        it("emit addSpaceFilter event when you create spaceFilter", () => {
            const spaceFilterName = "space-filter-name";
            const spaceName = "space-name";

            const userMap: Writable<Map<number, SpaceUserExtended>> = writable(new Map<number, SpaceUserExtended>([]));

            const spaceFilterEventEmitter: SpaceFilterEventEmitterInterface = {
                addSpaceFilter: vi.fn(),
                removeSpaceFilter: vi.fn(),
                updateSpaceFilter: vi.fn(),
            };

            new SpaceFilter(spaceFilterName, spaceName, undefined, spaceFilterEventEmitter, userMap);

            const spaceFilterMessage: SpaceFilterMessage = {
                filterName: spaceFilterName,
                spaceName,
            };

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(spaceFilterEventEmitter.addSpaceFilter).toHaveBeenCalledOnce();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(spaceFilterEventEmitter.addSpaceFilter).toHaveBeenCalledWith(spaceFilterMessage);
        });

        it("emit removeSpaceFilter event when you create spaceFilter", () => {
            const spaceFilterName = "space-filter-name";
            const spaceName = "space-name";

            const userMap: Writable<Map<number, SpaceUserExtended>> = writable(new Map<number, SpaceUserExtended>([]));

            const spaceFilterEventEmitter: SpaceFilterEventEmitterInterface = {
                addSpaceFilter: vi.fn(),
                removeSpaceFilter: vi.fn(),
                updateSpaceFilter: vi.fn(),
            };

            const spaceFilter = new SpaceFilter(
                spaceFilterName,
                spaceName,
                undefined,
                spaceFilterEventEmitter,
                userMap
            );
            spaceFilter.destroy();

            const spaceFilterMessage: SpaceFilterMessage = {
                filterName: spaceFilterName,
                spaceName,
            };

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(spaceFilterEventEmitter.removeSpaceFilter).toHaveBeenCalledOnce();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(spaceFilterEventEmitter.removeSpaceFilter).toHaveBeenCalledWith(spaceFilterMessage);
        });
        it("emit updateSpaceFilter event when you update spaceFilter", () => {
            const spaceFilterName = "space-filter-name";
            const spaceName = "space-name";

            const userMap: Writable<Map<number, SpaceUserExtended>> = writable(new Map<number, SpaceUserExtended>([]));

            const spaceFilterEventEmitter: SpaceFilterEventEmitterInterface = {
                addSpaceFilter: vi.fn(),
                removeSpaceFilter: vi.fn(),
                updateSpaceFilter: vi.fn(),
            };

            const newFilter: Filter = {
                $case: "spaceFilterEverybody",
                spaceFilterEverybody: {},
            };

            const spaceFilter = new SpaceFilter(
                spaceFilterName,
                spaceName,
                undefined,
                spaceFilterEventEmitter,
                userMap
            );

            spaceFilter.setFilter(newFilter);

            const spaceFilterMessage: SpaceFilterMessage = {
                filterName: spaceFilterName,
                spaceName,
                filter: newFilter,
            };

            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(spaceFilterEventEmitter.updateSpaceFilter).toHaveBeenCalledOnce();
            // eslint-disable-next-line @typescript-eslint/unbound-method
            expect(spaceFilterEventEmitter.updateSpaceFilter).toHaveBeenCalledWith(spaceFilterMessage);
        });
    });
});
