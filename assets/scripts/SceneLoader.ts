import { director } from 'cc';
import { SCENE_GAME_MAP } from './GameConfig';
import { MapScreenManager } from './MapScreenManager';
import { loadSceneFast } from './AssetLoader';

export function ensureGameMapManager(): void {
    const scene = director.getScene();
    const canvas = scene?.getChildByName('Canvas');
    if (canvas && !canvas.getComponent(MapScreenManager)) {
        canvas.addComponent(MapScreenManager);
    }
}

export function loadGameMapScene(onError?: (err: unknown) => void): void {
    loadSceneFast(SCENE_GAME_MAP, (err) => {
        if (err) {
            onError?.(err);
            return;
        }
        ensureGameMapManager();
    });
}
