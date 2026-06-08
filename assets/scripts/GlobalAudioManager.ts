import { _decorator, AudioClip, AudioSource, Component, director, Node, resources } from 'cc';

const { ccclass } = _decorator;

const AUDIO_ROOT_NAME = 'GlobalAudioRoot';
const DEFAULT_RUN_BGM = 'music/锈鼓残梦';

@ccclass('GlobalAudioManager')
export class GlobalAudioManager extends Component {
    private static _root: Node | null = null;
    private static _instance: GlobalAudioManager | null = null;

    private _source: AudioSource | null = null;
    private _currentPath = '';

    public static playRunBgm(path = DEFAULT_RUN_BGM): void {
        this.ensure()?.playLoop(path);
    }

    public static stopBgm(): void {
        const mgr = this._instance;
        if (mgr?._source) {
            mgr._source.stop();
        }
        if (mgr) {
            mgr._currentPath = '';
        }
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
        this._source.volume = 0.52;
    }

    onDestroy(): void {
        if (GlobalAudioManager._instance === this) {
            GlobalAudioManager._instance = null;
        }
        if (GlobalAudioManager._root === this.node) {
            GlobalAudioManager._root = null;
        }
    }

    private playLoop(path: string): void {
        const source = this._source ?? this.node.addComponent(AudioSource);
        this._source = source;
        source.loop = true;
        source.volume = 0.52;
        if (this._currentPath === path && source.playing) {
            return;
        }
        resources.load(path, AudioClip, (err, clip) => {
            if (err || !clip || !this.node.isValid) {
                console.warn(`[GlobalAudioManager] 加载背景音乐失败：${path}`, err);
                return;
            }
            if (this._currentPath === path && source.playing) {
                return;
            }
            source.stop();
            source.clip = clip;
            source.play();
            this._currentPath = path;
        });
    }
}
