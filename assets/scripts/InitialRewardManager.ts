import {
    _decorator,
    Button,
    Color,
    Component,
    director,
    Label,
    Layout,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
} from 'cc';
import { SCENE_GAME_MAP } from './GameConfig';
import { GlobalData, CharacterPackage } from './GlobalData';
import { MapScreenManager } from './MapScreenManager';
import { getRelicDef, getStarterRelicsForCharacter, NEOW_STARTER_RELIC_IDS } from './relics/RelicDef';
import type { RelicDef, RelicId } from './relics/RelicDef';
import { RunHudManager } from './RunHudManager';
const { ccclass, property } = _decorator;

type CharRow = Pick<CharacterPackage, 'id' | 'name' | 'hp' | 'maxHp' | 'gold' | 'desc'>;
const CHAR_TABLE: CharRow[] = [
    { id: 0, name: '静默猎手', hp: 70, maxHp: 70, gold: 99, desc: '来自雾地的致命女猎手，擅长毒素与爆发。' },
    { id: 1, name: '故障机器人', hp: 75, maxHp: 75, gold: 99, desc: '产生了自我意识，操控能量球进行战斗。' },
    { id: 2, name: '铁甲卫士', hp: 80, maxHp: 80, gold: 99, desc: '出卖灵魂，挥舞恶魔之剑的战士。' },
];

const ROW_BG_NORMAL = new Color(34, 40, 52, 255);
const ROW_BG_HOVER = new Color(52, 88, 108, 255);

function appendRelic(base: readonly RelicId[], picked: RelicId | undefined): RelicId[] {
    const out = [...base];
    if (picked && out.indexOf(picked) < 0) {
        out.push(picked);
    }
    return out;
}

@ccclass('InitialRewardManager')
export class InitialRewardManager extends Component {
    @property({ type: [Button] })
    myButtons: Button[] = [];

    private _rowSprites: Sprite[] = [];
    private _hoverIndex = -1;
    private _setupDone = false;

    onLoad() {
        this.prepareRunState();
        // 晚一帧再写 UI，避免与 Layout 同一帧抢顺序；运行后才会执行（编辑器静态场景里不会跑）
        this.scheduleOnce(() => this.setupRewardRows(), 0);
    }

    private prepareRunState(): void {
        const gd = GlobalData.instance;
        gd.resetMapProgress();

        const row = CHAR_TABLE[gd.selectedCharId] ?? CHAR_TABLE[0];
        gd.selectedChar = {
            id: row.id,
            name: row.name,
            hp: row.hp,
            maxHp: row.maxHp,
            gold: row.gold,
            relics: getStarterRelicsForCharacter(row.id),
            desc: row.desc,
        };

        RunHudManager.setCenterText('选择初始遗物');
    }

    /** 优先用 Inspector 里拖好的 `myButtons`；为空则从 ChoiceList/Layout 下自动收集 */
    private getButtons(): Button[] {
        const wired = (this.myButtons ?? []).filter((b): b is Button => !!b);
        if (wired.length > 0) {
            return wired;
        }
        const layout = this.node.getChildByName('ChoiceList')?.getChildByName('Layout');
        if (!layout) {
            return [];
        }
        const out: Button[] = [];
        for (const child of layout.children) {
            const b = child.getComponent(Button);
            if (b) {
                out.push(b);
            }
        }
        return out;
    }

    private setupRewardRows(): void {
        if (this._setupDone) {
            return;
        }
        const buttons = this.getButtons();
        if (buttons.length === 0) {
            console.warn(
                '[InitialRewardManager] 未找到按钮：请在 Canvas 的 myButtons 拖入三个 Button，或保留节点 Canvas/ChoiceList/Layout/Button*',
            );
            return;
        }
        this._setupDone = true;

        buttons.forEach((btn, index) => {
            const relicId = NEOW_STARTER_RELIC_IDS[index];
            const relic = relicId ? getRelicDef(relicId) : null;
            if (relic) {
                this.applyOptionCopy(btn, relic);
            }
            this.styleRow(btn, index);

            btn.node.on(Button.EventType.CLICK, () => {
                this.onPick(index);
            }, this);

            btn.node.on(Node.EventType.MOUSE_ENTER, () => this.setRowHover(index), this);
            btn.node.on(Node.EventType.MOUSE_LEAVE, () => this.clearRowHover(index), this);
            btn.node.on(Node.EventType.TOUCH_START, () => this.setRowHover(index), this);
            btn.node.on(Node.EventType.TOUCH_END, () => this.clearRowHover(index), this);
            btn.node.on(Node.EventType.TOUCH_CANCEL, () => this.clearRowHover(index), this);
        });

        this.applyVerticalLayout();
    }

    /** 清掉误拖产生的 x/z 偏移，交给 Layout 垂直居中排布 */
    private applyVerticalLayout(): void {
        const layoutRoot = this.node.getChildByName('ChoiceList')?.getChildByName('Layout');
        if (!layoutRoot) {
            return;
        }
        for (const c of layoutRoot.children) {
            if (c.getComponent(Button)) {
                c.setPosition(0, 0, 0);
            }
        }
        const ly = layoutRoot.getComponent(Layout);
        ly?.updateLayout(true);
    }

    private applyOptionCopy(btn: Button, relic: RelicDef): void {
        this.ensureRelicIcon(btn.node, relic);

        const titleLb = this.ensureTitleLabel(btn.node);
        titleLb.string = relic.name;
        titleLb.enableOutline = true;
        titleLb.outlineColor = new Color(20, 16, 8, 220);
        titleLb.outlineWidth = 2;

        const descNode = btn.node.getChildByName('Label');
        const descLb = descNode?.getComponent(Label);
        if (descLb) {
            descLb.string = relic.description;
            descLb.fontSize = 16;
            descLb.lineHeight = 22;
            descLb.overflow = Label.Overflow.NONE;
            descLb.enableWrapText = true;
            descLb.color = new Color(216, 224, 236, 255);
            descLb.enableOutline = true;
            descLb.outlineColor = new Color(12, 14, 20, 200);
            descLb.outlineWidth = 2;
            descLb.horizontalAlign = Label.HorizontalAlign.LEFT;
            descLb.verticalAlign = Label.VerticalAlign.CENTER;
            const dut = descNode.getComponent(UITransform);
            if (dut) {
                dut.setContentSize(500, 40);
                dut.anchorPoint = new Vec2(0, 0.5);
                descNode.setPosition(-210, -18, 0);
            }
        }
    }

    private ensureRelicIcon(parent: Node, relic: RelicDef): void {
        let n = parent.getChildByName('RelicIcon');
        if (!n) {
            n = new Node('RelicIcon');
            parent.addChild(n);
            const ut = n.addComponent(UITransform);
            ut.setContentSize(56, 56);
            n.setPosition(-286, 0, 0);
            n.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;
        }

        const sp = n.getComponent(Sprite);
        resources.load(`${relic.iconPath}/spriteFrame`, SpriteFrame, (err, sf) => {
            if (err || !sp || !sp.node.isValid) {
                if (err) {
                    console.warn(`[InitialRewardManager] 加载遗物图标失败：${relic.iconPath}`, err);
                }
                return;
            }
            sp.spriteFrame = sf;
            sp.color = Color.WHITE;
        });
    }

    private ensureTitleLabel(parent: Node): Label {
        let n = parent.getChildByName('Title');
        if (!n) {
            n = new Node('Title');
            parent.addChild(n);
            const ut = n.addComponent(UITransform);
            ut.setContentSize(500, 32);
            ut.anchorPoint = new Vec2(0, 0.5);
            const lb = n.addComponent(Label);
            lb.fontSize = 22;
            lb.lineHeight = 26;
            lb.overflow = Label.Overflow.NONE;
            lb.horizontalAlign = Label.HorizontalAlign.LEFT;
            lb.verticalAlign = Label.VerticalAlign.CENTER;
            lb.color = new Color(255, 210, 110, 255);
            lb.isBold = true;
            lb.enableOutline = true;
            lb.outlineColor = new Color(20, 16, 8, 220);
            lb.outlineWidth = 2;
            n.setPosition(-210, 14, 0);
            return lb;
        }
        const ut = n.getComponent(UITransform);
        if (ut) {
            ut.setContentSize(500, 32);
            ut.anchorPoint = new Vec2(0, 0.5);
        }
        n.setPosition(-210, 14, 0);
        return n.getComponent(Label)!;
    }

    private styleRow(btn: Button, index: number): void {
        const rowUt = btn.getComponent(UITransform);
        if (rowUt) {
            rowUt.setContentSize(680, 88);
        }

        const spr = btn.getComponent(Sprite);
        if (spr) {
            spr.color = ROW_BG_NORMAL;
            this._rowSprites[index] = spr;
        }

        // 不用 COLOR 过渡：引擎会把 hoverColor 乘到 Sprite 上，整块发灰且盖住我们自绘的悬停底色
        btn.transition = Button.Transition.NONE;
        btn.normalColor = Color.WHITE;
        btn.hoverColor = Color.WHITE;
        btn.pressedColor = new Color(220, 220, 220, 255);
    }

    private setRowHover(index: number): void {
        this._hoverIndex = index;
        this.refreshRowVisuals();
    }

    private clearRowHover(index: number): void {
        if (this._hoverIndex === index) {
            this._hoverIndex = -1;
        }
        this.refreshRowVisuals();
    }

    private refreshRowVisuals(): void {
        this._rowSprites.forEach((spr, i) => {
            if (!spr) {
                return;
            }
            const hover = i === this._hoverIndex;
            spr.color = hover ? ROW_BG_HOVER : ROW_BG_NORMAL;
        });
    }

    private goNext(): void {
        director.loadScene(SCENE_GAME_MAP, (err) => {
            if (err) {
                console.error('[InitialRewardManager] 进入地图场景失败（请确认构建里已包含 GameMap）', err);
                return;
            }
            const scene = director.getScene();
            const canvas = scene?.getChildByName('Canvas');
            if (canvas && !canvas.getComponent(MapScreenManager)) {
                canvas.addComponent(MapScreenManager);
            }
        });
    }

    private onPick(index: number): void {
        const gd = GlobalData.instance;
        gd.initialRewardChoiceIndex = index;

        const charId = gd.selectedCharId;
        const row = CHAR_TABLE[charId] ?? CHAR_TABLE[0];
        const starterRelics = getStarterRelicsForCharacter(row.id);
        const chosenRelic = NEOW_STARTER_RELIC_IDS[index];

        gd.selectedChar = {
            id: row.id,
            name: row.name,
            hp: row.hp,
            maxHp: row.maxHp,
            gold: row.gold,
            relics: appendRelic(starterRelics, chosenRelic),
            desc: row.desc,
        };
        RunHudManager.setCenterText('选择初始遗物');
        console.log('选了第几个:', index);
        this.goNext();
    }
}
