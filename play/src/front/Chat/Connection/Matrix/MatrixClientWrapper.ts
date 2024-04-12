import { createClient, IndexedDBCryptoStore, IndexedDBStore, MatrixClient } from "matrix-js-sdk";
import { localUserStore } from "../../../Connection/LocalUserStore";

export interface MatrixClientWrapperInterface {
    initMatrixClient(): Promise<MatrixClient>;
}
export class MatrixClientWrapper implements MatrixClientWrapperInterface {
    constructor(private baseUrl: string) {}

    public async initMatrixClient(): Promise<MatrixClient> {
        const userId = localUserStore.getLocalUser()?.uuid;
        if (!userId) {
            throw new Error("UserUUID is undefined, this is not supposed to happen.");
        }

        let accessToken: string | null, refreshToken: string | null, matrixUserId: string | null;
        const {
            deviceId,
            accessToken: accessTokenFromLocalStorage,
            refreshToken: refreshTokenFromLocalStorage,
            matrixLoginToken,
            matrixUserId: matrixUserIdFromLocalStorage,
        } = this.retrieveMatrixConnectionDataFromLocalStorage(userId);
        accessToken = accessTokenFromLocalStorage;
        refreshToken = refreshTokenFromLocalStorage;
        matrixUserId = matrixUserIdFromLocalStorage;

        const oldMatrixUserId: string | null = matrixUserIdFromLocalStorage;
        if (matrixLoginToken !== null) {
            const {
                accessToken: accessTokenFromLoginToken,
                refreshToken: refreshTokenFromLoginToken,
                matrixUserId: userIdFromLoginToken,
            } = await this.retrieveMatrixConnectionDataFromLoginToken(this.baseUrl, matrixLoginToken, deviceId);
            accessToken = accessTokenFromLoginToken;
            refreshToken = refreshTokenFromLoginToken;
            matrixUserId = userIdFromLoginToken;
            localUserStore.setMatrixLoginToken(null);
        }

        if (accessToken === null && refreshToken === null) {
            const {
                accessToken: accessTokenFromGuestUser,
                refreshToken: refreshTokenFromGuestUser,
                matrixUserId: matrixUserIdFromGuestUser,
            } = await this.registerMatrixGuestUser();
            accessToken = accessTokenFromGuestUser;
            refreshToken = refreshTokenFromGuestUser;
            matrixUserId = matrixUserIdFromGuestUser;
        }

        if (!accessToken) {
            console.error("Unable to connect to matrix, access token is null");
            throw new Error("Unable to connect to matrix, access token is null");
        }

        if (!matrixUserId) {
            console.error("Unable to connect to matrix, matrixUserId is null");
            throw new Error("Unable to connect to matrix, matrixUserId is null");
        }

        const { matrixStore, matrixCryptoStore } = this.matrixWebClientStore(matrixUserId, deviceId);
        // Now, let's instantiate the Matrix client.
        const matrixClient = createClient({
            baseUrl: this.baseUrl,
            deviceId,
            userId: matrixUserId,
            accessToken: accessToken,
            refreshToken: refreshToken ?? undefined,
            store: matrixStore,
            cryptoStore: matrixCryptoStore,
        });
        if (oldMatrixUserId !== matrixUserId) {
            await matrixClient.clearStores();
        }

        return matrixClient;
    }

    private retrieveMatrixConnectionDataFromLocalStorage(userId: string) {
        let deviceId = localUserStore.getMatrixDeviceId(userId);
        if (deviceId === null) {
            deviceId = this.generateDeviceId();
            localUserStore.setMatrixDeviceId(deviceId, userId);
        }
        const accessToken = localUserStore.getMatrixAccessToken();
        const refreshToken = localUserStore.getMatrixRefreshToken();
        const matrixUserId = localUserStore.getMatrixUserId();
        const matrixLoginToken = localUserStore.getMatrixLoginToken();
        return { deviceId, accessToken, refreshToken, matrixUserId, matrixLoginToken };
    }

    private async registerMatrixGuestUser(): Promise<{
        matrixUserId: string;
        accessToken: string | null;
        refreshToken: string | null;
    }> {
        const client = createClient({
            baseUrl: this.baseUrl,
        });
        try {
            const { access_token, refresh_token, user_id } = await client.registerGuest({
                body: {
                    initial_device_display_name: localUserStore.getName() || "",
                    refresh_token: true,
                },
            });
            localUserStore.setMatrixUserId(user_id);
            localUserStore.setMatrixAccessToken(access_token ?? null);
            localUserStore.setMatrixRefreshToken(refresh_token ?? null);
            client.setGuest(true);
            return { matrixUserId: user_id, accessToken: access_token ?? null, refreshToken: refresh_token ?? null };
        } catch (error) {
            console.error(error);
            throw new Error("Unable to etablish a Matrix Guest connection");
        }
    }

    private matrixWebClientStore(matrixUserId: string, deviceId: string) {
        const indexDbStore = new IndexedDBStore({
            indexedDB: globalThis.indexedDB,
            localStorage: globalThis.localStorage,
            dbName: "workadventure-matrix",
        });

        const indexDbCryptoStore = new IndexedDBCryptoStore(
            globalThis.indexedDB,
            "crypto-store-" + this.baseUrl + "-" + matrixUserId + "-" + deviceId
        );

        return { matrixStore: indexDbStore, matrixCryptoStore: indexDbCryptoStore };
    }

    private async retrieveMatrixConnectionDataFromLoginToken(
        matrixServerUrl: string,
        loginToken: string,
        deviceId: string
    ): Promise<{
        matrixUserId: string;
        accessToken: string;
        refreshToken: string | null;
    }> {
        const client = createClient({
            baseUrl: matrixServerUrl,
        });

        const { user_id, access_token, refresh_token, expires_in_ms } = await client.login("m.login.token", {
            token: loginToken,
            device_id: deviceId,
            initial_device_display_name: "WorkAdventure",
        });

        localUserStore.setMatrixUserId(user_id);
        localUserStore.setMatrixAccessToken(access_token);
        localUserStore.setMatrixRefreshToken(refresh_token ?? null);
        if (expires_in_ms !== undefined) {
            const expireDate = new Date();
            // Add response.expires_in milliseconds to the current date.
            expireDate.setMilliseconds(expireDate.getMilliseconds() + expires_in_ms);
            localUserStore.setMatrixAccessTokenExpireDate(expireDate);
        }

        // Note: we ignore the device ID returned by the server. We use the one we generated.
        // This will be required in the future when we switch to a Native OpenID Matrix client.
        return {
            matrixUserId: user_id,
            accessToken: access_token,
            refreshToken: refresh_token ?? null,
        };
    }

    private generateDeviceId(): string {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let result = "";
        for (let i = 0; i < 10; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}
