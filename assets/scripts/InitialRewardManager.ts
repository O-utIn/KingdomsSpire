import {
    _decorator,
    Button,
    Color,
    Component,
    director,
    Label,
    Layout,
    Node,
    Sprite,
    UITransform,
    Vec2,
} from 'cc';
import { GlobalData, CharacterPackage } from './GlobalData';
const { ccclass, property } = _decorator;

type CharRow = Pick<CharacterPackage, 'id' | 'name' | 'hp' | 'maxHp' | 'gold' | 'desc'>;
const CHAR_TABLE: CharRow[] = [
    { id: 0, name: '...', hp: 70, maxHp: 70, gold: 99, desc: '...' },
    { id: 1, name: '...', hp: 75, maxHp: 75, gold: 99, desc: '...' },
    { id: 2, name: '...', hp: 80, maxHp: 80, gold: 99, desc: '...' },
];

const START_RELICS: string[][] = [['relic_a'], ['relic_b'], ['relic_c']];

/** 与 START_RELICS 一一对应，用于 Neow 式三选一展示 */
const OPTION_UI: { title: string; desc: string }[] = [
    { title: '能量核心', desc: '战斗开始时获得 1 点能量。' },
    { title: '灵体羽翼', desc: '每场战斗首次受到伤害时免疫。' },
    { title: '黄金玫瑰', desc: '拾取金币时额外回复 3 点生命。' },
];

const ROW_BG_NORMAL = new Color(34, 40, 52, 255);
const ROW_BG_HOVER = new Color(52, 88, 108, 255);

@ccclass('InitialRewardManager')
export class InitialRewardManager extends Component {
    @property({ type: [Button] })
    myButtons: Button[] = [];

    private _rowSprites: Sprite[] = [];
    private _hoverIndex = -1;
    private _setupDone = false;

    onLoad() {
        // 晚一帧再写 UI，避免与 Layout 同一帧抢顺序；运行后才会执行（编辑器静态场景里不会跑）
        this.scheduleOnce(() => this.setupRewardRows(), 0);
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
            const ui = OPTION_UI[index];
            if (ui) {
                this.applyOptionCopy(btn, ui);
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

    private applyOptionCopy(btn: Button, ui: { title: string; desc: string }): void {
        const titleLb = this.ensureTitleLabel(btn.node);
        titleLb.string = ui.title;
        titleLb.enableOutline = true;
        titleLb.outlineColor = new Color(20, 16, 8, 220);
        titleLb.outlineWidth = 2;

        const descNode = btn.node.getChildByName('Label');
        const descLb = descNode?.getComponent(Label);
        if (descLb) {
            descLb.string = ui.desc;
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
                descNode.setPosition(-248, -18, 0);
            }
        }
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
            n.setPosition(-248, 14, 0);
            return lb;
        }
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
        director.loadScene('PartnerStage');
    }

    private onPick(index: number): void {
        GlobalData.instance.initialRewardChoiceIndex = index;

        const charId = GlobalData.instance.selectedCharId;
        const row = CHAR_TABLE[charId] ?? CHAR_TABLE[0];
        const relics = START_RELICS[index] ?? [];

        GlobalData.instance.selectedChar = {
            id: row.id,
            name: row.name,
            hp: row.hp,
            maxHp: row.maxHp,
            gold: row.gold,
            relics: [...relics],
            desc: row.desc,
        };
        console.log('选了第几个:', index);
        this.goNext();
    }
}
