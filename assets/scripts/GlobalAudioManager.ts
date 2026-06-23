import { _decorator, AudioClip, AudioSource, Component, director, game, Game, Node, resources, sys } from 'cc';

const { ccclass } = _decorator;

const AUDIO_ROOT_NAME = 'GlobalAudioRoot';
const DEFAULT_BGM = 'music/锈鼓残梦 (1)';
const MUSIC_ENABLED_KEY = 'kingdoms-spire.music-enabled';
const MUSIC_VOLUME_KEY = 'kingdoms-spire.music-volume';
const DEFAULT_VOLUME = 0.52;

@ccclass('GlobalAudioManager')
export class GlobalAudioManager extends Component {
    private static _root: Node | null = null;
    private static _instance: GlobalAudioManager | null = null;

    private _source: AudioSource | null = null;
    private _requestedPath = DEFAULT_BGM;
    private _currentPath = '';
    private _resumePath = '';
    private _resumeTime = 0;
    private _musicEnabled = true;
    private _volume = DEFAULT_VOLUME;

    public static playBgm(path = DEFAULT_BGM): void {
        this.ensure()?.playLoop(path);
    }

    public static playRunBgm(path = DEFAULT_BGM): void {
        this.playBgm(path);
    }

    public static stopBgm(): void {
        this._instance?._source?.stop();
        if (this._instance) {
            this._instance._currentPath = '';
        }
    }

    public static isMusicEnabled(): boolean {
        return this.ensure()?._musicEnabled ?? true;
    }

    public static setMusicEnabled(enabled: boolean): void {
        const mgr = this.ensure();
        if (!mgr) {
            return;
        }
        mgr._musicEnabled = enabled;
        sys.localStorage.setItem(MUSIC_ENABLED_KEY, enabled ? '1' : '0');
        if (enabled) {
            mgr.playLoop(mgr._requestedPath);
        } else {
            mgr.pauseCurrent();
        }
    }

    public static getVolume(): number {
        return this.ensure()?._volume ?? DEFAULT_VOLUME;
    }

    public static setVolume(volume: number): void {
        const mgr = this.ensure();
        if (!mgr) {
            return;
        }
        mgr._volume = Math.min(1, Math.max(0, volume));
        if (mgr._source) {
            mgr._source.volume = mgr._volume;
        }
        sys.localStorage.setItem(MUSIC_VOLUME_KEY, mgr._volume.toString());
    }

    public static destroy(): void {
        this.stopBgm();
        const root = this._root?.isValid ? this._root : director.getScene()?.getChildByName(AUDIO_ROOT_NAME);
        if (root?.isValid) {
            director.removePersistRootNode(root);
            root.destroy();
        }
        this._root = null;
        this._instance = null;
    }

    private static ensure(): GlobalAudioManager | null {
        if (this._instance?.isValid) {
            return this._instance;
        }
        const scene = director.getScene();
        if (!scene) {
            return null;
        }
        let root = this._root?.isValid ? this._root : scene.getChildByName(AUDIO_ROOT_NAME);
        if (!root) {
            root = new Node(AUDIO_ROOT_NAME);
            scene.addChild(root);
            director.addPersistRootNode(root);
        }
        this._root = root;
        this._instance = root.getComponent(GlobalAudioManager) ?? root.addComponent(GlobalAudioManager);
        return this._instance;
    }

    onLoad(): void {
        GlobalAudioManager._root = this.node;
        GlobalAudioManager._instance = this;
        this._source = this.node.getComponent(AudioSource) ?? this.node.addComponent(AudioSource);
        this._source.loop = true;

        this._musicEnabled = sys.localStorage.getItem(MUSIC_ENABLED_KEY) !== '0';
        const savedVolumeText = sys.localStorage.getItem(MUSIC_VOLUME_KEY);
        const savedVolume = Number(savedVolumeText);
        this._volume = savedVolumeText !== null && Number.isFinite(savedVolume) && savedVolume >= 0 && savedVolume <= 1
            ? savedVolume
            : DEFAULT_VOLUME;
        this._source.volume = this._volume;
        game.on(Game.EVENT_HIDE, this.pauseCurrent, this);
        game.on(Game.EVENT_SHOW, this.resumeRequested, this);
    }

    onDestroy(): void {
        game.off(Game.EVENT_HIDE, this.pauseCurrent, this);
        game.off(Game.EVENT_SHOW, this.resumeRequested, this);
        if (GlobalAudioManager._instance === this) {
            GlobalAudioManager._instance = null;
        }
        if (GlobalAudioManager._root === this.node) {
            GlobalAudioManager._root = null;
        }
    }

    private playLoop(path: string): void {
        this._requestedPath = path;
        if (!this._musicEnabled) {
            return;
        }

        const source = this._source ?? this.node.addComponent(AudioSource);
        this._source = source;
        source.loop = true;
        source.volume = this._volume;
        if (this._currentPath === path && source.playing) {
            return;
        }
        if (this._currentPath === path && source.clip) {
            this.resumeSource(path);
            return;
        }
        resources.load(path, AudioClip, (err, clip) => {
            if (err || !clip || !this.node.isValid) {
                console.warn(`[GlobalAudioManager] 加载背景音乐失败：${path}`, err);
                return;
            }
            if (!this._musicEnabled || (this._currentPath === path && source.playing)) {
                return;
            }
            source.stop();
            source.clip = clip;
            this.seekSource(path === this._resumePath ? this._resumeTime : 0);
            source.play();
            this._currentPath = path;
        });
    }

    private pauseCurrent(): void {
        const source = this._source;
        if (!source?.playing) {
            return;
        }
        this._resumePath = this._currentPath || this._requestedPath;
        this._resumeTime = this.readCurrentTime(source);
        source.pause();
    }

    private resumeRequested(): void {
        if (this._musicEnabled) {
            this.playLoop(this._requestedPath);
        }
    }

    private resumeSource(path: string): void {
        if (!this._source) {
            return;
        }
        this.seekSource(path === this._resumePath ? this._resumeTime : 0);
        this._source.play();
        this._currentPath = path;
    }

    private readCurrentTime(source: AudioSource): number {
        const anySource = source as unknown as { currentTime?: number };
        return Math.max(0, anySource.currentTime ?? 0);
    }

    private seekSource(time: number): void {
        const anySource = this._source as unknown as { currentTime?: number } | null;
        if (anySource && Number.isFinite(time) && time > 0) {
            anySource.currentTime = time;
        }
    }
}
