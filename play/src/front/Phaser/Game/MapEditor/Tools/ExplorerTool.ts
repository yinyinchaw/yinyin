import { EditMapCommandMessage } from "@workadventure/messages";
import debug from "debug";
import { Unsubscriber, get } from "svelte/store";
import { AreaData } from "@workadventure/map-editor";
import { GameMapFrontWrapper } from "../../GameMap/GameMapFrontWrapper";
import { analyticsClient } from "../../../../Administration/AnalyticsClient";
import {
    mapEditorVisibilityStore,
    mapExplorationAreasStore,
    mapExplorationEntitiesStore,
    mapExplorationModeStore,
    mapExplorationObjectSelectedStore,
} from "../../../../Stores/MapEditorStore";
import { gameManager } from "../../GameManager";
import { GameScene } from "../../GameScene";
import { Entity } from "../../../ECS/Entity";
import { MapEditorModeManager } from "../MapEditorModeManager";
import { EntitiesManager } from "../../GameMap/EntitiesManager";
import { AreaPreview } from "../../../Components/MapEditor/AreaPreview";
import { waScaleManager } from "../../../Services/WaScaleManager";
import { MapEditorTool } from "./MapEditorTool";

const logger = debug("explorer-tool");

export class ExplorerTool implements MapEditorTool {
    private scene: GameScene;
    private downIsPressed = false;
    private upIsPressed = false;
    private leftIsPressed = false;
    private rightIsPressed = false;
    private explorationMouseIsActive = false;
    private entitiesManager: EntitiesManager;
    private areaPreviews = new Map<string, AreaPreview>(new Map());
    private lastCameraCenterXToZoom = 0;
    private lastCameraCenterYToZoom = 0;
    private mapExplorationEntitiesSubscribe: Unsubscriber | undefined;

    private keyDownHandler = (event: KeyboardEvent) => {
        if (event.key === "ArrowDown" || event.key === "s") {
            this.downIsPressed = true;
        }
        if (event.key === "ArrowUp" || event.key === "w" || event.key === "z") {
            this.upIsPressed = true;
        }
        if (event.key === "ArrowLeft" || event.key === "q" || event.key === "a") {
            this.leftIsPressed = true;
        }
        if (event.key === "ArrowRight" || event.key === "d") {
            this.rightIsPressed = true;
        }
    };
    private keyUpHandler = (event: KeyboardEvent) => {
        // Define new zone to zoom
        if (this.downIsPressed || this.upIsPressed || this.leftIsPressed || this.rightIsPressed)
            this.defineZoomToCenterCameraPosition();
        if (event.key === "ArrowDown" || event.key === "s") {
            this.downIsPressed = false;
        }
        if (event.key === "ArrowUp" || event.key === "w" || event.key === "z") {
            this.upIsPressed = false;
        }
        if (event.key === "ArrowLeft" || event.key === "q" || event.key === "a") {
            this.leftIsPressed = false;
        }
        if (event.key === "ArrowRight" || event.key === "d") {
            this.rightIsPressed = false;
        }
        this.mapEditorModeManager.handleKeyDownEvent(event);
    };
    private wheelHandler = (
        pointer: Phaser.Input.Pointer,
        gameObjects: Phaser.GameObjects.GameObject[],
        deltaX: number,
        deltaY: number,
        deltaZ: number
    ) => {
        // Restore camera mode
        this.scene.zoomByFactor(1 - (deltaY / 53) * 0.1);
    };
    private pointerDownHandler = (pointer: Phaser.Input.Pointer) => {
        this.explorationMouseIsActive = true;
        this.scene.input.setDefaultCursor("grabbing");
    };
    private pointerMoveHandler = (pointer: Phaser.Input.Pointer) => {
        if (!this.explorationMouseIsActive) return;
        this.scene.cameras.main.scrollX -= pointer.velocity.x / 10;
        this.scene.cameras.main.scrollY -= pointer.velocity.y / 10;

        // Define new zone to zoom
        this.defineZoomToCenterCameraPosition();

        this.scene.markDirty();
    };
    private pointerUpHandler = (pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) => {
        this.scene.input.setDefaultCursor("grab");
        this.explorationMouseIsActive = false;

        if (gameObjects.length > 0) {
            const gameObject = gameObjects[0];
            if (gameObject instanceof Entity || gameObject instanceof AreaPreview)
                mapExplorationObjectSelectedStore.set(gameObject);
        }

        this.scene.markDirty();
    };

    constructor(private mapEditorModeManager: MapEditorModeManager) {
        this.scene = gameManager.getCurrentGameScene();
        this.entitiesManager = this.scene.getGameMapFrontWrapper().getEntitiesManager();
    }

    public update(time: number, dt: number): void {
        if (this.downIsPressed) {
            this.scene.cameras.main.scrollY += 10;
        }
        if (this.upIsPressed) {
            this.scene.cameras.main.scrollY -= 10;
        }
        if (this.leftIsPressed) {
            this.scene.cameras.main.scrollX -= 10;
        }
        if (this.rightIsPressed) {
            this.scene.cameras.main.scrollX += 10;
        }

        get(mapExplorationAreasStore)?.forEach((preview) => preview.update(time, dt));

        // Dirty the scene to update the camera position if it has changed
        if (this.downIsPressed || this.upIsPressed || this.leftIsPressed || this.rightIsPressed) this.scene.markDirty();
    }

    public clear(): void {
        // Put analytics for exploration mode
        analyticsClient.closeExplorationMode();

        // Restore controls of the scene
        this.scene.userInputManager.restoreControls();

        // Remove all controls for the exploration mode
        this.scene.input.keyboard?.off("keydown", this.keyDownHandler);
        this.scene.input.keyboard?.off("keyup", this.keyUpHandler);
        this.scene.input.off("wheel", this.wheelHandler);
        this.scene.input.off("pointerdown", this.pointerDownHandler);
        this.scene.input.off("pointermove", this.pointerMoveHandler);
        this.scene.input.off("pointerup", this.pointerUpHandler);
        this.scene.input.off(Phaser.Input.Events.GAME_OUT, this.pointerUpHandler);

        // Restore focus target
        waScaleManager.setFocusTarget(undefined);
        // Restore camera mode
        this.scene.getCameraManager().startFollowPlayer(this.scene.CurrentPlayer, 1000);

        // Restore entities
        this.entitiesManager.removeAllEntitiesPointedToEditColor();
        this.removeAllAreasPreviewPointedToEditColor();

        // Restore cursor
        this.scene.input.setDefaultCursor("auto");

        // Restore zoom
        this.scene.zoomByFactor(2);

        // Mark the scene as dirty
        this.scene.markDirty();

        // Unsubscribe to entities store
        if (this.mapExplorationEntitiesSubscribe) this.mapExplorationEntitiesSubscribe();

        // Disable store of map exploration mode
        mapExplorationObjectSelectedStore.set(undefined);
        mapExplorationModeStore.set(false);
        mapEditorVisibilityStore.set(true);
        mapExplorationAreasStore.set(undefined);
    }
    public activate(): void {
        // Put analytics for exploration mode
        analyticsClient.openExplorationMode();

        // Active store of map exploration mode
        mapExplorationModeStore.set(true);
        mapEditorVisibilityStore.set(true);
        mapExplorationEntitiesStore.set(
            gameManager.getCurrentGameScene().getGameMapFrontWrapper().getEntitiesManager().getEntities()
        );

        // Define new cursor
        this.scene.input.setDefaultCursor("grab");

        // Define new zoom
        this.scene.zoomByFactor(0.5);

        // Disable controls of the scene
        this.scene.userInputManager.disableControls();

        // Implement all controls for the exploration mode
        this.scene.input.setTopOnly(false);
        this.scene.input.keyboard?.on("keydown", this.keyDownHandler);
        this.scene.input.keyboard?.on("keyup", this.keyUpHandler);
        this.scene.input.on("wheel", this.wheelHandler);
        this.scene.input.on("pointerdown", this.pointerDownHandler);
        this.scene.input.on("pointermove", this.pointerMoveHandler);
        this.scene.input.on("pointerup", this.pointerUpHandler);
        this.scene.input.on(Phaser.Input.Events.GAME_OUT, this.pointerUpHandler);

        // Define new camera mode
        this.scene.getCameraManager().setExplorationMode();

        // Make all entities interactive
        this.entitiesManager.makeAllEntitiesInteractive();
        this.entitiesManager.setAllEntitiesPointedToEditColor(0x000000);
        this.setAllAreasPreviewPointedToEditColor();

        // Mark the scene as dirty
        this.scene.markDirty();

        // Create subscribe to entities store
        this.mapExplorationEntitiesSubscribe = mapExplorationEntitiesStore.subscribe((entities) => {
            this.entitiesManager.setAllEntitiesPointedToEditColor(0x000000);
            this.scene.markDirty();
        });
    }
    public destroy(): void {
        this.clear();
    }
    public subscribeToGameMapFrontWrapperEvents(gameMapFrontWrapper: GameMapFrontWrapper): void {
        logger("subscribeToGameMapFrontWrapperEvents => Method not implemented.");
    }
    public handleKeyDownEvent(event: KeyboardEvent): void {
        logger("handleKeyDownEvent => Method not implemented.");
    }
    public handleIncomingCommandMessage(editMapCommandMessage: EditMapCommandMessage): Promise<void> {
        // Refresh the entities store
        mapExplorationEntitiesStore.set(
            gameManager.getCurrentGameScene().getGameMapFrontWrapper().getEntitiesManager().getEntities()
        );
        return Promise.resolve();
    }

    private setAllAreasPreviewPointedToEditColor() {
        const areaConfigs = this.scene.getGameMapFrontWrapper().getAreas();
        const areaPreviews = get(mapExplorationAreasStore) ?? new Map<string, AreaPreview>();
        if (!areaConfigs) return;
        for (const [key, config] of areaConfigs.entries()) {
            let areaPreview = areaPreviews.get(key);
            if (areaPreview) {
                areaPreview.updatePreview(config);
            } else {
                areaPreview = this.createAndSaveAreaPreview(config);
            }
            areaPreviews.set(key, areaPreview);
        }
        mapExplorationAreasStore.set(areaPreviews);
    }

    private removeAllAreasPreviewPointedToEditColor() {
        const areas = get(mapExplorationAreasStore);
        if (!areas) return;
        for (const [key, area] of areas.entries()) {
            area.setVisible(false);
            area.destroy();
            areas.delete(key);
        }
        areas.clear();
    }

    private createAndSaveAreaPreview(areaConfig: AreaData): AreaPreview {
        return new AreaPreview(this.scene, structuredClone(areaConfig));
    }

    public defineZoomToCenterCameraPosition() {
        // FIXME from the svelte component, the udate isn't dispatch in totaly at the same time after to move the camera
        setTimeout(() => {
            const cameraCenterXToZoom = this.scene.cameras.main.worldView.x + this.scene.cameras.main.width / 2;
            const cameraCenterYToZoom = this.scene.cameras.main.worldView.y + this.scene.cameras.main.height / 2;
            if (
                cameraCenterXToZoom != this.lastCameraCenterXToZoom ||
                cameraCenterYToZoom != this.lastCameraCenterYToZoom
            ) {
                waScaleManager.setFocusTarget({ x: cameraCenterXToZoom, y: cameraCenterYToZoom });
                this.lastCameraCenterXToZoom = cameraCenterXToZoom;
                this.lastCameraCenterYToZoom = cameraCenterYToZoom;
            }
        }, 100);
    }
}
