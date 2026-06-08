import {
    _decorator,
    Camera,
    Canvas,
    Color,
    Component,
    director,
    Graphics,
    Label,
    Layers,
    Node,
    UITransform,
    view,
} from 'cc';
import { GlobalData } from './GlobalData';

const { ccclass } = _decorator;

const HUD_ROOT_NAME = 'RunHudRoot';
const HUD_HEIGHT = 76;

@ccclass('RunHudManager')
export class RunHudManager extends Component {
    private static _root: Node | null = null;
    private static _instance: RunHudManager | null = null;

    private _barGraphics: Graphics | null = null;
    private _leftLabel: Label | null = null;
    private _centerLabel: Label | null = null;
    private _rightLabel: Label | null = null;
    private _lastW = 0;
    private _lastH = 0;
    private _lastText = '';

    public static startRun(): void {
        this.ensure()?.refreshNow();
    }

    public static stopRun(): void {
        const root = this._root?.isValid ? this._root : director.getScene()?.getChildByName(HUD_ROOT_NAME);
        if (root?.isValid) {
            director.removePersistRootNode(root);
            root.destroy();
        }
        this._root = null;
        this._instance = null;
        GlobalData.instance.setRunHudCenterText('');
    }

    public static setCenterText(text: string): void {
        GlobalData.instance.setRunHudCenterText(text);
        const hud = this.ensure();
        hud?.refreshNow();
    }

    public static ensure(): RunHudManager | null {
        if (this._instance?.isValid) {
            this._root = this._instance.node;
            return this._instance;
        }

        const scene = director.getScene();
        if (!scene) {
            return null;
        }

        let root = this._root?.isValid ? this._root : scene.getChildByName(HUD_ROOT_NAME);
        if (!root) {
            root = new Node(HUD_ROOT_NAME);
            scene.addChild(root);
            root.layer = Layers.Enum.UI_2D;
            const ui = root.addComponent(UITransform);
            const vs = view.getVisibleSize();
            ui.setContentSize(vs.width, vs.height);
            ui.anchorPoint.set(0.5, 0.5);
            root.setPosition(vs.width * 0.5, vs.height * 0.5, 0);

            const camNode = new Node('RunHudCamera');
            root.addChild(camNode);
            camNode.layer = Layers.Enum.UI_2D;
            camNode.setPosition(0, 0, 1000);
            const cam = camNode.addComponent(Camera);
            cam.projection = Camera.ProjectionType.ORTHO;
            cam.orthoHeight = Math.max(vs.height * 0.5, 320);
            cam.near = 0;
            cam.far = 2000;
            cam.priority = 100;
            cam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
            cam.visibility = Layers.BitMask.UI_2D;

            const canvas = root.addComponent(Canvas);
            canvas.cameraComponent = cam;
            canvas.alignCanvasWithScreen = true;

            root.addComponent(RunHudManager);
            director.addPersistRootNode(root);
        }

        this._root = root;
        this._instance = root.getComponent(RunHudManager) ?? root.addComponent(RunHudManager);
        return this._instance;
    }

    onLoad(): void {
        RunHudManager._root = this.node;
        RunHudManager._instance = this;
        this.buildHud();
        this.refreshNow();
    }

    onDestroy(): void {
        if (RunHudManager._instance === this) {
            RunHudManager._instance = null;
        }
        if (RunHudManager._root === this.node) {
            RunHudManager._root = null;
        }
    }

    update(): void {
        this.refreshNow();
    }

    public refreshNow(): void {
        const vs = view.getVisibleSize();
        if (Math.abs(vs.width - this._lastW) > 0.5 || Math.abs(vs.height - this._lastH) > 0.5) {
            this.layout(vs.width, vs.height);
        }

        const gd = GlobalData.instance;
        const ch = gd.selectedChar;
        const left = ch ? `❤ ${ch.hp}/${ch.maxHp}     金币 ${ch.gold}` : '';
        const center = gd.runHudCenterText;
        const elapsedRight = `用时 ${gd.getRunElapsedText()}     牌组 ${gd.deckCount}`;
        const text = `${left}|${center}|${elapsedRight}`;
        if (text === this._lastText) {
            return;
        }
        this._lastText = text;

        if (this._leftLabel) {
            this._leftLabel.string = left;
        }
        if (this._centerLabel) {
            this._centerLabel.string = center;
        }
        if (this._rightLabel) {
            this._rightLabel.string = elapsedRight;
        }
    }

    private buildHud(): void {
        if (this.node.getChildByName('RunHudBar')) {
            return;
        }

        const bar = new Node('RunHudBar');
        this.node.addChild(bar);
        bar.layer = Layers.Enum.UI_2D;
        const barUi = bar.addComponent(UITransform);
        barUi.anchorPoint.set(0.5, 1);
        this._barGraphics = bar.addComponent(Graphics);

        this._leftLabel = this.makeLabel(bar, 'Left', Label.HorizontalAlign.LEFT);
        this._centerLabel = this.makeLabel(bar, 'Center', Label.HorizontalAlign.CENTER);
        this._rightLabel = this.makeLabel(bar, 'Right', Label.HorizontalAlign.RIGHT);
        this.layout(view.getVisibleSize().width, view.getVisibleSize().height);
    }

    private makeLabel(parent: Node, name: string, align: number): Label {
        const n = new Node(name);
        parent.addChild(n);
        n.layer = Layers.Enum.UI_2D;
        n.addComponent(UITransform);
        const lb = n.addComponent(Label);
        lb.fontSize = 22;
        lb.lineHeight = 28;
        lb.color = new Color(235, 240, 248, 255);
        lb.horizontalAlign = align;
        lb.verticalAlign = Label.VerticalAlign.CENTER;
        lb.enableWrapText = false;
        lb.enableOutline = true;
        lb.outlineColor = new Color(0, 0, 0, 210);
        lb.outlineWidth = 2;
        return lb;
    }

    private layout(w: number, h: number): void {
        this._lastW = w;
        this._lastH = h;

        const rootUi = this.node.getComponent(UITransform);
        if (rootUi) {
            rootUi.setContentSize(w, h);
        }
        this.node.setPosition(w * 0.5, h * 0.5, 0);

        const cam = this.node.getChildByName('RunHudCamera')?.getComponent(Camera);
        if (cam) {
            cam.orthoHeight = Math.max(h * 0.5, 320);
        }

        const bar = this.node.getChildByName('RunHudBar');
        const barUi = bar?.getComponent(UITransform);
        if (bar && barUi) {
            barUi.setContentSize(w, HUD_HEIGHT);
            bar.setPosition(0, h * 0.5, 0);
        }

        const g = this._barGraphics;
        if (g) {
            g.clear();
            g.fillColor = new Color(12, 16, 24, 224);
            g.rect(-w * 0.5, -HUD_HEIGHT, w, HUD_HEIGHT);
            g.fill();
        }

        this.layoutLabel(this._leftLabel, -w * 0.5 + 38, -HUD_HEIGHT * 0.5, 420, 48, 0, 0.5);
        this.layoutLabel(this._centerLabel, 0, -HUD_HEIGHT * 0.5, Math.max(520, w - 920), 48, 0.5, 0.5);
        this.layoutLabel(this._rightLabel, w * 0.5 - 38, -HUD_HEIGHT * 0.5, 420, 48, 1, 0.5);
    }

    private layoutLabel(label: Label | null, x: number, y: number, w: number, h: number, ax: number, ay: number): void {
        const n = label?.node;
        const ui = n?.getComponent(UITransform);
        if (!n || !ui) {
            return;
        }
        ui.setContentSize(w, h);
        ui.anchorPoint.set(ax, ay);
        n.setPosition(x, y, 0);
    }
}
