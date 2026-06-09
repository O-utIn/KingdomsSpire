import {
    _decorator,
    BlockInputEvents,
    Camera,
    Canvas,
    Color,
    Component,
    director,
    Graphics,
    Label,
    Layers,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    UITransform,
    view,
} from 'cc';
import { GlobalData } from './GlobalData';
import { getCardDef, type CardDef, type CardId } from './cards/CardDef';

const { ccclass } = _decorator;

const PREVIEW_ROOT_NAME = 'DeckPreviewRoot';

function paintRoundRect(g: Graphics, w: number, h: number, fill: Color, stroke?: Color, lineWidth = 2): void {
    g.clear();
    g.fillColor = fill;
    g.roundRect(-w * 0.5, -h * 0.5, w, h, 8);
    g.fill();
    if (stroke) {
        g.lineWidth = lineWidth;
        g.strokeColor = stroke;
        g.roundRect(-w * 0.5, -h * 0.5, w, h, 8);
        g.stroke();
    }
}

function loadSpriteFrame(resourcesPath: string): Promise<SpriteFrame | null> {
    const path = resourcesPath.endsWith('/spriteFrame') ? resourcesPath : `${resourcesPath}/spriteFrame`;
    return new Promise((resolve) => {
        resources.load(path, SpriteFrame, (err, sf) => {
            if (err) {
                console.warn(`[DeckPreviewManager] 加载卡图失败：${path}`, err);
                resolve(null);
            } else {
                resolve(sf);
            }
        });
    });
}

@ccclass('DeckPreviewManager')
export class DeckPreviewManager extends Component {
    private static _root: Node | null = null;
    private static _instance: DeckPreviewManager | null = null;

    private _overlay: Node | null = null;

    public static show(): void {
        this.ensure()?.openPreview();
    }

    public static hide(): void {
        this._instance?.closePreview();
    }

    public static destroyRoot(): void {
        this.hide();
        const root = this._root?.isValid ? this._root : director.getScene()?.getChildByName(PREVIEW_ROOT_NAME);
        if (root?.isValid) {
            root.destroy();
        }
        this._root = null;
        this._instance = null;
    }

    private static ensure(): DeckPreviewManager | null {
        if (this._instance?.isValid) {
            return this._instance;
        }
        const scene = director.getScene();
        if (!scene) {
            return null;
        }
        let root = this._root?.isValid ? this._root : scene.getChildByName(PREVIEW_ROOT_NAME);
        if (!root) {
            root = new Node(PREVIEW_ROOT_NAME);
            scene.addChild(root);
            root.layer = Layers.Enum.UI_2D;
            const ui = root.addComponent(UITransform);
            const vs = view.getVisibleSize();
            ui.setContentSize(vs.width, vs.height);
            ui.anchorPoint.set(0.5, 0.5);
            root.setPosition(vs.width * 0.5, vs.height * 0.5, 0);

            const camNode = new Node('DeckPreviewCamera');
            root.addChild(camNode);
            camNode.layer = Layers.Enum.UI_2D;
            camNode.setPosition(0, 0, 1000);
            const cam = camNode.addComponent(Camera);
            cam.projection = Camera.ProjectionType.ORTHO;
            cam.orthoHeight = Math.max(vs.height * 0.5, 320);
            cam.near = 0;
            cam.far = 2000;
            cam.priority = 110;
            cam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
            cam.visibility = Layers.BitMask.UI_2D;

            const canvas = root.addComponent(Canvas);
            canvas.cameraComponent = cam;
            canvas.alignCanvasWithScreen = true;
        }
        this._root = root;
        this._instance = root.getComponent(DeckPreviewManager) ?? root.addComponent(DeckPreviewManager);
        return this._instance;
    }

    onLoad(): void {
        DeckPreviewManager._root = this.node;
        DeckPreviewManager._instance = this;
    }

    onDestroy(): void {
        if (DeckPreviewManager._instance === this) {
            DeckPreviewManager._instance = null;
        }
        if (DeckPreviewManager._root === this.node) {
            DeckPreviewManager._root = null;
        }
    }

    update(): void {
        const vs = view.getVisibleSize();
        const ui = this.node.getComponent(UITransform);
        if (ui) {
            ui.setContentSize(vs.width, vs.height);
        }
        this.node.setPosition(vs.width * 0.5, vs.height * 0.5, 0);
        const cam = this.node.getChildByName('DeckPreviewCamera')?.getComponent(Camera);
        if (cam) {
            cam.orthoHeight = Math.max(vs.height * 0.5, 320);
        }
    }

    private openPreview(): void {
        if (!this.node?.isValid) {
            return;
        }
        this.closePreview();
        const vs = view.getVisibleSize();
        const overlay = new Node('DeckPreviewOverlay');
        this.node.addChild(overlay);
        overlay.setSiblingIndex(this.node.children.length - 1);
        overlay.layer = Layers.Enum.UI_2D;
        const oUt = overlay.addComponent(UITransform);
        oUt.setContentSize(vs.width, vs.height);
        overlay.addComponent(BlockInputEvents);
        const shade = overlay.addComponent(Graphics);
        shade.fillColor = new Color(0, 0, 0, 170);
        shade.rect(-vs.width * 0.5, -vs.height * 0.5, vs.width, vs.height);
        shade.fill();

        const panelW = Math.min(1180, Math.max(820, vs.width - 140));
        const panelH = Math.min(720, Math.max(520, vs.height - 130));
        const panel = new Node('DeckPreviewPanel');
        overlay.addChild(panel);
        panel.layer = Layers.Enum.UI_2D;
        const pUt = panel.addComponent(UITransform);
        pUt.setContentSize(panelW, panelH);
        const pG = panel.addComponent(Graphics);
        paintRoundRect(pG, panelW, panelH, new Color(18, 24, 34, 248), new Color(214, 176, 96, 255), 3);

        const gd = GlobalData.instance;
        this.addLabel(panel, 'Title', panelW - 80, 48, 0, panelH * 0.5 - 46, 34, new Color(255, 220, 128, 255)).string = '牌组预览';
        this.addLabel(panel, 'Sub', panelW - 120, 30, 0, panelH * 0.5 - 84, 18, new Color(214, 224, 236, 255)).string =
            `当前牌组 ${gd.deckIds.length || gd.deckCount} 张    用时 ${gd.getRunElapsedText()}`;
        this.makeButton(panel, 'Close', '关闭', 120, 42, panelW * 0.5 - 82, panelH * 0.5 - 52, () => this.closePreview());

        const grouped = this.groupDeck(gd.deckIds);
        const cardW = 150;
        const cardH = 206;
        const gapX = 22;
        const gapY = 28;
        const cols = Math.max(3, Math.floor((panelW - 100) / (cardW + gapX)));
        const rows = Math.ceil(grouped.length / cols);
        const visibleRows = Math.max(1, Math.floor((panelH - 148) / (cardH + gapY)));
        const startY = Math.min(panelH * 0.5 - 170, ((Math.min(rows, visibleRows) - 1) * (cardH + gapY)) * 0.5);
        const startX = -((Math.min(cols, grouped.length) - 1) * (cardW + gapX)) * 0.5;

        grouped.forEach((entry, index) => {
            const row = Math.floor(index / cols);
            if (row >= visibleRows) {
                return;
            }
            const col = index % cols;
            const x = startX + col * (cardW + gapX);
            const y = startY - row * (cardH + gapY);
            this.renderDeckCard(panel, entry.def, entry.count, cardW, cardH, x, y);
        });

        if (rows > visibleRows) {
            this.addLabel(panel, 'Overflow', panelW - 120, 24, 0, -panelH * 0.5 + 34, 16, new Color(198, 208, 218, 255)).string =
                `还有 ${grouped.length - visibleRows * cols} 种卡牌未显示。`;
        }

        this._overlay = overlay;
    }

    private closePreview(): void {
        if (this._overlay?.isValid) {
            this._overlay.removeFromParent();
            this._overlay.destroy();
        }
        this._overlay = null;
    }

    private groupDeck(deckIds: readonly CardId[]): { def: CardDef; count: number }[] {
        const map = new Map<CardId, number>();
        for (const id of deckIds) {
            map.set(id, (map.get(id) ?? 0) + 1);
        }
        return [...map.entries()]
            .map(([id, count]) => {
                const def = getCardDef(id);
                return def ? { def, count } : null;
            })
            .filter((entry): entry is { def: CardDef; count: number } => !!entry)
            .sort((a, b) => a.def.cost - b.def.cost || a.def.name.localeCompare(b.def.name, 'zh-Hans-CN'));
    }

    private renderDeckCard(parent: Node, def: CardDef, count: number, w: number, h: number, x: number, y: number): void {
        const card = new Node(`DeckCard_${def.id}`);
        parent.addChild(card);
        card.layer = Layers.Enum.UI_2D;
        card.setPosition(x, y, 0);
        const ut = card.addComponent(UITransform);
        ut.setContentSize(w, h);

        const g = card.addComponent(Graphics);
        const fill = def.type === 'attack' ? new Color(126, 62, 49, 255) : def.type === 'power' ? new Color(94, 72, 128, 255) : new Color(58, 92, 112, 255);
        paintRoundRect(g, w, h, fill, new Color(205, 156, 92, 255), 3);

        const artBox = new Node('Art');
        card.addChild(artBox);
        artBox.layer = Layers.Enum.UI_2D;
        artBox.setPosition(0, 30, 0);
        const artUt = artBox.addComponent(UITransform);
        artUt.setContentSize(w - 24, 92);
        if (def.artPath) {
            const sp = artBox.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            loadSpriteFrame(def.artPath).then((sf) => {
                if (sf && artBox.isValid) {
                    sp.spriteFrame = sf;
                }
            });
        }

        this.addLabel(card, 'Cost', 30, 30, -w * 0.5 + 24, h * 0.5 - 24, 20, new Color(255, 238, 160, 255)).string = `${def.cost}`;
        const title = this.addLabel(card, 'Name', w - 44, 30, 12, h * 0.5 - 25, 18, new Color(255, 238, 210, 255));
        title.string = def.name;
        title.overflow = Label.Overflow.SHRINK;
        const desc = this.addLabel(card, 'Desc', w - 26, 54, 0, -58, 13, new Color(232, 228, 218, 255));
        desc.lineHeight = 17;
        desc.string = this.compactDescription(def.description);
        const countLabel = this.addLabel(card, 'Count', 44, 28, w * 0.5 - 28, -h * 0.5 + 21, 18, new Color(255, 226, 118, 255));
        countLabel.string = `x${count}`;
    }

    private compactDescription(text: string): string {
        return text.length > 42 ? `${text.slice(0, 41)}...` : text;
    }

    private makeButton(parent: Node, name: string, text: string, w: number, h: number, x: number, y: number, onClick: () => void): Node {
        const btn = new Node(name);
        parent.addChild(btn);
        btn.layer = Layers.Enum.UI_2D;
        btn.setPosition(x, y, 0);
        const ut = btn.addComponent(UITransform);
        ut.setContentSize(w, h);
        const g = btn.addComponent(Graphics);
        paintRoundRect(g, w, h, new Color(78, 108, 138, 255), new Color(170, 215, 255, 255));
        this.addLabel(btn, 'Label', w - 18, h - 8, 0, 0, 19, new Color(245, 250, 255, 255)).string = text;
        btn.on(Node.EventType.TOUCH_END, onClick, this);
        return btn;
    }

    private addLabel(parent: Node, name: string, w: number, h: number, x: number, y: number, fontSize: number, color: Color): Label {
        const n = new Node(name);
        parent.addChild(n);
        n.layer = Layers.Enum.UI_2D;
        n.setPosition(x, y, 0);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(w, h);
        const lb = n.addComponent(Label);
        lb.fontSize = fontSize;
        lb.lineHeight = Math.ceil(fontSize * 1.22);
        lb.color = color;
        lb.horizontalAlign = Label.HorizontalAlign.CENTER;
        lb.verticalAlign = Label.VerticalAlign.CENTER;
        lb.enableWrapText = true;
        lb.overflow = Label.Overflow.CLAMP;
        return lb;
    }
}
