import { mapEditorModeStore } from "../../Stores/MapEditorStore";
import { Easing } from "../../types";
import { HtmlUtils } from "../../WebRtc/HtmlUtils";
import type { Box } from "../../WebRtc/LayoutManager";
import { AreaPreview } from "../Components/MapEditor/AreaPreview";
import { Entity } from "../ECS/Entity";
import type { Player } from "../Player/Player";
import { hasMovedEventName } from "../Player/Player";
import {
    WaScaleManagerFocusTarget,
    WaScaleManager,
    waScaleManager,
    WaScaleManagerEvent,
} from "../Services/WaScaleManager";
import type { ActiveEventList } from "../UserInput/UserInputManager";
import { UserInputEvent } from "../UserInput/UserInputManager";
import { debugZoom } from "../../Utils/Debuggers";
import type { GameScene } from "./GameScene";
import Clamp = Phaser.Math.Clamp;

export enum CameraMode {
    /**
     * Camera looks at certain point but is not locked and will start following the player on his movement
     */
    Positioned = "Positioned",
    /**
     * Camera is actively following the player
     */
    Follow = "Follow",
    /**
     * Camera is focusing on certain point and will not break this focus even on player movement
     */
    Focus = "Focus",

    /**
     * Camera is free and can be moved anywhere on the map by the user (only in the exploration mode)
     */
    Exploration = "Exploration",
}

export enum CameraManagerEvent {
    CameraUpdate = "CameraUpdate",
}

export interface CameraManagerEventCameraUpdateData {
    x: number;
    y: number;
    width: number;
    height: number;
    zoom: number;
}

export class CameraManager extends Phaser.Events.EventEmitter {
    private camera: Phaser.Cameras.Scene2D.Camera;
    private waScaleManager: WaScaleManager;

    private cameraMode: CameraMode = CameraMode.Positioned;

    private restoreZoomTween?: Phaser.Tweens.Tween;
    private startFollowTween?: Phaser.Tweens.Tween;

    private playerToFollow?: Player;
    private cameraLocked: boolean;
    private zoomLocked: boolean;

    private readonly EDITOR_MODE_SCROLL_SPEED: number = 5;

    private unsubscribeMapEditorModeStore: () => void;

    // Whether a pan or tween effect is in progress
    private animationInProgress = false;
    // Are we yet arrived to targetZoomModifier?
    private targetReachInProgress = false;
    // The target zoom we should reach. Each step, we get closer to this target.
    private targetZoomModifier;
    private targetDirection: "zoom_out" | "zoom_in" | undefined;
    private cameraSpeed = 1;
    private _resistanceStartZoomLevel = 0.6;
    private _resistanceEndZoomLevel = 0.3;
    // The resistance strength is the speed at which the camera will go back to the resistance start zoom level.
    private _resistanceStrength = 1;
    // The callback to be called when the resistance zone is overcome
    private resistanceCallback?: () => void;
    private animateCallback: (time: number, delta: number) => void;
    // The date when the resistance wall was broken
    private wallDownDate = 0;
    private resistanceZoneEnterDate = 0;

    constructor(
        private scene: GameScene,
        private mapSize: { width: number; height: number },
        waScaleManager: WaScaleManager
    ) {
        super();
        this.animateCallback = this.animate.bind(this);

        this.camera = scene.cameras.main;
        this.cameraLocked = false;
        this.zoomLocked = false;

        this.waScaleManager = waScaleManager;

        this.initCamera();

        this.bindEventHandlers();

        // Subscribe to map editor mode store to change camera bounds when the map editor is opened or closed
        this.unsubscribeMapEditorModeStore = mapEditorModeStore.subscribe((isOpened) => {
            // Define new bounds for camera if the map editor is opened
            if (isOpened) {
                this.camera.setBounds(0, 0, this.mapSize.width * 2, this.mapSize.height);
            } else {
                this.camera.setBounds(0, 0, this.mapSize.width, this.mapSize.height);
            }
        });

        this.scene.cameras.main.on(Phaser.Cameras.Scene2D.Events.PAN_START, () => {
            this.animationInProgress = true;
        });
        this.scene.cameras.main.on(Phaser.Cameras.Scene2D.Events.PAN_COMPLETE, () => {
            this.animationInProgress = false;
        });

        // Set zoom out to the maximum possible value
        const targetZoomModifier = this.waScaleManager.getTargetZoomModifierFor(
            this.mapSize.width,
            this.mapSize.height
        );
        this.waScaleManager.maxZoomOut = targetZoomModifier;
        this.targetZoomModifier = this.waScaleManager.zoomModifier;
    }

    public destroy(): void {
        this.scene.game.events.off(WaScaleManagerEvent.RefreshFocusOnTarget);
        this.unsubscribeMapEditorModeStore();
        super.destroy();
    }

    public getCamera(): Phaser.Cameras.Scene2D.Camera {
        return this.camera;
    }

    /**
     * Set camera view to specific destination without changing current camera mode. Won't work if camera mode is set to Focus.
     * @param setTo Viewport on which the camera should set the position
     * @param duration Time for the transition im MS. If set to 0, transition will occur immediately
     */
    public setPosition(setTo: WaScaleManagerFocusTarget, duration = 1000): void {
        if (this.cameraMode === CameraMode.Focus) {
            return;
        }
        this.setCameraMode(CameraMode.Positioned);
        this.waScaleManager.saveZoom();
        this.camera.stopFollow();

        const currentZoomModifier = this.waScaleManager.zoomModifier;
        const zoomModifierChange = this.getZoomModifierChange(setTo.width, setTo.height);

        if (duration === 0) {
            this.waScaleManager.zoomModifier = currentZoomModifier + zoomModifierChange;
            this.camera.centerOn(setTo.x, setTo.y);
            this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
            this.playerToFollow?.once(hasMovedEventName, () => {
                if (this.playerToFollow) {
                    this.startFollowPlayer(this.playerToFollow, duration);
                }
            });
            return;
        }
        this.stopPan();
        this.camera.pan(setTo.x, setTo.y, duration, Easing.SineEaseOut, true, (camera, progress, x, y) => {
            if (this.cameraMode === CameraMode.Positioned) {
                if (zoomModifierChange !== 0) {
                    this.waScaleManager.zoomModifier = currentZoomModifier + progress * zoomModifierChange;
                }
                this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
            }
            if (progress === 1) {
                this.playerToFollow?.once(hasMovedEventName, () => {
                    if (this.playerToFollow) {
                        this.startFollowPlayer(this.playerToFollow, duration);
                    }
                });
            }
        });
    }

    /**
     * Set camera to focus mode. As long as the camera is in the Focus mode, its view cannot be changed.
     * @param setTo Viewport on which the camera should focus on
     * @param duration Time for the transition im MS. If set to 0, transition will occur immediately
     */
    public enterFocusMode(focusOn: WaScaleManagerFocusTarget, margin = 0, duration = 1000): void {
        this.setCameraMode(CameraMode.Focus);
        this.waScaleManager.saveZoom();
        this.waScaleManager.setFocusTarget(focusOn);
        this.cameraLocked = true;

        this.unlockCameraWithDelay(duration);
        this.restoreZoomTween?.stop();
        this.startFollowTween?.stop();
        this.camera.stopFollow();
        this.playerToFollow = undefined;

        const currentZoomModifier = this.waScaleManager.zoomModifier;
        const zoomModifierChange = this.getZoomModifierChange(focusOn.width, focusOn.height, 1 + margin);

        if (duration === 0) {
            this.waScaleManager.zoomModifier = currentZoomModifier + zoomModifierChange;
            this.camera.centerOn(focusOn.x, focusOn.y);
            this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
            return;
        }
        this.stopPan();
        this.camera.pan(focusOn.x, focusOn.y, duration, Easing.SineEaseOut, true, (camera, progress, x, y) => {
            this.waScaleManager.zoomModifier = currentZoomModifier + progress * zoomModifierChange;
            if (progress === 1) {
                // NOTE: Making sure the last action will be centering after zoom change
                this.camera.centerOn(focusOn.x, focusOn.y);
            }
            this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
        });
    }

    public leaveFocusMode(player: Player, duration = 0): void {
        this.waScaleManager.setFocusTarget();
        this.unlockCameraWithDelay(duration);
        this.startFollowPlayer(player, duration);
        this.restoreZoom(duration);
    }

    public move(moveEvents: ActiveEventList): void {
        let sendViewportUpdate = false;
        if (moveEvents.get(UserInputEvent.MoveUp)) {
            this.camera.scrollY -= this.EDITOR_MODE_SCROLL_SPEED;
            this.scene.markDirty();
            sendViewportUpdate = true;
        } else if (moveEvents.get(UserInputEvent.MoveDown)) {
            this.camera.scrollY += this.EDITOR_MODE_SCROLL_SPEED;
            this.scene.markDirty();
            sendViewportUpdate = true;
        }

        if (moveEvents.get(UserInputEvent.MoveLeft)) {
            this.camera.scrollX -= this.EDITOR_MODE_SCROLL_SPEED;
            this.scene.markDirty();
            sendViewportUpdate = true;
        } else if (moveEvents.get(UserInputEvent.MoveRight)) {
            this.camera.scrollX += this.EDITOR_MODE_SCROLL_SPEED;
            this.scene.markDirty();
            sendViewportUpdate = true;
        }

        if (sendViewportUpdate) {
            this.scene.sendViewportToServer();
        }
    }

    public startFollowPlayer(player: Player, duration = 0, targetZoomLevel: number | undefined = undefined): void {
        this.playerToFollow = player;
        this.setCameraMode(CameraMode.Follow);
        if (duration === 0) {
            this.camera.startFollow(player, true);
            this.scene.markDirty();
            return;
        }
        const oldPos = { x: this.camera.scrollX, y: this.camera.scrollY };
        const startZoomModifier = this.waScaleManager.zoomModifier;
        this.animationInProgress = true;
        this.startFollowTween = this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration,
            ease: Easing.SineEaseOut,
            onUpdate: (tween: Phaser.Tweens.Tween) => {
                if (!this.playerToFollow) {
                    return;
                }
                const shiftX =
                    (this.playerToFollow.x - this.camera.worldView.width * 0.5 - oldPos.x) * tween.getValue();
                const shiftY =
                    (this.playerToFollow.y - this.camera.worldView.height * 0.5 - oldPos.y) * tween.getValue();
                this.camera.setScroll(oldPos.x + shiftX, oldPos.y + shiftY);
                if (targetZoomLevel !== undefined) {
                    this.waScaleManager.zoomModifier =
                        (targetZoomLevel - startZoomModifier) * tween.getValue() + startZoomModifier;
                }
                this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
            },
            onComplete: () => {
                this.camera.startFollow(player, true);
                this.animationInProgress = false;
            },
        });
    }

    public stopFollow(): void {
        this.camera.stopFollow();
        this.setCameraMode(CameraMode.Positioned);
        this.scene.markDirty();
    }

    /**
     * Updates the offset of the character compared to the center of the screen according to the layout manager
     * (tries to put the character in the center of the remaining space if there is a discussion going on.
     */
    public updateCameraOffset(box: Box, instant = false): void {
        const xCenter = (box.xEnd - box.xStart) / 2 + box.xStart;
        const yCenter = (box.yEnd - box.yStart) / 2 + box.yStart;

        const game = HtmlUtils.querySelectorOrFail<HTMLCanvasElement>("#game canvas");
        // Let's put this in Game coordinates by applying the zoom level:

        const followOffsetX = ((xCenter - game.offsetWidth / 2) * window.devicePixelRatio) / this.scene.scale.zoom;
        const followOffsetY = ((yCenter - game.offsetHeight / 2) * window.devicePixelRatio) / this.scene.scale.zoom;

        if (instant) {
            this.camera.setFollowOffset(followOffsetX, followOffsetY);
            this.scene.markDirty();
            return;
        }

        const oldFollowOffsetX = this.camera.followOffset.x;
        const oldFollowOffsetY = this.camera.followOffset.y;

        this.animationInProgress = true;
        this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 500,
            ease: Easing.QuadEaseOut,
            onUpdate: (tween) => {
                const progress = tween.getValue();
                const newOffsetX = oldFollowOffsetX + (followOffsetX - oldFollowOffsetX) * progress;
                const newOffsetY = oldFollowOffsetY + (followOffsetY - oldFollowOffsetY) * progress;
                this.camera.setFollowOffset(newOffsetX, newOffsetY);
                this.scene.markDirty();
            },
            onComplete: () => {
                this.animationInProgress = false;
            },
        });
    }

    public isCameraLocked(): boolean {
        return this.cameraLocked;
    }

    public isZoomLocked(): boolean {
        return this.isCameraLocked() || this.zoomLocked;
    }

    private getZoomModifierChange(width?: number, height?: number, multiplier = 1): number {
        if (!width || !height) {
            return 0;
        }
        const targetZoomModifier = this.waScaleManager.getTargetZoomModifierFor(
            width * multiplier,
            height * multiplier
        );
        const currentZoomModifier = this.waScaleManager.zoomModifier;
        return targetZoomModifier - currentZoomModifier;
    }

    public unlockCameraWithDelay(delay: number): void {
        this.scene.time.delayedCall(delay, () => {
            this.cameraLocked = false;
        });
    }

    public lockZoom(): void {
        this.zoomLocked = true;
    }

    public unlockZoom(): void {
        this.zoomLocked = false;
    }

    private setCameraMode(mode: CameraMode): void {
        if (this.cameraMode === mode) {
            return;
        }
        this.cameraMode = mode;
    }

    private restoreZoom(duration = 0): void {
        if (duration === 0) {
            this.waScaleManager.zoomModifier = this.waScaleManager.getSaveZoom();
            return;
        }
        this.animationInProgress = true;
        this.restoreZoomTween?.stop();
        this.restoreZoomTween = this.scene.tweens.addCounter({
            from: this.waScaleManager.zoomModifier,
            to: this.waScaleManager.getSaveZoom(),
            duration,
            ease: Easing.SineEaseOut,
            onUpdate: (tween: Phaser.Tweens.Tween) => {
                this.waScaleManager.zoomModifier = tween.getValue();
                this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
            },
            onComplete: () => {
                this.animationInProgress = false;
            },
        });
    }

    private initCamera() {
        this.camera = this.scene.cameras.main;
        this.camera.setBounds(0, 0, this.mapSize.width, this.mapSize.height);
    }

    private bindEventHandlers(): void {
        this.scene.game.events.on(
            WaScaleManagerEvent.RefreshFocusOnTarget,
            (focusOn: { x: number; y: number; width: number; height: number }) => {
                if (!focusOn) {
                    return;
                }
                this.camera.centerOn(focusOn.x, focusOn.y);

                this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
            }
        );

        this.camera.on("followupdate", () => {
            this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
        });
    }

    private getCameraUpdateEventData(): CameraManagerEventCameraUpdateData {
        return {
            x: this.camera.worldView.x,
            y: this.camera.worldView.y,
            width: this.camera.worldView.width,
            height: this.camera.worldView.height,
            zoom: this.camera.scaleManager.zoom,
        };
    }

    // Create function to define the camera on exploration mode. The camera can be moved anywhere on the map. The camera is not locked on the player. The camera can be zoomed in and out. The camera can be moved with the mouse. The camera can be moved with the keyboard. The camera can be moved with the touchpad.
    public setExplorationMode(): void {
        this.cameraLocked = false;
        this.stopFollow();
        this.setCameraMode(CameraMode.Exploration);

        this.camera.setBounds(
            -this.mapSize.width,
            -this.mapSize.height,
            this.mapSize.width * 3,
            this.mapSize.height * 3,
            false
        );

        // Center the camera on the player
        //this.scene.cameras.main.centerOn(this.scene.CurrentPlayer.x, this.scene.CurrentPlayer.y);

        //const targetZoomModifier = this.waScaleManager.getTargetZoomModifierFor(mapWidth, mapHeight);
        //this.waScaleManager.maxZoomOut = targetZoomModifier;
    }

    public triggerMaxZoomOutAnimation(): void {
        const currentZoomModifier = this.waScaleManager.zoomModifier;
        const targetZoomModifier = this.waScaleManager.getTargetZoomModifierFor(
            this.mapSize.width,
            this.mapSize.height
        );

        this.stopPan();
        this.camera.pan(
            this.mapSize.width / 2,
            this.mapSize.height / 2,
            1000,
            Easing.SineEaseOut,
            true,
            (camera, progress, x, y) => {
                this.waScaleManager.zoomModifier =
                    (targetZoomModifier - currentZoomModifier) * progress + currentZoomModifier;
                this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
            }
        );
    }

    public panTo(scrollX: number, scrollY: number, duration: number): void {
        this.stopPan();
        this.camera.pan(scrollX, scrollY, duration, Easing.SineEaseOut, true, () => {
            this.emit(CameraManagerEvent.CameraUpdate, this.getCameraUpdateEventData());
        });
    }

    public stopPan(): void {
        this.camera.panEffect.reset();
    }

    public goToEntity(entity: Entity): void {
        this.scene.cameras.main.centerOn(entity.x, entity.y);
        this.scene.markDirty();
    }
    public goToAreaPreviex(area: AreaPreview): void {
        this.scene.cameras.main.centerOn(area.x, area.y);
        this.scene.markDirty();
    }

    /**
     * Zooms the camera by a factor passed in parameter.
     * Is the final zoom level is greater than the max zoom level, an animation will slowly bring back the camera to the max zoom level
     * (if no animation is currently running)
     *
     * Also, this supports the notion of "WALL".
     * The wall can be "in-place" or "broken". When the wall is in place, it is NOT possible to pass the resistance zone.
     * We do this by altering the zoom factor to make it slower as we are getting closer to the resistance zone end.
     *
     * When we get out of the resistance zone OR if we are in the resistance zone but zoom towards the start of the zone,
     * we break the wall for 10 seconds.
     */
    public zoomByFactor(zoomFactor: number, smooth: boolean): void {
        const wallBroken = Date.now() - this.wallDownDate < 10000;
        if (
            this.isBetween(
                this.waScaleManager.zoomModifier,
                this._resistanceStartZoomLevel,
                this._resistanceEndZoomLevel
            )
        ) {
            if (
                !wallBroken &&
                ((this._resistanceEndZoomLevel < this._resistanceStartZoomLevel && zoomFactor < 1) ||
                    (this.resistanceEndZoomLevel > this.resistanceStartZoomLevel && zoomFactor > 1))
            ) {
                // Let's alter the zoom factor to make it slower if we are in the resistance zone.
                //const maxZoomFactor = this._resistanceEndZoomLevel / this.waScaleManager.zoomModifier;
                const lambda =
                    5 / ((this.resistanceEndZoomLevel - this.resistanceStartZoomLevel) * this._resistanceEndZoomLevel);

                const resultZoom =
                    this.resistanceEndZoomLevel - 1 / (lambda * this.waScaleManager.zoomModifier * zoomFactor);
                zoomFactor = resultZoom / this.waScaleManager.zoomModifier;
            } else {
                // We zoom in the opposite direction, let's break the wall for 10 seconds.
                this.wallDownDate = Date.now();
                debugZoom("Resistance wall is broken because we scrolled towards the start of the resistance zone");
            }
        }

        if (!smooth) {
            waScaleManager.handleZoom(this.waScaleManager.zoomModifier * zoomFactor, this.camera);
        } else {
            this.animateToZoomLevel(this.waScaleManager.zoomModifier * zoomFactor);
        }

        if (this.animationInProgress) {
            // Let's not trigger the resistance if the zoom in or out originates from an animation.
            return;
        }

        if (!this.resistanceCallback) {
            // If there is no resistance configured, let's return.
            return;
        }

        if (
            this.isBetween(
                this.waScaleManager.zoomModifier,
                this._resistanceStartZoomLevel,
                this._resistanceEndZoomLevel
            )
        ) {
            if (!this.resistZoomCallback) {
                this.resistZoomCallback = this.resistZoom.bind(this);
                this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.resistZoomCallback);
                this.resistanceZoneEnterDate = Date.now();
            }
        }
    }

    /**
     * Returns true if the value is between the two bounds (strictly).
     * The 2 bounds can be in any order.
     */
    private isBetween(value: number, bound1: number, bound2: number): boolean {
        return (value > bound1 && value < bound2) || (value > bound2 && value < bound1);
    }

    private animateToZoomLevel(targetZoomModifier: number): void {
        this.targetZoomModifier = targetZoomModifier;
        this.targetDirection = this.targetZoomModifier > this.waScaleManager.zoomModifier ? "zoom_in" : "zoom_out";
        if (!this.targetReachInProgress) {
            this.targetReachInProgress = true;
            this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.animateCallback);
        }
    }

    private animate(time: number, delta: number): void {
        let targetZoomModifier;
        if (this.targetDirection === "zoom_in") {
            targetZoomModifier = this.targetZoomModifier * 1.01;
        } else {
            targetZoomModifier = this.targetZoomModifier / 1.01;
        }

        let newZoom =
            this.waScaleManager.zoomModifier +
            (((targetZoomModifier - this.waScaleManager.zoomModifier) * delta) / 100) * this.cameraSpeed;

        if (this.targetDirection === "zoom_in" && newZoom > this.targetZoomModifier) {
            newZoom = this.targetZoomModifier;
            this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.animateCallback);
            this.targetReachInProgress = false;
        }
        if (this.targetDirection === "zoom_out" && newZoom <= this.targetZoomModifier) {
            newZoom = this.targetZoomModifier;
            this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.animateCallback);
            this.targetReachInProgress = false;
        }

        //waScaleManager.handleZoomByFactor(newZoom, this.camera);
        waScaleManager.handleZoom(newZoom, this.camera);
    }

    private resistZoomCallback: ((time: number, delta: number) => void) | undefined;
    private resistZoom(time: number, delta: number): void {
        // If we are out of resistance zone, let's stop the resistance.
        if (
            !this.isBetween(
                this.waScaleManager.zoomModifier,
                this._resistanceStartZoomLevel,
                this._resistanceEndZoomLevel
            )
        ) {
            this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.resistZoomCallback);
            this.resistZoomCallback = undefined;
            this.scene.removeWhiteMask();
            if (
                this.resistanceCallback &&
                ((this._resistanceStartZoomLevel < this._resistanceEndZoomLevel &&
                    this.waScaleManager.zoomModifier > this._resistanceEndZoomLevel) ||
                    (this._resistanceEndZoomLevel < this._resistanceStartZoomLevel &&
                        this.waScaleManager.zoomModifier < this._resistanceEndZoomLevel))
            ) {
                this.resistanceCallback();
                this.wallDownDate = 0;
                this.resistanceZoneEnterDate = 0;
                debugZoom("We passed through resistance zone. Resistance wall is back up");
                console.log("this._resistanceStartZoomLevel", this._resistanceStartZoomLevel);
                console.log("this._resistanceEndZoomLevel", this._resistanceEndZoomLevel);
                console.log("this.waScaleManager.zoomModifier", this.waScaleManager.zoomModifier);
            } else {
                this.wallDownDate = Date.now();
                this.resistanceZoneEnterDate = 0;
                debugZoom("Resistance wall is broken because we left the resistance zone");
                console.log("this._resistanceStartZoomLevel", this._resistanceStartZoomLevel);
                console.log("this._resistanceEndZoomLevel", this._resistanceEndZoomLevel);
                console.log("this.waScaleManager.zoomModifier", this.waScaleManager.zoomModifier);
            }

            return;
        }

        // Let's calculate the new zoom level
        // Our target point is 10% before the resistance zone
        const targetZoom =
            this._resistanceStartZoomLevel - (this._resistanceEndZoomLevel - this._resistanceStartZoomLevel) * 0.1;

        const newZoom =
            this.targetZoomModifier +
            (((targetZoom - this.targetZoomModifier) * delta) / 250) * this._resistanceStrength;
        //this.targetZoomModifier = newZoom;

        this.animateToZoomLevel(newZoom);

        // If the wall is not broken and we spent more than 2 seconds in the resistance zone, let's break the wall.
        console.log(
            "this.resistanceZoneEnterDate",
            this.resistanceZoneEnterDate,
            Date.now() - this.resistanceZoneEnterDate
        );
        if (this.wallDownDate === 0 && Date.now() - this.resistanceZoneEnterDate > 2000) {
            this.wallDownDate = Date.now();
            debugZoom("Resistance wall is broken because we spent 2 seconds in the resistance zone");
        }

        // The alpha is calculated based on the distance between the current zoom level and the resistance zone
        // The closer we are to the resistance zone, the more the alpha is important.
        // We apply a "sqrt" function to make the white layer appear gently if we are close to the start of the resistance
        // zone and faster as we are closer to the end of the resistance zone.
        const alpha = Clamp(
            1 -
                Math.sqrt(
                    (this.waScaleManager.zoomModifier - this._resistanceEndZoomLevel) /
                        (this._resistanceStartZoomLevel - this._resistanceEndZoomLevel)
                ),
            0,
            1
        );

        this.scene.applyWhiteMask(alpha);
    }

    /**
     * Set the resistance zone for the zoom level. The resistance zone is a zone where the camera will resist to zoom in or out.
     * If the resistance zone is overcome, the callback will be called.
     *
     * There can be only one resistance zone at a time.
     */
    public setResistanceZone(
        startZoomLevel: number,
        endZoomLevel: number,
        strength: number,
        callback: () => void
    ): void {
        this._resistanceStartZoomLevel = startZoomLevel;
        this._resistanceEndZoomLevel = endZoomLevel;
        this._resistanceStrength = strength;
        this.resistanceCallback = callback;
    }

    public disableResistanceZone(): void {
        this.scene.removeWhiteMask();
        if (this.resistZoomCallback) {
            this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.resistZoomCallback);
            this.resistZoomCallback = undefined;
        }
    }

    get resistanceStartZoomLevel(): number {
        return this._resistanceStartZoomLevel;
    }

    get resistanceEndZoomLevel(): number {
        return this._resistanceEndZoomLevel;
    }

    emit(event: string | symbol, ...args: unknown[]): boolean {
        // If the camera is defined on Exploration mode, the camaera manager events will be not emitted
        if (event === CameraManagerEvent.CameraUpdate && CameraMode.Exploration === this.cameraMode) false;
        return super.emit(event, ...args);
    }
}
