import { director, resources, SpriteFrame } from 'cc';

/**
 * Dynamic `resources` assets are shared by several scenes. Keeping one promise per
 * SpriteFrame prevents dozens of identical, serial callbacks while the map and
 * battle UI are being created for the first time.
 */
const spriteFrameLoads = new Map<string, Promise<SpriteFrame | null>>();
const scenePreloads = new Map<string, Promise<void>>();
const sceneAssetPreloads = new Map<string, Promise<void>>();
const SPRITE_FRAME_TIMEOUT_MS = 12_000;

export function spriteFramePath(resourcesPath: string): string {
    return resourcesPath.endsWith('/spriteFrame') ? resourcesPath : `${resourcesPath}/spriteFrame`;
}

export function loadSpriteFrame(resourcesPath: string): Promise<SpriteFrame | null> {
    if (typeof resourcesPath !== 'string' || resourcesPath.length === 0) {
        console.warn('[AssetLoader] 忽略无效图片路径：', resourcesPath);
        return Promise.resolve(null);
    }
    const path = spriteFramePath(resourcesPath);
    const cached = spriteFrameLoads.get(path);
    if (cached) {
        return cached;
    }

    const pending = new Promise<SpriteFrame | null>((resolve) => {
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | undefined;
        const finish = (spriteFrame: SpriteFrame | null): void => {
            if (settled) {
                return;
            }
            settled = true;
            if (timeoutId !== undefined) {
                clearTimeout(timeoutId);
            }
            if (!spriteFrame) {
                // Allow a later scene visit to retry a failed or timed-out request.
                spriteFrameLoads.delete(path);
            }
            resolve(spriteFrame);
        };

        timeoutId = setTimeout(() => {
            console.warn(`[AssetLoader] 加载图片超时（${SPRITE_FRAME_TIMEOUT_MS / 1000}s）：${path}`);
            finish(null);
        }, SPRITE_FRAME_TIMEOUT_MS);

        resources.load(path, SpriteFrame, (err, spriteFrame) => {
            if (err || !spriteFrame) {
                // Do not permanently cache a transient CDN/network failure.
                console.warn(`[AssetLoader] 加载图片失败：${path}`, err);
                finish(null);
                return;
            }
            finish(spriteFrame);
        });
    });
    spriteFrameLoads.set(path, pending);
    return pending;
}

/** Load every unique image in parallel and return a lookup keyed by its original path. */
export async function loadSpriteFrames(resourcesPaths: readonly string[]): Promise<Map<string, SpriteFrame | null>> {
    // Cocos' Web target transpiles `[...new Set(values)]` into
    // `[].concat(new Set(values))`, producing an array whose first item is the
    // Set itself. Build this array explicitly so every runtime item is a path.
    const uniquePaths: string[] = [];
    const seen = new Set<string>();
    resourcesPaths.forEach((path) => {
        if (typeof path === 'string' && path.length > 0 && !seen.has(path)) {
            seen.add(path);
            uniquePaths.push(path);
        }
    });
    const frames = await Promise.all(uniquePaths.map((path) => loadSpriteFrame(path)));
    const result = new Map<string, SpriteFrame | null>();
    uniquePaths.forEach((path, index) => result.set(path, frames[index] ?? null));
    return result;
}

/**
 * Start downloading/decoding the next page's dynamic images without blocking the
 * current page. Errors are logged by `loadSpriteFrame` and can be retried later.
 */
export function warmSpriteFrames(resourcesPaths: readonly string[]): Promise<Map<string, SpriteFrame | null>> {
    return loadSpriteFrames(resourcesPaths);
}

/**
 * Decode large optional images in small batches, yielding between batches so an
 * idle page does not receive one long main-thread texture upload spike.
 */
export async function warmSpriteFramesInBatches(
    resourcesPaths: readonly string[],
    batchSize = 1,
    gapMs = 48,
    shouldContinue: () => boolean = () => true,
): Promise<void> {
    const uniquePaths: string[] = [];
    const seen = new Set<string>();
    resourcesPaths.forEach((path) => {
        if (typeof path === 'string' && path.length > 0 && !seen.has(path)) {
            seen.add(path);
            uniquePaths.push(path);
        }
    });
    const size = Math.max(1, Math.floor(batchSize));
    for (let index = 0; index < uniquePaths.length; index += size) {
        if (!shouldContinue()) {
            return;
        }
        await loadSpriteFrames(uniquePaths.slice(index, index + size));
        if (!shouldContinue()) {
            return;
        }
        if (index + size < uniquePaths.length && gapMs > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, gapMs));
        }
    }
}

/**
 * Scene files are tiny, but preloading them removes the scene-deserialization wait
 * from the user's click. Concurrent requests for the same scene are coalesced.
 */
export function preloadScene(sceneName: string): Promise<void> {
    const current = scenePreloads.get(sceneName);
    if (current) {
        return current;
    }

    const pending = new Promise<void>((resolve) => {
        director.preloadScene(sceneName, (err) => {
            if (err) {
                console.warn(`[AssetLoader] 预加载场景失败：${sceneName}`, err);
            }
            resolve();
        });
    });
    scenePreloads.set(sceneName, pending);
    return pending;
}

export function warmScene(sceneName: string): Promise<void> {
    return preloadScene(sceneName);
}

/**
 * Associate dynamic images with the scene that will consume them. Besides starting
 * both requests immediately, `loadSceneFast` can then wait for an in-flight image
 * decode before replacing the current page. This avoids entering a half-rendered
 * scene when the player clicks faster than the background warm-up.
 */
export function warmSceneAssets(sceneName: string, resourcesPaths: readonly string[]): Promise<void> {
    const previous = sceneAssetPreloads.get(sceneName) ?? Promise.resolve();
    const nextBatch = loadSpriteFrames(resourcesPaths).then(() => undefined);
    const pending = Promise.all([previous, nextBatch]).then(() => undefined);
    sceneAssetPreloads.set(sceneName, pending);
    void preloadScene(sceneName);
    return pending;
}

export function loadSceneFast(sceneName: string, onLoaded?: (err: Error | null) => void): void {
    const assetsReady = sceneAssetPreloads.get(sceneName) ?? Promise.resolve();
    void Promise.all([preloadScene(sceneName), assetsReady]).then(() => {
        director.loadScene(sceneName, (err) => onLoaded?.(err));
    });
}
