import {
    _decorator,
    BlockInputEvents,
    Camera,
    Canvas,
    Color,
    Component,
    director,
    EventMouse,
    EventTouch,
    Graphics,
    Label,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
    Widget,
    view,
} from 'cc';
import { SCENE_BATTLE, SCENE_EVENT } from './GameConfig';
import { GlobalData } from './GlobalData';
import { RunHudManager } from './RunHudManager';
import type { CardId } from './cards/CardDef';
import { getCardDef } from './cards/CardDef';
import type { RelicId } from './relics/RelicDef';
import { getRelicDef } from './relics/RelicDef';

const { ccclass } = _decorator;

const MAP_BG_LAYERS = [
    'textures/spire-codex-ui-map-backgrounds/map_bottom_overgrowth',
    'textures/spire-codex-ui-map-backgrounds/map_middle_overgrowth',
    'textures/spire-codex-ui-map-backgrounds/map_top_overgrowth',
] as const;

const MARKER_BY_CHAR = [
    'textures/spire-codex-ui-map-nodes/map_marker_silent',
    'textures/spire-codex-ui-map-nodes/map_marker_defect',
    'textures/spire-codex-ui-map-nodes/map_marker_ironclad',
] as const;

const PLATE = 'textures/spire-codex-ui-map-nodes/map_node_background';
const AURA_TEX = 'textures/spire-codex-ui-map-nodes/map_unknown';

type MapNodeKind = 'start' | 'monster' | 'elite' | 'rest' | 'shop' | 'event' | 'boss';

const ICON: Record<MapNodeKind, string> = {
    start: 'textures/spire-codex-ui-map-nodes/map_chest',
    monster: 'textures/spire-codex-ui-map-nodes/map_monster',
    elite: 'textures/spire-codex-ui-map-nodes/map_elite',
    rest: 'textures/spire-codex-ui-map-nodes/map_rest',
    shop: 'textures/spire-codex-ui-map-nodes/map_shop',
    event: 'textures/spire-codex-ui-map-nodes/map_unknown',
    boss: 'textures/spire-codex-ui-map-nodes/map_chest_boss',
};

const PING = 'textures/spire-codex-ui-map-nodes/map_ping';

interface GraphNode {
    id: number;
    floor: number;
    x: number;
    y: number;
    kind: MapNodeKind;
    parents: number[];
    children: number[];
}

/** 自下而上分叉 DAG；底层中间为起点，向左右分叉，贴近参考图 */
const MAP_GRAPH: GraphNode[] = (() => {
    const y = (f: number) => -430 + f * 138;
    return [
        { id: 0, floor: 0, x: 0, y: y(0), kind: 'start', parents: [], children: [1, 2] },
        { id: 1, floor: 1, x: -190, y: y(1), kind: 'monster', parents: [0], children: [3, 4] },
        { id: 2, floor: 1, x: 190, y: y(1), kind: 'event', parents: [0], children: [4, 5] },
        { id: 3, floor: 2, x: -250, y: y(2), kind: 'rest', parents: [1], children: [6] },
        { id: 4, floor: 2, x: 0, y: y(2), kind: 'monster', parents: [1, 2], children: [6, 7] },
        { id: 5, floor: 2, x: 250, y: y(2), kind: 'shop', parents: [2], children: [7] },
        { id: 6, floor: 3, x: -150, y: y(3), kind: 'event', parents: [3, 4], children: [8] },
        { id: 7, floor: 3, x: 180, y: y(3), kind: 'elite', parents: [4, 5], children: [8, 9] },
        { id: 8, floor: 4, x: -60, y: y(4), kind: 'monster', parents: [6, 7], children: [10] },
        { id: 9, floor: 4, x: 160, y: y(4), kind: 'rest', parents: [7], children: [10] },
        { id: 10, floor: 5, x: 40, y: y(5), kind: 'shop', parents: [8, 9], children: [11] },
        { id: 11, floor: 6, x: 0, y: y(6), kind: 'boss', parents: [10], children: [] },
    ];
})();

const MAX_FLOOR = Math.max(...MAP_GRAPH.map((n) => n.floor));

const ZOOM_MIN = 0.45;
const ZOOM_MAX = 2.4;
const ZOOM_WHEEL_STEP = 0.09;
const CAMPFIRE_REST_RATIO = 0.3;
const SHOP_CARD_ID: CardId = 'bash';
const SHOP_SKILL_CARD_ID: CardId = 'survivor';
const SHOP_RELIC_ID: RelicId = 'neow_golden_rose';
const SHOP_CARD_COST = 55;
const SHOP_SKILL_CARD_COST = 45;
const SHOP_RELIC_COST = 80;
const SHOP_REMOVE_BASE_COST = 75;
const SHOP_REMOVE_COST_STEP = 25;
const SHOP_REMOVE_COST = SHOP_REMOVE_BASE_COST;
const SHOP_MERCHANT_ART = 'textures/events/StS2_Relic_Trader';
const CAMPFIRE_REST_ART = 'textures/shop/restsite_ironclad';
const SHOP_RUG_FULL = 'textures/shop/shop_rug_full';
const SHOP_BACK_BUTTON = 'textures/shop/back_button';
const SHOP_BACK_ARROW = 'textures/shop/settings_tiny_left_arrow';
const SHOP_REMOVE_ICON = 'textures/shop/card_removal_00';
const SHOP_GOLD_ICON = 'textures/shop/top_bar_gold';
const LEGEND_ROWS: { path: string; text: string }[] = [
    { path: ICON.event, text: '未知' },
    { path: ICON.shop, text: '商人' },
    { path: ICON.start, text: '宝箱' },
    { path: ICON.rest, text: '休息' },
    { path: ICON.monster, text: '敌人' },
    { path: ICON.elite, text: '精英' },
];

function loadSpriteFrame(resourcesPath: string): Promise<SpriteFrame | null> {
    const path = resourcesPath.endsWith('/spriteFrame')
        ? resourcesPath
        : `${resourcesPath}/spriteFrame`;
    return new Promise((resolve) => {
        resources.load(path, SpriteFrame, (err, sf) => {
            if (err) {
                console.error(`[MapScreenManager] 加载失败 ${path}`, err);
                resolve(null);
            } else {
                resolve(sf);
            }
        });
    });
}

function graphPos(id: number): Vec2 {
    const n = MAP_GRAPH[id];
    return n ? new Vec2(n.x, n.y) : new Vec2();
}

function strokeDashedLine(g: Graphics, ax: number, ay: number, bx: number, by: number, dash: number, gap: number): void {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) {
        return;
    }
    const ux = dx / len;
    const uy = dy / len;
    let traveled = 0;
    let sx = ax;
    let sy = ay;
    let draw = true;
    while (traveled < len) {
        const seg = Math.min(draw ? dash : gap, len - traveled);
        const ex = sx + ux * seg;
        const ey = sy + uy * seg;
        if (draw) {
            g.moveTo(sx, sy);
            g.lineTo(ex, ey);
            g.stroke();
        }
        sx = ex;
        sy = ey;
        traveled += seg;
        draw = !draw;
    }
}

function paintSelectionRing(g: Graphics, radius: number, lineW: number, color: Color): void {
    g.clear();
    g.lineWidth = lineW;
    g.strokeColor = color;
    const N = 56;
    for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2;
        const x = Math.cos(t) * radius;
        const y = Math.sin(t) * radius;
        if (i === 0) {
            g.moveTo(x, y);
        } else {
            g.lineTo(x, y);
        }
    }
    g.close();
    g.stroke();
}

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

@ccclass('MapScreenManager')
export class MapScreenManager extends Component {
    private _contentRoot: Node | null = null;
    /** 承载全部地图子节点，仅缩放此节点 */
    private _zoomRoot: Node | null = null;
    private _mapScale = 1;
    private _lastPinchDist = 0;
    private readonly _touchUiPos = new Map<number, Vec2>();
    private _wrapById: (Node | undefined)[] = [];
    private _glowById: (Sprite | undefined)[] = [];
    private _ringGfxById: (Graphics | undefined)[] = [];
    private _lineGraphics: Graphics | null = null;
    private _pathGraphics: Graphics | null = null;
    private _pingRoot: Node | null = null;
    private _modalRoot: Node | null = null;

    async start() {
        this.syncCanvasCameraToScreen();
        if (GlobalData.instance.mapFloorCount <= 0) {
            GlobalData.instance.mapCurrentNodeId = 0;
            GlobalData.instance.mapPathNodeIds = [0];
        }
        GlobalData.instance.mapFloorCount = MAX_FLOOR + 1;
        RunHudManager.startRun();
        this.refreshRunHud();
        /** 先铺地图再叠 UI，避免 MapContent 盖住顶栏（参考图层次） */
        await this.buildMapVisuals();
        await this.buildLegendWithIcons();
        this.syncCanvasCameraToScreen();
        this.redrawEdgeLines();
        this.redrawPathLine();
        this.refreshPingAndInteract();
    }

    onDestroy(): void {
        /** 切场景时子节点可能已先销毁，对已失效 Node 调用 off 会触发引擎内部 null（见 Node.off） */
        const root = this._contentRoot;
        if (!root?.isValid) {
            return;
        }
        root.off(Node.EventType.MOUSE_WHEEL, this.onMapMouseWheel, this);
        root.off(Node.EventType.TOUCH_START, this.onMapTouchStart, this);
        root.off(Node.EventType.TOUCH_MOVE, this.onMapTouchMove, this);
        root.off(Node.EventType.TOUCH_END, this.onMapTouchEnd, this);
        root.off(Node.EventType.TOUCH_CANCEL, this.onMapTouchEnd, this);
    }

    private syncCanvasCameraToScreen(): void {
        const vs = view.getVisibleSize();
        const canvas = this.node.getComponent(Canvas);
        const cam = canvas?.cameraComponent;
        if (cam && cam.projection === Camera.ProjectionType.ORTHO) {
            cam.orthoHeight = Math.max(vs.height * 0.5, 320);
            cam.near = 0;
            cam.far = 2000;
        }
    }

    /** 右侧图例：小图标 + 中文，参考图图例区 */
    private async buildLegendWithIcons(): Promise<void> {
        const panel = new Node('MapLegend');
        this.node.addChild(panel);
        const ut = panel.addComponent(UITransform);
        ut.setContentSize(240, 400);
        ut.anchorPoint.set(1, 0.5);
        const wg = panel.addComponent(Widget);
        wg.isAlignRight = true;
        wg.isAlignVerticalCenter = true;
        wg.right = 8;
        wg.verticalCenter = 20;
        wg.updateAlignment();

        const bg = new Node('LegendBg');
        panel.addChild(bg);
        bg.setSiblingIndex(0);
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(228, 380);
        bgUt.anchorPoint.set(0.5, 0.5);
        bg.setPosition(-20, 0, 0);
        const bgG = bg.addComponent(Graphics);
        bgG.fillColor = new Color(40, 55, 72, 170);
        bgG.roundRect(-114, -190, 228, 380, 8);
        bgG.fill();

        const title = new Node('Title');
        panel.addChild(title);
        const tUt = title.addComponent(UITransform);
        tUt.setContentSize(200, 32);
        title.setPosition(-30, 168, 0);
        const tLb = title.addComponent(Label);
        tLb.string = '图例';
        tLb.fontSize = 22;
        tLb.isBold = true;
        tLb.color = new Color(230, 235, 245, 255);

        let y = 120;
        for (const row of LEGEND_ROWS) {
            const sf = await loadSpriteFrame(row.path);
            const rowN = new Node(`Leg_${row.text}`);
            panel.addChild(rowN);
            rowN.setPosition(-140, y, 0);
            y -= 44;
            if (sf) {
                const ic = new Node('Ic');
                rowN.addChild(ic);
                const iUt = ic.addComponent(UITransform);
                iUt.setContentSize(36, 36);
                ic.setPosition(0, 0, 0);
                const iSp = ic.addComponent(Sprite);
                iSp.spriteFrame = sf;
                iSp.sizeMode = Sprite.SizeMode.CUSTOM;
            }
            const lbN = new Node('Txt');
            rowN.addChild(lbN);
            lbN.setPosition(52, 0, 0);
            const lbUt = lbN.addComponent(UITransform);
            lbUt.setContentSize(140, 36);
            const lb = lbN.addComponent(Label);
            lb.string = row.text;
            lb.fontSize = 18;
            lb.color = new Color(220, 228, 240, 255);
            lb.horizontalAlign = 0;
        }
    }

    private addLineLayer(parent: Node, vsW: number, vsH: number): Graphics {
        const n = new Node('MapEdges');
        parent.addChild(n);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(vsW, vsH);
        ut.anchorPoint.set(0.5, 0.5);
        const g = n.addComponent(Graphics);
        g.lineWidth = 3.2;
        g.strokeColor = new Color(88, 96, 112, 200);
        return g;
    }

    private addPathLayer(parent: Node, vsW: number, vsH: number): Graphics {
        const n = new Node('MapPath');
        parent.addChild(n);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(vsW, vsH);
        ut.anchorPoint.set(0.5, 0.5);
        const g = n.addComponent(Graphics);
        g.lineWidth = 11;
        g.strokeColor = new Color(235, 85, 150, 235);
        return g;
    }

    private redrawEdgeLines(): void {
        const g = this._lineGraphics;
        if (!g) {
            return;
        }
        g.clear();
        g.lineWidth = 3.2;
        g.strokeColor = new Color(88, 96, 112, 200);
        for (const n of MAP_GRAPH) {
            const a = graphPos(n.id);
            for (const cid of n.children) {
                const b = graphPos(cid);
                strokeDashedLine(g, a.x, a.y, b.x, b.y, 9, 6);
            }
        }
    }

    private redrawPathLine(): void {
        const g = this._pathGraphics;
        if (!g) {
            return;
        }
        g.clear();
        const path = GlobalData.instance.mapPathNodeIds;
        if (path.length < 2) {
            return;
        }
        g.lineWidth = 11;
        g.strokeColor = new Color(235, 85, 150, 235);
        const p0 = graphPos(path[0]);
        g.moveTo(p0.x, p0.y);
        for (let i = 1; i < path.length; i++) {
            const p = graphPos(path[i]);
            g.lineTo(p.x, p.y);
        }
        g.stroke();
    }

    private async buildMapVisuals(): Promise<void> {
        const vs = view.getVisibleSize();
        const padTop = 82;
        const padBottom = 16;
        const innerH = Math.max(400, vs.height - padTop - padBottom);
        const root = new Node('MapContent');
        this.node.addChild(root);
        const rootUt = root.addComponent(UITransform);
        rootUt.setContentSize(vs.width, innerH);
        rootUt.anchorPoint.set(0.5, 0.5);
        root.setPosition(0, (padBottom - padTop) * 0.5, 0);
        this._contentRoot = root;
        root.setSiblingIndex(0);

        const zoomRoot = new Node('MapZoomRoot');
        root.addChild(zoomRoot);
        const zUt = zoomRoot.addComponent(UITransform);
        zUt.setContentSize(vs.width, innerH);
        zUt.anchorPoint.set(0.5, 0.5);
        zoomRoot.setPosition(0, 0, 0);
        this._zoomRoot = zoomRoot;

        this.bindMapZoomInput(root);

        const bgH = innerH / MAP_BG_LAYERS.length;
        for (let i = 0; i < MAP_BG_LAYERS.length; i++) {
            const path = MAP_BG_LAYERS[i];
            const sf = await loadSpriteFrame(path);
            if (!sf) {
                continue;
            }
            const n = new Node(`Bg_${i}`);
            zoomRoot.addChild(n);
            const ut = n.addComponent(UITransform);
            ut.setContentSize(vs.width + 8, bgH + 4);
            ut.anchorPoint.set(0.5, 0.5);
            const y = -innerH * 0.5 + bgH * (i + 0.5);
            n.setPosition(0, y, 0);
            const sp = n.addComponent(Sprite);
            sp.spriteFrame = sf;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
        }

        this._lineGraphics = this.addLineLayer(zoomRoot, vs.width, innerH);
        this._pathGraphics = this.addPathLayer(zoomRoot, vs.width, innerH);

        const plateSf = await loadSpriteFrame(PLATE);
        const auraSf = await loadSpriteFrame(AURA_TEX);
        const markerPath = MARKER_BY_CHAR[GlobalData.instance.selectedCharId] ?? MARKER_BY_CHAR[0];
        const markerSf = await loadSpriteFrame(markerPath);
        const pingSf = await loadSpriteFrame(PING);

        this._wrapById = [];
        this._glowById = [];
        this._ringGfxById = [];

        for (const def of MAP_GRAPH) {
            const iconSf = await loadSpriteFrame(ICON[def.kind]);
            const wrap = new Node(`Node_${def.id}`);
            zoomRoot.addChild(wrap);
            wrap.setPosition(def.x, def.y, 0);
            const wUt = wrap.addComponent(UITransform);
            wUt.setContentSize(120, 120);
            this._wrapById[def.id] = wrap;

            if (auraSf) {
                const aura = new Node('Aura');
                wrap.addChild(aura);
                aura.setSiblingIndex(0);
                const aUt = aura.addComponent(UITransform);
                aUt.setContentSize(138, 138);
                const aSp = aura.addComponent(Sprite);
                aSp.spriteFrame = auraSf;
                aSp.sizeMode = Sprite.SizeMode.CUSTOM;
                aSp.color = new Color(42, 48, 58, 200);
            }

            let glowSp: Sprite | undefined;
            if (plateSf) {
                const glow = new Node('WarmGlow');
                wrap.addChild(glow);
                const gUt = glow.addComponent(UITransform);
                gUt.setContentSize(128, 128);
                const gSp = glow.addComponent(Sprite);
                gSp.spriteFrame = plateSf;
                gSp.sizeMode = Sprite.SizeMode.CUSTOM;
                gSp.color = new Color(255, 175, 110, 0);
                glowSp = gSp;
            }
            this._glowById[def.id] = glowSp;

            if (plateSf) {
                const plate = new Node('Plate');
                wrap.addChild(plate);
                const pUt = plate.addComponent(UITransform);
                pUt.setContentSize(112, 112);
                const pSp = plate.addComponent(Sprite);
                pSp.spriteFrame = plateSf;
                pSp.sizeMode = Sprite.SizeMode.CUSTOM;
            }
            if (iconSf) {
                const ic = new Node('Icon');
                wrap.addChild(ic);
                const iUt = ic.addComponent(UITransform);
                iUt.setContentSize(72, 72);
                const iSp = ic.addComponent(Sprite);
                iSp.spriteFrame = iconSf;
                iSp.sizeMode = Sprite.SizeMode.CUSTOM;
            }

            const ringN = new Node('SelectRing');
            wrap.addChild(ringN);
            const rUt = ringN.addComponent(UITransform);
            rUt.setContentSize(120, 120);
            const rGfx = ringN.addComponent(Graphics);
            paintSelectionRing(rGfx, 54, 5, new Color(255, 255, 255, 250));
            ringN.active = false;
            this._ringGfxById[def.id] = rGfx;

            const nid = def.id;
            wrap.on(Node.EventType.TOUCH_END, () => this.onTapNode(nid), this);
        }

        if (pingSf && markerSf) {
            const pingNode = new Node('PlayerPing');
            const pingUt = pingNode.addComponent(UITransform);
            pingUt.setContentSize(56, 56);
            pingNode.addComponent(Sprite).spriteFrame = pingSf;
            const pingSp = pingNode.getComponent(Sprite)!;
            pingSp.sizeMode = Sprite.SizeMode.CUSTOM;

            const mNode = new Node('CharMarker');
            pingNode.addChild(mNode);
            const mUt = mNode.addComponent(UITransform);
            mUt.setContentSize(40, 40);
            mUt.anchorPoint.set(0.5, 0.5);
            mNode.setPosition(0, 18, 0);
            const mSp = mNode.addComponent(Sprite);
            mSp.spriteFrame = markerSf;
            mSp.sizeMode = Sprite.SizeMode.CUSTOM;

            this._pingRoot = pingNode;
        }
    }

    private bindMapZoomInput(mapRoot: Node): void {
        mapRoot.on(Node.EventType.MOUSE_WHEEL, this.onMapMouseWheel, this);
        mapRoot.on(Node.EventType.TOUCH_START, this.onMapTouchStart, this);
        mapRoot.on(Node.EventType.TOUCH_MOVE, this.onMapTouchMove, this);
        mapRoot.on(Node.EventType.TOUCH_END, this.onMapTouchEnd, this);
        mapRoot.on(Node.EventType.TOUCH_CANCEL, this.onMapTouchEnd, this);
    }

    private onMapMouseWheel(ev: EventMouse): void {
        const scroll = ev.getScrollY();
        if (Math.abs(scroll) < 0.01) {
            return;
        }
        const factor = scroll > 0 ? 1 + ZOOM_WHEEL_STEP : 1 - ZOOM_WHEEL_STEP;
        this.setMapScale(this._mapScale * factor);
    }

    private onMapTouchStart(ev: EventTouch): void {
        const t = ev.touch;
        if (!t) {
            return;
        }
        this._touchUiPos.set(t.getID(), t.getUILocation());
        if (this._touchUiPos.size >= 2) {
            this._lastPinchDist = 0;
        }
    }

    private onMapTouchMove(ev: EventTouch): void {
        const t = ev.touch;
        if (!t) {
            return;
        }
        this._touchUiPos.set(t.getID(), t.getUILocation());
        if (this._touchUiPos.size < 2 || !this._zoomRoot) {
            return;
        }
        const pts = Array.from(this._touchUiPos.values());
        if (pts.length < 2) {
            return;
        }
        const d = Vec2.distance(pts[0], pts[1]);
        if (d < 8) {
            return;
        }
        if (this._lastPinchDist < 1) {
            this._lastPinchDist = d;
            return;
        }
        const ratio = d / this._lastPinchDist;
        this._lastPinchDist = d;
        this.setMapScale(this._mapScale * ratio);
    }

    private onMapTouchEnd(ev: EventTouch): void {
        const t = ev.touch;
        if (t) {
            this._touchUiPos.delete(t.getID());
        }
        if (this._touchUiPos.size < 2) {
            this._lastPinchDist = 0;
        }
    }

    private setMapScale(s: number): void {
        const next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, s));
        this._mapScale = next;
        if (this._zoomRoot) {
            this._zoomRoot.setScale(next, next, 1);
        }
    }

    private onTapNode(nodeId: number): void {
        const cur = GlobalData.instance.mapCurrentNodeId;
        const curNode = MAP_GRAPH[cur];
        if (!curNode || !curNode.children.includes(nodeId)) {
            return;
        }
        GlobalData.instance.mapCurrentNodeId = nodeId;
        GlobalData.instance.mapPathNodeIds.push(nodeId);
        this.redrawPathLine();
        this.refreshRunHud();
        this.refreshPingAndInteract();
        const next = MAP_GRAPH[nodeId];
        const combatKinds: MapNodeKind[] = ['monster', 'elite', 'boss'];
        if (next && combatKinds.includes(next.kind)) {
            GlobalData.instance.prepareEncounter(next.kind as 'monster' | 'elite' | 'boss', nodeId);
            director.loadScene(SCENE_BATTLE, (err) => {
                if (err) {
                    console.error('[MapScreenManager] 进入战斗场景失败（请确认构建已包含 Battle）', err);
                }
            });
            return;
        }

        if (next?.kind === 'event') {
            // 进入事件房间（兴趣点）
            director.loadScene(SCENE_EVENT, (err) => {
                if (err) {
                    console.error('[MapScreenManager] 进入事件场景失败（请确认构建已包含 Event）', err);
                }
            });
            return;
        }

        if (next?.kind === 'rest') {
            void this.showCampfireSpireStyle(nodeId);
            return;
        }
        if (next?.kind === 'shop') {
            void this.showShopBoardStyle(nodeId);
        }
    }

    private async showCampfireSpireStyle(nodeId: number): Promise<void> {
        const { panel } = this.createSceneModal('CampfireSpirePanel', 980, 560);
        const gd = GlobalData.instance;
        const ch = gd.selectedChar;
        const resolved = gd.isMapNodeResolved(nodeId);

        this.addModalLabel(panel, 'CampTitle', 880, 42, 0, 226, 34, new Color(255, 219, 126, 255), Label.HorizontalAlign.CENTER).string = '营火';
        const status = this.addModalLabel(panel, 'CampStatus', 760, 34, 0, 184, 19, new Color(224, 232, 240, 255), Label.HorizontalAlign.CENTER);
        status.string = resolved
            ? '这个营火已经使用过。'
            : ch
                ? `生命 ${ch.hp}/${ch.maxHp}    牌组 ${gd.deckIds.length || gd.deckCount} 张`
                : '当前没有角色数据。';

        await this.drawCampfireBackdrop(panel);
        await this.addSpriteFromPath(panel, 'RestSiteIcon', ICON.rest, 82, 82, -360, 90, new Color(255, 245, 220, 255));

        const restNode = this.makeCampfireOption(panel, 'RestOption', '休息', '回复 30% 最大生命', -130, 8, !resolved && !!ch);
        const smithEnabled = !resolved && gd.deckIds.includes('strike');
        const smithNode = this.makeCampfireOption(panel, 'SmithOption', '锻造', '将一张打击升级为打击+', 142, 8, smithEnabled);

        restNode.on(Node.EventType.TOUCH_END, () => {
            const hero = gd.selectedChar;
            if (!hero || gd.isMapNodeResolved(nodeId)) {
                return;
            }
            const before = hero.hp;
            const amount = Math.max(1, Math.floor(hero.maxHp * CAMPFIRE_REST_RATIO));
            hero.hp = Math.min(hero.maxHp, hero.hp + amount);
            gd.markMapNodeResolved(nodeId);
            status.string = hero.hp > before ? `休息完成，回复 ${hero.hp - before} 点生命。` : '休息完成，生命已经是满值。';
            restNode.active = false;
            smithNode.active = false;
            RunHudManager.startRun();
        }, this);

        smithNode.on(Node.EventType.TOUCH_END, () => {
            if (gd.isMapNodeResolved(nodeId)) {
                return;
            }
            const idx = gd.deckIds.indexOf('strike');
            if (idx < 0) {
                status.string = '牌组里已经没有可升级的打击。';
                return;
            }
            gd.deckIds[idx] = 'strike_plus';
            gd.deckCount = gd.deckIds.length;
            gd.markMapNodeResolved(nodeId);
            status.string = '锻造完成，一张打击升级为打击+。';
            restNode.active = false;
            smithNode.active = false;
            RunHudManager.startRun();
        }, this);

        this.makeModalButton(panel, 'LeaveCampfire', '离开', 170, 54, 0, -218, () => {
            this.closeModal();
            this.refreshRunHud();
        }, true);
        RunHudManager.setCenterText('营火  |  Rest / Smith');
    }

    private async showShopBoardStyle(nodeId: number): Promise<void> {
        const { panel } = this.createSceneModal('ShopBoardPanel', 1760, 900);
        const gd = GlobalData.instance;
        const resolved = gd.isMapNodeResolved(nodeId);
        const removalCost = SHOP_REMOVE_BASE_COST + gd.shopRemovalCount * SHOP_REMOVE_COST_STEP;
        const status = this.addModalLabel(panel, 'ShopBoardStatus', 740, 36, 340, 390, 24, new Color(255, 238, 190, 255), Label.HorizontalAlign.RIGHT);
        const showStatus = (msg?: string) => {
            status.string = msg ? `金币 ${gd.selectedChar?.gold ?? 0}    ${msg}` : `金币 ${gd.selectedChar?.gold ?? 0}`;
        };

        await this.drawShopBoardBackdrop(panel);
        await this.addSpriteFromPath(panel, 'ShopMapIcon', ICON.shop, 72, 72, -788, 350, new Color(255, 240, 190, 255));
        this.addModalLabel(panel, 'ShopBoardTitle', 290, 46, -700, 350, 38, new Color(255, 225, 150, 255), Label.HorizontalAlign.LEFT).string = '商店';
        showStatus(resolved ? '这个商店已经结算。' : undefined);

        const buyCard = (cardId: CardId, title: string, price: number): boolean => {
            const hero = gd.selectedChar;
            if (!hero || hero.gold < price || resolved) {
                showStatus('金币不足，无法购买卡牌。');
                return false;
            }
            hero.gold -= price;
            gd.deckIds.push(cardId);
            gd.deckCount = gd.deckIds.length;
            RunHudManager.startRun();
            showStatus(`购买卡牌：${title}`);
            return true;
        };

        const cardItems = [
            { node: 'ShopC1', title: '重击', id: SHOP_CARD_ID, cost: 2, price: 49, x: -520, y: 178, art: 'textures/cards/bash', sale: false },
            { node: 'ShopC2', title: '完美打击', id: SHOP_CARD_ID, cost: 2, price: 24, x: -310, y: 178, art: 'textures/cards/perfected_strike', sale: true },
            { node: 'ShopC3', title: '生存者', id: SHOP_SKILL_CARD_ID, cost: 1, price: 74, x: -100, y: 178, art: 'textures/cards/survivor', sale: false },
            { node: 'ShopC4', title: '破灭', id: SHOP_CARD_ID, cost: 1, price: 50, x: 110, y: 178, art: 'textures/cards/bash', sale: false },
            { node: 'ShopC5', title: '惊逃', id: SHOP_SKILL_CARD_ID, cost: 2, price: 77, x: 320, y: 178, art: 'textures/cards/survivor', sale: false },
            { node: 'ShopC6', title: '净化', id: SHOP_SKILL_CARD_ID, cost: 0, price: 89, x: -420, y: -170, art: 'textures/cards/cleanse', sale: false },
            { node: 'ShopC7', title: '狠揍', id: SHOP_CARD_ID, cost: 3, price: 168, x: -190, y: -170, art: 'textures/cards/perfected_strike', sale: false },
        ];
        for (const item of cardItems) {
            await this.makeShopBoardCard(panel, item.node, item.title, item.cost, item.price, item.x, item.y, item.art, item.sale, () => buyCard(item.id, item.title, item.price), !resolved);
        }

        const relicItems: { node: string; id: RelicId; price: number; x: number; y: number }[] = [
            { node: 'ShopRelicEnergy', id: 'neow_energy_core', price: 250, x: 220, y: -18 },
            { node: 'ShopRelicWing', id: 'neow_spirit_wing', price: 251, x: 420, y: -18 },
            { node: 'ShopRelicRose', id: 'neow_golden_rose', price: 225, x: 620, y: -18 },
        ];
        for (const item of relicItems) {
            const relic = getRelicDef(item.id);
            await this.makeShopBoardIconItem(panel, item.node, relic?.name ?? item.id, relic?.iconPath ?? ICON.shop, item.price, item.x, item.y, () => {
                const hero = gd.selectedChar;
                if (!hero || hero.gold < item.price || resolved) {
                    showStatus('金币不足，无法购买遗物。');
                    return false;
                }
                if (hero.relics.includes(item.id)) {
                    showStatus('你已经拥有这件遗物。');
                    return false;
                }
                hero.gold -= item.price;
                hero.relics.push(item.id);
                RunHudManager.startRun();
                showStatus(`购买遗物：${relic?.name ?? item.id}`);
                return true;
            }, !resolved && !(gd.selectedChar?.relics.includes(item.id)));
        }

        const potionItems = [
            { node: 'PotionFire', id: 'fire_potion', title: '火焰药水', art: 'textures/potions/fire_potion', price: 52, x: 220, y: -238 },
            { node: 'PotionSwift', id: 'swift_potion', title: '敏捷药水', art: 'textures/potions/swift_potion', price: 73, x: 420, y: -238 },
            { node: 'PotionBlood', id: 'blood_potion', title: '鲜血药水', art: 'textures/potions/blood_potion', price: 49, x: 620, y: -238 },
        ];
        for (const item of potionItems) {
            await this.makeShopBoardIconItem(panel, item.node, item.title, item.art, item.price, item.x, item.y, () => {
                const hero = gd.selectedChar;
                if (!hero || hero.gold < item.price || resolved) {
                    showStatus('金币不足，无法购买药水。');
                    return false;
                }
                hero.gold -= item.price;
                gd.potionIds.push(item.id);
                RunHudManager.startRun();
                showStatus(`购买药水：${item.title}`);
                return true;
            }, !resolved);
        }

        await this.makeShopBoardRemove(panel, 'CardRemovalService', removalCost, 718, -150, () => {
            const hero = gd.selectedChar;
            if (!hero || hero.gold < removalCost || resolved) {
                showStatus('金币不足，无法使用删牌服务。');
                return false;
            }
            const idx = gd.deckIds.indexOf('strike');
            if (idx < 0) {
                showStatus('牌组里没有可移除的打击。');
                return false;
            }
            hero.gold -= removalCost;
            gd.deckIds.splice(idx, 1);
            gd.deckCount = gd.deckIds.length;
            gd.shopRemovalCount += 1;
            RunHudManager.startRun();
            showStatus('移除一张打击。');
            return true;
        }, !resolved && gd.deckIds.includes('strike'));

        await this.makeShopBackButton(panel, () => {
            gd.markMapNodeResolved(nodeId);
            this.closeModal();
            this.refreshRunHud();
        });
        RunHudManager.setCenterText('商店  |  卡牌 / 遗物 / 药水 / 删牌服务');
    }

    private async showShopSpireStyle(nodeId: number): Promise<void> {
        const { panel } = this.createSceneModal('ShopSpirePanel', 1080, 620);
        const gd = GlobalData.instance;
        const hero = gd.selectedChar;
        const resolved = gd.isMapNodeResolved(nodeId);
        const card = getCardDef(SHOP_CARD_ID);
        const skillCard = getCardDef(SHOP_SKILL_CARD_ID);
        const relic = getRelicDef(SHOP_RELIC_ID);
        const removalCost = SHOP_REMOVE_BASE_COST + gd.shopRemovalCount * SHOP_REMOVE_COST_STEP;

        this.drawShopBackdrop(panel);
        await this.addSpriteFromPath(panel, 'ShopIcon', ICON.shop, 66, 66, -492, 252, new Color(255, 240, 190, 255));
        await this.addSpriteFromPath(panel, 'MerchantArt', SHOP_MERCHANT_ART, 238, 186, -396, 38, new Color(245, 248, 255, 245));
        this.addModalLabel(panel, 'ShopTitle', 450, 40, -264, 248, 31, new Color(255, 222, 140, 255), Label.HorizontalAlign.LEFT).string = '商店';
        this.addModalLabel(panel, 'MerchantLine', 250, 44, -394, -92, 17, new Color(215, 224, 232, 255), Label.HorizontalAlign.CENTER).string = '买点什么？';

        const status = this.addModalLabel(panel, 'ShopStatus', 700, 30, 132, 249, 18, new Color(232, 238, 244, 255), Label.HorizontalAlign.RIGHT);
        const refreshGold = (message?: string) => {
            const goldText = `金币 ${gd.selectedChar?.gold ?? 0}`;
            status.string = message ? `${goldText}    ${message}` : goldText;
        };
        refreshGold(resolved ? '这个商店已经结算。' : undefined);

        this.addShelfLabel(panel, 'CardShelfLabel', '卡牌货架', -112, 166);
        const cardSlot = this.makeShopCardSlot(panel, 'ShopCardBash', -214, 56, card?.name ?? SHOP_CARD_ID, card?.cost ?? 1, card?.description ?? '', SHOP_CARD_COST, () => {
            const h = gd.selectedChar;
            if (!h || h.gold < SHOP_CARD_COST || resolved) {
                refreshGold('金币不足，无法购买卡牌。');
                return false;
            }
            h.gold -= SHOP_CARD_COST;
            gd.deckIds.push(SHOP_CARD_ID);
            gd.deckCount = gd.deckIds.length;
            RunHudManager.startRun();
            refreshGold(`购买 ${card?.name ?? SHOP_CARD_ID}。`);
            return true;
        }, !resolved);
        const skillSlot = this.makeShopCardSlot(panel, 'ShopCardSkill', -46, 56, skillCard?.name ?? SHOP_SKILL_CARD_ID, skillCard?.cost ?? 1, skillCard?.description ?? '', SHOP_SKILL_CARD_COST, () => {
            const h = gd.selectedChar;
            if (!h || h.gold < SHOP_SKILL_CARD_COST || resolved) {
                refreshGold('金币不足，无法购买卡牌。');
                return false;
            }
            h.gold -= SHOP_SKILL_CARD_COST;
            gd.deckIds.push(SHOP_SKILL_CARD_ID);
            gd.deckCount = gd.deckIds.length;
            RunHudManager.startRun();
            refreshGold(`购买 ${skillCard?.name ?? SHOP_SKILL_CARD_ID}。`);
            return true;
        }, !resolved);
        cardSlot.on(Node.EventType.MOUSE_ENTER, () => refreshGold(card?.description), this);
        skillSlot.on(Node.EventType.MOUSE_ENTER, () => refreshGold(skillCard?.description), this);

        this.addShelfLabel(panel, 'RelicShelfLabel', '遗物', 198, 166);
        const relicSlot = this.makeShopRelicSlot(panel, 'ShopRelic', 206, 62, relic?.name ?? SHOP_RELIC_ID, relic?.description ?? '', SHOP_RELIC_COST, () => {
            const h = gd.selectedChar;
            if (!h || h.gold < SHOP_RELIC_COST || resolved) {
                refreshGold('金币不足，无法购买遗物。');
                return false;
            }
            if (h.relics.includes(SHOP_RELIC_ID)) {
                refreshGold('你已经拥有这件遗物。');
                return false;
            }
            h.gold -= SHOP_RELIC_COST;
            h.relics.push(SHOP_RELIC_ID);
            RunHudManager.startRun();
            refreshGold(`购买 ${relic?.name ?? SHOP_RELIC_ID}。`);
            return true;
        }, !resolved && !(hero?.relics.includes(SHOP_RELIC_ID)));
        if (relic?.iconPath) {
            await this.addSpriteFromPath(relicSlot, 'RelicIcon', relic.iconPath, 68, 68, 0, 30, new Color(255, 255, 255, 255));
        }
        relicSlot.on(Node.EventType.MOUSE_ENTER, () => refreshGold(relic?.description), this);

        this.addShelfLabel(panel, 'ServiceShelfLabel', '服务', 388, 166);
        const serviceSlot = this.makeShopServiceSlot(panel, 'CardRemoveService', 392, 56, removalCost, () => {
            const h = gd.selectedChar;
            if (!h || h.gold < removalCost || resolved) {
                refreshGold('金币不足，无法使用删牌服务。');
                return false;
            }
            const idx = gd.deckIds.indexOf('strike');
            if (idx < 0) {
                refreshGold('牌组里没有可移除的打击。');
                return false;
            }
            h.gold -= removalCost;
            gd.deckIds.splice(idx, 1);
            gd.deckCount = gd.deckIds.length;
            gd.shopRemovalCount += 1;
            RunHudManager.startRun();
            refreshGold('移除一张打击。');
            return true;
        }, !resolved && gd.deckIds.includes('strike'));
        serviceSlot.on(Node.EventType.MOUSE_ENTER, () => refreshGold('每个商店只能使用一次，价格会随本局使用次数提高。'), this);

        this.makeModalButton(panel, 'LeaveShop', '离开', 170, 54, 398, -244, () => {
            gd.markMapNodeResolved(nodeId);
            this.closeModal();
            this.refreshRunHud();
        }, true);
        RunHudManager.setCenterText('商店  |  独立购买商品');
    }

    private showCampfire(nodeId: number): void {
        const modal = this.createModal('CampfirePanel', '火堆', '在篝火旁整理状态，只能选择一项主要行动。');
        const panel = modal.panel;
        const gd = GlobalData.instance;
        const ch = gd.selectedChar;
        const resolved = gd.isMapNodeResolved(nodeId);
        const status = this.addModalLabel(panel, 'Status', 620, 58, 0, 92, 20, new Color(220, 228, 238, 255), Label.HorizontalAlign.CENTER);
        status.string = resolved
            ? '这处火堆已经使用过。'
            : ch
                ? `当前生命 ${ch.hp}/${ch.maxHp}，牌组 ${gd.deckIds.length || gd.deckCount} 张。`
                : '当前没有角色数据。';

        let smithBtn: Node;
        const restBtn = this.makeModalButton(panel, 'RestButton', '休息', 210, 74, -230, -8, () => {
            const hero = gd.selectedChar;
            if (!hero || gd.isMapNodeResolved(nodeId)) {
                return;
            }
            const before = hero.hp;
            const amount = Math.max(1, Math.ceil(hero.maxHp * CAMPFIRE_REST_RATIO));
            hero.hp = Math.min(hero.maxHp, hero.hp + amount);
            gd.markMapNodeResolved(nodeId);
            status.string = hero.hp > before
                ? `休息完成，回复 ${hero.hp - before} 点生命。`
                : '休息完成，生命已经是满值。';
            restBtn.active = false;
            smithBtn.active = false;
            RunHudManager.startRun();
        }, !resolved && !!ch);
        this.addModalLabel(restBtn, 'Desc', 180, 28, 0, -18, 15, new Color(222, 232, 242, 255), Label.HorizontalAlign.CENTER).string = '回复 30% 最大生命';

        const smithEnabled = !resolved && gd.deckIds.includes('strike');
        smithBtn = this.makeModalButton(panel, 'SmithButton', '锻造', 210, 74, 0, -8, () => {
            if (gd.isMapNodeResolved(nodeId)) {
                return;
            }
            const idx = gd.deckIds.indexOf('strike');
            if (idx < 0) {
                status.string = '牌组里已经没有可升级的打击。';
                return;
            }
            gd.deckIds[idx] = 'strike_plus';
            gd.deckCount = gd.deckIds.length;
            gd.markMapNodeResolved(nodeId);
            status.string = '锻造完成，将一张「打击」升级为「打击+」。';
            restBtn.active = false;
            smithBtn.active = false;
            RunHudManager.startRun();
        }, smithEnabled);
        this.addModalLabel(smithBtn, 'Desc', 180, 28, 0, -18, 15, new Color(222, 232, 242, 255), Label.HorizontalAlign.CENTER).string = '打击 6 → 打击+ 9';

        this.makeModalButton(panel, 'LeaveButton', '离开', 160, 56, 230, -8, () => this.closeModal(), true);
        RunHudManager.setCenterText('火堆  |  休息 / 锻造 / 离开');
    }

    private showShop(nodeId: number): void {
        const modal = this.createModal('ShopPanel', '商店', '展示三种商品类型：卡牌、遗物、服务。每类各一项。');
        const panel = modal.panel;
        const gd = GlobalData.instance;
        const ch = gd.selectedChar;
        const resolved = gd.isMapNodeResolved(nodeId);
        const status = this.addModalLabel(panel, 'Status', 660, 42, 0, 106, 18, new Color(220, 228, 238, 255), Label.HorizontalAlign.CENTER);
        status.string = resolved ? '这间商店已经离开，货架不再结算。' : `金币 ${ch?.gold ?? 0}`;

        const card = getCardDef(SHOP_CARD_ID);
        const relic = getRelicDef(SHOP_RELIC_ID);

        this.buildShopProduct(panel, 'CardProduct', '卡牌', card?.name ?? SHOP_CARD_ID, card?.description ?? '获得一张卡牌。', SHOP_CARD_COST, -260, () => {
            const hero = gd.selectedChar;
            if (!hero || hero.gold < SHOP_CARD_COST || resolved) {
                status.string = '金币不足，无法购买卡牌。';
                return false;
            }
            hero.gold -= SHOP_CARD_COST;
            gd.deckIds.push(SHOP_CARD_ID);
            gd.deckCount = gd.deckIds.length;
            status.string = `购买卡牌「${card?.name ?? SHOP_CARD_ID}」，牌组 +1。`;
            RunHudManager.startRun();
            return true;
        }, !resolved);

        this.buildShopProduct(panel, 'RelicProduct', '遗物', relic?.name ?? SHOP_RELIC_ID, relic?.description ?? '获得一个遗物。', SHOP_RELIC_COST, 0, () => {
            const hero = gd.selectedChar;
            if (!hero || hero.gold < SHOP_RELIC_COST || resolved) {
                status.string = '金币不足，无法购买遗物。';
                return false;
            }
            if (hero.relics.includes(SHOP_RELIC_ID)) {
                status.string = '你已经拥有这件遗物。';
                return false;
            }
            hero.gold -= SHOP_RELIC_COST;
            hero.relics.push(SHOP_RELIC_ID);
            status.string = `购买遗物「${relic?.name ?? SHOP_RELIC_ID}」。`;
            RunHudManager.startRun();
            return true;
        }, !resolved && !(ch?.relics.includes(SHOP_RELIC_ID)));

        this.buildShopProduct(panel, 'ServiceProduct', '服务', '卡牌移除', '移除牌组中的一张「打击」。', SHOP_REMOVE_COST, 260, () => {
            const hero = gd.selectedChar;
            if (!hero || hero.gold < SHOP_REMOVE_COST || resolved) {
                status.string = '金币不足，无法购买服务。';
                return false;
            }
            const idx = gd.deckIds.indexOf('strike');
            if (idx < 0) {
                status.string = '牌组里没有可移除的打击。';
                return false;
            }
            hero.gold -= SHOP_REMOVE_COST;
            gd.deckIds.splice(idx, 1);
            gd.deckCount = gd.deckIds.length;
            status.string = '购买服务，移除一张「打击」。';
            RunHudManager.startRun();
            return true;
        }, !resolved && gd.deckIds.includes('strike'));

        this.makeModalButton(panel, 'LeaveShop', '离开商店', 180, 56, 0, -188, () => {
            gd.markMapNodeResolved(nodeId);
            this.closeModal();
            this.refreshRunHud();
        }, true);
        RunHudManager.setCenterText('商店  |  卡牌 / 遗物 / 服务');
    }

    private buildShopProduct(
        parent: Node,
        name: string,
        type: string,
        title: string,
        desc: string,
        cost: number,
        x: number,
        onBuy: () => boolean,
        enabled: boolean,
    ): void {
        const card = new Node(name);
        parent.addChild(card);
        card.setPosition(x, -30, 0);
        const ut = card.addComponent(UITransform);
        ut.setContentSize(230, 260);
        const g = card.addComponent(Graphics);
        paintRoundRect(g, 230, 260, new Color(26, 31, 42, 238), new Color(120, 94, 54, 255), 2);

        this.addModalLabel(card, 'Type', 190, 24, 0, 92, 16, new Color(168, 196, 228, 255), Label.HorizontalAlign.CENTER).string = type;
        this.addModalLabel(card, 'Title', 190, 34, 0, 56, 23, new Color(255, 218, 128, 255), Label.HorizontalAlign.CENTER).string = title;
        const descLb = this.addModalLabel(card, 'Desc', 184, 78, 0, 0, 16, new Color(220, 228, 238, 255), Label.HorizontalAlign.CENTER);
        descLb.lineHeight = 22;
        descLb.string = desc;
        this.addModalLabel(card, 'Cost', 170, 28, 0, -66, 18, new Color(255, 236, 165, 255), Label.HorizontalAlign.CENTER).string = `${cost} 金币`;
        const buy = this.makeModalButton(card, 'Buy', enabled ? '购买' : '不可购买', 150, 44, 0, -108, () => {
            if (onBuy()) {
                buy.active = false;
                sold.active = true;
            }
        }, enabled);
        const sold = this.addModalLabel(card, 'Sold', 150, 44, 0, -108, 18, new Color(170, 178, 190, 255), Label.HorizontalAlign.CENTER).node;
        sold.active = !enabled;
    }

    private createSceneModal(name: string, w: number, h: number): { root: Node; panel: Node } {
        this.closeModal();
        const vs = view.getVisibleSize();
        const root = new Node(`${name}Overlay`);
        this.node.addChild(root);
        root.setSiblingIndex(this.node.children.length - 1);
        const rUt = root.addComponent(UITransform);
        rUt.setContentSize(vs.width, vs.height);
        root.addComponent(BlockInputEvents);
        const shade = root.addComponent(Graphics);
        shade.fillColor = new Color(0, 0, 0, 172);
        shade.rect(-vs.width * 0.5, -vs.height * 0.5, vs.width, vs.height);
        shade.fill();
        root.on(Node.EventType.TOUCH_START, () => {}, this);

        const panel = new Node(name);
        root.addChild(panel);
        const pUt = panel.addComponent(UITransform);
        pUt.setContentSize(w, h);
        const pg = panel.addComponent(Graphics);
        paintRoundRect(pg, w, h, new Color(18, 22, 30, 250), new Color(190, 141, 74, 255), 3);
        this._modalRoot = root;
        return { root, panel };
    }

    private async drawCampfireBackdrop(parent: Node): Promise<void> {
        const floor = new Node('CampFloor');
        parent.addChild(floor);
        floor.setPosition(0, -54, 0);
        const fut = floor.addComponent(UITransform);
        fut.setContentSize(860, 270);
        const fg = floor.addComponent(Graphics);
        fg.fillColor = new Color(29, 34, 44, 245);
        fg.roundRect(-430, -135, 860, 270, 8);
        fg.fill();
        fg.fillColor = new Color(58, 48, 40, 245);
        fg.rect(-410, -128, 820, 26);
        fg.fill();
        fg.lineWidth = 3;
        fg.strokeColor = new Color(118, 86, 54, 220);
        fg.moveTo(-420, -36);
        fg.lineTo(420, -36);
        fg.stroke();
        await this.addSpriteFromPath(parent, 'CampfireRestArt', CAMPFIRE_REST_ART, 340, 250, -302, -12, new Color(255, 248, 232, 255));
    }

    private drawShopBackdrop(parent: Node): void {
        const wall = new Node('ShopWall');
        parent.addChild(wall);
        const wut = wall.addComponent(UITransform);
        wut.setContentSize(1010, 520);
        const g = wall.addComponent(Graphics);
        g.fillColor = new Color(32, 28, 32, 245);
        g.roundRect(-505, -260, 1010, 520, 8);
        g.fill();
        g.fillColor = new Color(58, 38, 30, 245);
        g.rect(-505, -260, 1010, 92);
        g.fill();
        g.fillColor = new Color(83, 56, 38, 245);
        g.rect(-286, -152, 690, 26);
        g.fill();
        g.rect(-286, 122, 690, 24);
        g.fill();
        g.lineWidth = 3;
        g.strokeColor = new Color(167, 116, 62, 230);
        g.moveTo(-286, -124);
        g.lineTo(404, -124);
        g.stroke();
        g.moveTo(-286, 150);
        g.lineTo(404, 150);
        g.stroke();
        g.fillColor = new Color(22, 24, 30, 236);
        g.roundRect(-504, -216, 282, 380, 8);
        g.fill();
    }

    private async addSpriteFromPath(parent: Node, name: string, path: string, w: number, h: number, x: number, y: number, tint?: Color): Promise<Node | null> {
        const sf = await loadSpriteFrame(path);
        if (!sf) {
            return null;
        }
        const n = new Node(name);
        parent.addChild(n);
        n.setPosition(x, y, 0);
        const ut = n.addComponent(UITransform);
        const sp = n.addComponent(Sprite);
        sp.spriteFrame = sf;
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        ut.setContentSize(w, h);
        if (tint) {
            sp.color = tint;
        }
        return n;
    }

    private makeCampfireOption(parent: Node, name: string, title: string, desc: string, x: number, y: number, enabled: boolean): Node {
        const n = new Node(name);
        parent.addChild(n);
        n.setPosition(x, y, 0);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(224, 156);
        const g = n.addComponent(Graphics);
        paintRoundRect(
            g,
            224,
            156,
            enabled ? new Color(43, 52, 62, 244) : new Color(44, 44, 48, 210),
            enabled ? new Color(226, 189, 104, 255) : new Color(110, 116, 126, 225),
            3,
        );
        this.addModalLabel(n, 'OptionTitle', 180, 34, 0, 38, 24, enabled ? new Color(255, 228, 150, 255) : new Color(164, 168, 174, 255), Label.HorizontalAlign.CENTER).string = title;
        const lb = this.addModalLabel(n, 'OptionDesc', 176, 48, 0, -24, 16, enabled ? new Color(224, 232, 240, 255) : new Color(150, 154, 162, 255), Label.HorizontalAlign.CENTER);
        lb.lineHeight = 22;
        lb.string = desc;
        return n;
    }

    private addShelfLabel(parent: Node, name: string, text: string, x: number, y: number): void {
        this.addModalLabel(parent, name, 160, 28, x, y, 18, new Color(255, 224, 143, 255), Label.HorizontalAlign.CENTER).string = text;
    }

    private makeShopCardSlot(
        parent: Node,
        name: string,
        x: number,
        y: number,
        title: string,
        cost: number,
        desc: string,
        price: number,
        onBuy: () => boolean,
        enabled: boolean,
    ): Node {
        const slot = new Node(name);
        parent.addChild(slot);
        slot.setPosition(x, y, 0);
        const ut = slot.addComponent(UITransform);
        ut.setContentSize(132, 210);
        const g = slot.addComponent(Graphics);
        paintRoundRect(g, 132, 210, new Color(214, 190, 135, 255), new Color(99, 58, 42, 255), 3);
        this.addModalLabel(slot, 'Cost', 28, 28, -46, 82, 17, new Color(64, 49, 34, 255), Label.HorizontalAlign.CENTER).string = `${cost}`;
        this.addModalLabel(slot, 'Title', 104, 30, 8, 68, 18, new Color(45, 34, 25, 255), Label.HorizontalAlign.CENTER).string = title;
        const descLb = this.addModalLabel(slot, 'Desc', 104, 74, 0, 2, 14, new Color(72, 57, 42, 255), Label.HorizontalAlign.CENTER);
        descLb.lineHeight = 19;
        descLb.string = desc;
        this.addPriceButton(slot, 'Price', price, 0, -82, onBuy, enabled);
        return slot;
    }

    private makeShopRelicSlot(
        parent: Node,
        name: string,
        x: number,
        y: number,
        title: string,
        desc: string,
        price: number,
        onBuy: () => boolean,
        enabled: boolean,
    ): Node {
        const slot = new Node(name);
        parent.addChild(slot);
        slot.setPosition(x, y, 0);
        const ut = slot.addComponent(UITransform);
        ut.setContentSize(142, 188);
        const g = slot.addComponent(Graphics);
        paintRoundRect(g, 142, 188, new Color(33, 38, 48, 245), new Color(208, 168, 86, 255), 3);
        this.addModalLabel(slot, 'Title', 124, 26, 0, -20, 17, new Color(255, 225, 147, 255), Label.HorizontalAlign.CENTER).string = title;
        const descLb = this.addModalLabel(slot, 'Desc', 120, 44, 0, -54, 13, new Color(216, 226, 236, 255), Label.HorizontalAlign.CENTER);
        descLb.lineHeight = 17;
        descLb.string = desc;
        this.addPriceButton(slot, 'Price', price, 0, -82, onBuy, enabled);
        return slot;
    }

    private makeShopServiceSlot(parent: Node, name: string, x: number, y: number, price: number, onBuy: () => boolean, enabled: boolean): Node {
        const slot = new Node(name);
        parent.addChild(slot);
        slot.setPosition(x, y, 0);
        const ut = slot.addComponent(UITransform);
        ut.setContentSize(164, 190);
        const g = slot.addComponent(Graphics);
        paintRoundRect(g, 164, 190, new Color(36, 42, 52, 245), new Color(199, 155, 80, 255), 3);
        this.addModalLabel(slot, 'Scissor', 84, 42, 0, 42, 34, new Color(255, 225, 154, 255), Label.HorizontalAlign.CENTER).string = 'X';
        this.addModalLabel(slot, 'Title', 138, 30, 0, 6, 18, new Color(255, 225, 147, 255), Label.HorizontalAlign.CENTER).string = '卡牌移除';
        const descLb = this.addModalLabel(slot, 'Desc', 132, 36, 0, -32, 14, new Color(216, 226, 236, 255), Label.HorizontalAlign.CENTER);
        descLb.lineHeight = 18;
        descLb.string = '移除一张打击';
        this.addPriceButton(slot, 'Price', price, 0, -78, onBuy, enabled);
        return slot;
    }

    private addPriceButton(parent: Node, name: string, price: number, x: number, y: number, onBuy: () => boolean, enabled: boolean): void {
        const sold = this.addModalLabel(parent, `${name}Sold`, 104, 34, x, y, 16, new Color(174, 180, 188, 255), Label.HorizontalAlign.CENTER).node;
        sold.active = !enabled;
        let btn: Node;
        btn = this.makeModalButton(parent, name, enabled ? `${price} 金币` : '售罄', 104, 34, x, y, () => {
            if (onBuy()) {
                btn.active = false;
                sold.active = true;
            }
        }, enabled);
    }

    private async drawShopBoardBackdrop(parent: Node): Promise<void> {
        const bg = new Node('ShopBoardBackdrop');
        parent.addChild(bg);
        const ut = bg.addComponent(UITransform);
        ut.setContentSize(1760, 900);

        await this.addSpriteFromPath(bg, 'ShopRugFull', SHOP_RUG_FULL, 1760, 990, 28, -20, new Color(142, 196, 166, 255));
    }

    private async makeShopBoardCard(
        parent: Node,
        name: string,
        title: string,
        cost: number,
        price: number,
        x: number,
        y: number,
        artPath: string,
        sale: boolean,
        onBuy: () => boolean,
        enabled: boolean,
    ): Promise<void> {
        const slot = new Node(name);
        parent.addChild(slot);
        slot.setPosition(x, y, 0);
        const ut = slot.addComponent(UITransform);
        ut.setContentSize(170, 286);
        const frame = slot.addComponent(Graphics);
        const isSkill = title.includes('生存') || title.includes('净化');
        paintRoundRect(frame, 162, 236, isSkill ? new Color(72, 96, 111, 255) : new Color(126, 62, 49, 255), new Color(188, 126, 86, 255), 3);
        frame.fillColor = isSkill ? new Color(102, 190, 210, 255) : new Color(185, 84, 57, 255);
        frame.roundRect(-68, 80, 136, 30, 7);
        frame.fill();
        frame.fillColor = new Color(42, 40, 38, 238);
        frame.roundRect(-62, -86, 124, 78, 5);
        frame.fill();
        await this.addSpriteFromPath(slot, 'CardImage', artPath, 126, 78, 0, 38, new Color(255, 255, 255, enabled ? 255 : 145));
        const costOrb = new Node('CostOrb');
        slot.addChild(costOrb);
        costOrb.setPosition(-70, 104, 0);
        const orbUt = costOrb.addComponent(UITransform);
        orbUt.setContentSize(34, 34);
        const orb = costOrb.addComponent(Graphics);
        orb.fillColor = new Color(213, 71, 54, 255);
        orb.circle(0, 0, 17);
        orb.fill();
        orb.strokeColor = new Color(255, 174, 78, 255);
        orb.lineWidth = 2;
        orb.circle(0, 0, 15);
        orb.stroke();
        this.addModalLabel(costOrb, 'CostText', 28, 28, 0, 0, 20, new Color(255, 238, 170, 255), Label.HorizontalAlign.CENTER).string = `${cost}`;
        this.addModalLabel(slot, 'CardTitle', 116, 28, 10, 98, 19, new Color(255, 238, 210, 255), Label.HorizontalAlign.CENTER).string = title;
        const desc = title.includes('生存')
            ? '获得 8 点格挡。'
            : title.includes('净化')
                ? '保留，消耗。'
                : '造成 8 点伤害。';
        const descLb = this.addModalLabel(slot, 'CardDesc', 112, 62, 0, -52, 15, new Color(230, 225, 212, 255), Label.HorizontalAlign.CENTER);
        descLb.lineHeight = 19;
        descLb.string = desc;
        if (sale) {
            const tag = new Node('SaleTag');
            slot.addChild(tag);
            tag.setPosition(64, 112, 0);
            tag.angle = -18;
            const tagUt = tag.addComponent(UITransform);
            tagUt.setContentSize(42, 32);
            const tg = tag.addComponent(Graphics);
            paintRoundRect(tg, 42, 32, new Color(211, 55, 45, 255), new Color(255, 205, 132, 255), 2);
            this.addModalLabel(tag, 'Pct', 36, 28, 0, 0, 24, new Color(255, 230, 126, 255), Label.HorizontalAlign.CENTER).string = '%';
        }
        await this.addShopPriceButton(slot, 'BuyCard', price, 0, -138, onBuy, enabled);
        slot.on(Node.EventType.MOUSE_ENTER, () => {
            const lb = slot.getChildByName('CardNameTooltip') ?? this.addModalLabel(slot, 'CardNameTooltip', 170, 28, 0, 142, 18, new Color(255, 242, 190, 255), Label.HorizontalAlign.CENTER).node;
            lb.getComponent(Label)!.string = `${title}  ${cost}费`;
        }, this);
    }

    private async makeShopBoardIconItem(
        parent: Node,
        name: string,
        title: string,
        artPath: string,
        price: number,
        x: number,
        y: number,
        onBuy: () => boolean,
        enabled: boolean,
    ): Promise<void> {
        const slot = new Node(name);
        parent.addChild(slot);
        slot.setPosition(x, y, 0);
        const ut = slot.addComponent(UITransform);
        ut.setContentSize(88, 116);
        await this.addSpriteFromPath(slot, 'Icon', artPath, 58, 58, 0, 24, new Color(255, 255, 255, enabled ? 255 : 145));
        await this.addShopPriceButton(slot, 'BuyIcon', price, 0, -42, onBuy, enabled);
        slot.on(Node.EventType.MOUSE_ENTER, () => {
            const lb = slot.getChildByName('IconNameTooltip') ?? this.addModalLabel(slot, 'IconNameTooltip', 130, 24, 0, 68, 14, new Color(255, 242, 190, 255), Label.HorizontalAlign.CENTER).node;
            lb.getComponent(Label)!.string = title;
        }, this);
    }

    private async makeShopBoardRemove(parent: Node, name: string, price: number, x: number, y: number, onBuy: () => boolean, enabled: boolean): Promise<void> {
        const slot = new Node(name);
        parent.addChild(slot);
        slot.setPosition(x, y, 0);
        const ut = slot.addComponent(UITransform);
        ut.setContentSize(142, 142);
        await this.addSpriteFromPath(slot, 'RemoveIcon', SHOP_REMOVE_ICON, 122, 122, 0, 18, new Color(255, 255, 255, enabled ? 255 : 145));
        await this.addShopPriceButton(slot, 'BuyRemove', price, 0, -70, onBuy, enabled);
    }

    private async makeShopBackButton(parent: Node, onClick: () => void): Promise<void> {
        const btn = new Node('ShopBackButton');
        parent.addChild(btn);
        btn.setPosition(-760, -326, 0);
        const ut = btn.addComponent(UITransform);
        ut.setContentSize(220, 98);
        await this.addSpriteFromPath(btn, 'BackButtonArt', SHOP_BACK_BUTTON, 220, 98, 0, 0);
        await this.addSpriteFromPath(btn, 'BackArrowArt', SHOP_BACK_ARROW, 82, 82, -36, 0);
        btn.on(Node.EventType.TOUCH_END, onClick, this);
    }

    private async addShopPriceButton(parent: Node, name: string, price: number, x: number, y: number, onBuy: () => boolean, enabled: boolean): Promise<void> {
        const soldLabel = this.addModalLabel(parent, `${name}Sold`, 80, 28, x, y, 17, new Color(190, 198, 206, 255), Label.HorizontalAlign.CENTER);
        soldLabel.string = '售罄';
        const sold = soldLabel.node;
        sold.active = !enabled;
        const btn = new Node(name);
        parent.addChild(btn);
        btn.setPosition(x, y, 0);
        const ut = btn.addComponent(UITransform);
        ut.setContentSize(86, 34);
        await this.addSpriteFromPath(btn, 'GoldIcon', SHOP_GOLD_ICON, 27, 27, -23, 0, new Color(255, 255, 255, enabled ? 255 : 140));
        const lb = this.addModalLabel(btn, 'Price', 58, 30, 14, 0, 19, enabled ? new Color(255, 226, 114, 255) : new Color(170, 176, 184, 255), Label.HorizontalAlign.LEFT);
        lb.string = `${price}`;
        btn.active = enabled;
        if (enabled) {
            btn.on(Node.EventType.TOUCH_END, () => {
                if (onBuy()) {
                    btn.active = false;
                    sold.active = true;
                }
            }, this);
        }
    }

    private createModal(name: string, title: string, subtitle: string): { root: Node; panel: Node } {
        this.closeModal();
        const vs = view.getVisibleSize();
        const root = new Node(`${name}Overlay`);
        this.node.addChild(root);
        root.setSiblingIndex(this.node.children.length - 1);
        const rUt = root.addComponent(UITransform);
        rUt.setContentSize(vs.width, vs.height);
        root.addComponent(BlockInputEvents);
        const shade = root.addComponent(Graphics);
        shade.fillColor = new Color(0, 0, 0, 150);
        shade.rect(-vs.width * 0.5, -vs.height * 0.5, vs.width, vs.height);
        shade.fill();
        root.on(Node.EventType.TOUCH_START, () => {}, this);

        const panel = new Node(name);
        root.addChild(panel);
        const pUt = panel.addComponent(UITransform);
        pUt.setContentSize(840, 520);
        const pg = panel.addComponent(Graphics);
        paintRoundRect(pg, 840, 520, new Color(20, 25, 36, 248), new Color(214, 176, 96, 255), 3);

        this.addModalLabel(panel, 'Title', 760, 44, 0, 214, 34, new Color(255, 220, 128, 255), Label.HorizontalAlign.CENTER).string = title;
        this.addModalLabel(panel, 'Subtitle', 760, 32, 0, 174, 18, new Color(210, 220, 232, 255), Label.HorizontalAlign.CENTER).string = subtitle;
        this._modalRoot = root;
        return { root, panel };
    }

    private closeModal(): void {
        if (this._modalRoot?.isValid) {
            this._modalRoot.destroy();
        }
        this._modalRoot = null;
    }

    private makeModalButton(parent: Node, name: string, text: string, w: number, h: number, x: number, y: number, onClick: () => void, enabled: boolean): Node {
        const btn = new Node(name);
        parent.addChild(btn);
        btn.setPosition(x, y, 0);
        const ut = btn.addComponent(UITransform);
        ut.setContentSize(w, h);
        const g = btn.addComponent(Graphics);
        paintRoundRect(
            g,
            w,
            h,
            enabled ? new Color(78, 108, 138, 255) : new Color(68, 72, 82, 220),
            enabled ? new Color(170, 215, 255, 255) : new Color(118, 124, 136, 220),
        );
        const lb = this.addModalLabel(btn, 'Label', w - 20, h - 10, 0, 0, 20, enabled ? new Color(245, 250, 255, 255) : new Color(165, 172, 184, 255), Label.HorizontalAlign.CENTER);
        lb.string = text;
        if (enabled) {
            btn.on(Node.EventType.TOUCH_END, onClick, this);
        }
        return btn;
    }

    private addModalLabel(parent: Node, name: string, w: number, h: number, x: number, y: number, fontSize: number, color: Color, align: number): Label {
        const n = new Node(name);
        parent.addChild(n);
        n.setPosition(x, y, 0);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(w, h);
        const lb = n.addComponent(Label);
        lb.fontSize = fontSize;
        lb.lineHeight = Math.ceil(fontSize * 1.25);
        lb.color = color;
        lb.horizontalAlign = align;
        lb.verticalAlign = Label.VerticalAlign.CENTER;
        lb.enableWrapText = true;
        lb.overflow = Label.Overflow.CLAMP;
        return lb;
    }

    private refreshPingAndInteract(): void {
        const cur = GlobalData.instance.mapCurrentNodeId;
        const standWrap = this._wrapById[cur];
        if (standWrap && this._pingRoot) {
            this._pingRoot.removeFromParent();
            standWrap.addChild(this._pingRoot);
            this._pingRoot.setPosition(0, 62, 0);
        }

        const curNode = MAP_GRAPH[cur];
        const reachable = new Set<number>([cur, ...(curNode?.children ?? [])]);

        for (let id = 0; id < this._wrapById.length; id++) {
            const n = this._wrapById[id];
            const plate = n?.getChildByName('Plate')?.getComponent(Sprite);
            const glow = this._glowById[id];
            const ringN = n?.getChildByName('SelectRing');

            if (plate) {
                const bright = reachable.has(id);
                plate.color = bright ? new Color(255, 255, 255, 255) : new Color(125, 132, 148, 185);
            }
            if (glow) {
                if (id === cur) {
                    glow.color = new Color(255, 185, 115, 140);
                } else if (reachable.has(id)) {
                    glow.color = new Color(255, 200, 130, 95);
                } else {
                    glow.color = new Color(255, 175, 110, 0);
                }
            }
            if (ringN) {
                ringN.active = id === cur;
            }
        }
    }

    private refreshRunHud(): void {
        const cur = GlobalData.instance.mapCurrentNodeId;
        const floor = MAP_GRAPH[cur]?.floor ?? 0;
        const maxF = GlobalData.instance.mapFloorCount || MAX_FLOOR + 1;
        RunHudManager.setCenterText(`地图  楼层 ${floor + 1} / ${maxF}  ·  滚轮 / 双指缩放`);
    }
}
