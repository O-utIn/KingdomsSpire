import {
    _decorator,
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
        } else if (next && next.kind === 'event') {
            // 进入事件房间（兴趣点）
            director.loadScene(SCENE_EVENT, (err) => {
                if (err) {
                    console.error('[MapScreenManager] 进入事件场景失败（请确认构建已包含 Event）', err);
                }
            });
        }
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
