import { beforeAll, describe, expect, test, vi } from "vitest";
import { get } from "svelte/store";
import { MatrixChatConnection } from "../MatrixChatConnection";
import { Connection } from "../../ChatConnection";
import { MatrixClientWrapperInterface } from "../MatrixClientWrapper";
import { matrixClientMock } from "./utils/MatrixClientMock";

const roomConnectionMock: Connection = {
    queryChatMembers: vi.fn(),
};

const matrixClientWrapperMock: MatrixClientWrapperInterface = {
    // @ts-ignore
    initMatrixClient: vi.fn(() => Promise.resolve(matrixClientMock)),
};

let matrixChatConnection: MatrixChatConnection;

describe("MatrixChatConnection tests", () => {
    beforeAll(() => {
        matrixChatConnection = new MatrixChatConnection(roomConnectionMock, matrixClientWrapperMock);
    });

    test("Get users test", () => {
        expect(get(matrixChatConnection.userList)).toEqual(new Map());
    });

    test("Get rooms test", () => {
        expect(get(matrixChatConnection.roomList)).toEqual(new Map());
    });

    test("Create room with error", async () => {
        matrixClientMock.createRoom = vi.fn().mockRejectedValue("Testing catch error on create room");
        await expect(matrixChatConnection.createRoom({ name: "roomTest", visibility: "public" })).rejects.toEqual(
            "Testing catch error on create room"
        );
    });
    test("Create room with success", async () => {
        const createdRoom = { room_id: "1" };
        matrixClientMock.createRoom = vi.fn().mockResolvedValue(createdRoom);
        let listenerOnRoomAddedMock: undefined | (() => void) = undefined;
        // @ts-ignore ignoring all methods of matrixClientMock
        matrixClientMock.on = vi.fn((_, listener) => (listenerOnRoomAddedMock = listener));
        await expect(matrixChatConnection.createRoom({ name: "roomTest", visibility: "public" })).resolves.toEqual(
            createdRoom
        );
        if (listenerOnRoomAddedMock) {
            // @ts-ignore
            listenerOnRoomAddedMock();
            expect(get(matrixChatConnection.roomList)).toHaveLength(1);
        }
    });
});
