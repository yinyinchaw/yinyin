import { gameManager } from "../Game/GameManager";
import { ResizableScene } from "./ResizableScene";
import { enableCameraSceneVisibilityStore } from "../../Stores/MediaStore";
import { localUserStore } from "../../Connexion/LocalUserStore";

export const EnableCameraSceneName = "EnableCameraScene";

export class EnableCameraScene extends ResizableScene {
    constructor() {
        super({
            key: EnableCameraSceneName,
        });
    }

    preload() {}

    create() {
        if (localUserStore.getCameraSetup()) {
            this.login();
        }

        this.input.keyboard.on("keyup-ENTER", () => {
            this.login();
        });

        enableCameraSceneVisibilityStore.showEnableCameraScene();
    }

    public onResize(): void {}

    update(time: number, delta: number): void {}

    public login(): void {
        enableCameraSceneVisibilityStore.hideEnableCameraScene();

        this.scene.sleep(EnableCameraSceneName);
        gameManager.goToStartingMap();
    }
}
