import {
    _decorator,
    Component,
    director,
    Label,
    Node,
    Sprite,
    SpriteFrame,
    Button,
    BlockInputEvents,
    resources,
    UITransform,
    Color,
    Graphics,
    Layers,
    Widget,
    view,
} from 'cc';
import { SCENE_BATTLE } from '../GameConfig';
import { GlobalAudioManager } from '../GlobalAudioManager';
import { GlobalData } from '../GlobalData';
import { RunHudManager } from '../RunHudManager';
import type { CardId } from '../cards/CardDef';
import { getCardDef } from '../cards/CardDef';
import type { RelicId } from '../relics/RelicDef';
import { getRelicDef } from '../relics/RelicDef';
import { loadGameMapScene } from '../SceneLoader';
import { EventDef, EventChoice, EventResult } from './EventDef';
import { EVENT_POOL } from './EventPool';

const { ccclass } = _decorator;

/** 事件房间管理器 - 兴趣点系统 */
@ccclass('EventManager')
export class EventManager extends Component {
    private _titleLabel: Label | null = null;
    private _descLabel: Label | null = null;
    private _imageSprite: Sprite | null = null;
    private _choicesContainer: Node | null = null;
    private _currentEvent: EventDef | null = null;

    private readonly _eventCardRewards: CardId[] = ['scheme', 'survivor', 'blood_rite', 'bridge_break'];
    private readonly _eventRelicRewards: RelicId[] = ['neow_energy_core', 'neow_spirit_wing', 'neow_golden_rose'];

    onLoad(): void {
        GlobalAudioManager.playRunBgm();
        RunHudManager.startRun();
        RunHudManager.setCenterText('事件  |  选择');
        this.buildUI();
    }

    start(): void {
        // 随机选择一个事件
        this._currentEvent = this.selectRandomEvent();
        this.showEvent(this._currentEvent);
    }

    /** 构建事件房间UI */
    private buildUI(): void {
        const visible = view.getVisibleSize();
        const width = Math.max(visible.width, 1);
        const height = Math.max(visible.height, 1);

        // 将脚本根节点强制设为全屏UI参考系，避免面板受场景原始坐标影响。
        const rootUt = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        rootUt.setContentSize(width, height);
        rootUt.anchorPoint.set(0.5, 0.5);

        const rootWidget = this.node.getComponent(Widget) ?? this.node.addComponent(Widget);
        rootWidget.isAlignLeft = true;
        rootWidget.isAlignRight = true;
        rootWidget.isAlignTop = true;
        rootWidget.isAlignBottom = true;
        rootWidget.left = 0;
        rootWidget.right = 0;
        rootWidget.top = 0;
        rootWidget.bottom = 0;
        rootWidget.updateAlignment();

        // 背景遮罩
        const mask = new Node('Mask');
        this.node.addChild(mask);
        mask.layer = Layers.Enum.UI_2D;
        const maskUt = mask.addComponent(UITransform);
        maskUt.setContentSize(width, height);
        const maskG = mask.addComponent(Graphics);
        maskG.fillColor = new Color(0, 0, 0, 200);
        maskG.rect(-width / 2, -height / 2, width, height);
        maskG.fill();

        // 事件面板
        const panel = new Node('EventPanel');
        this.node.addChild(panel);
        panel.layer = Layers.Enum.UI_2D;
        const panelUt = panel.addComponent(UITransform);
        panelUt.setContentSize(980, 560);
        const panelWidget = panel.addComponent(Widget);
        panelWidget.isAlignHorizontalCenter = true;
        panelWidget.isAlignVerticalCenter = true;
        panelWidget.horizontalCenter = 0;
        panelWidget.verticalCenter = 0;
        panel.setPosition(0, 0, 0);
        panelWidget.updateAlignment();

        // 面板背景
        const bg = new Node('PanelBg');
        panel.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(980, 560);
        const bgG = bg.addComponent(Graphics);
        bgG.fillColor = new Color(30, 35, 45, 245);
        bgG.roundRect(-490, -280, 980, 560, 16);
        bgG.fill();
        bgG.lineWidth = 3;
        bgG.strokeColor = new Color(120, 130, 150, 255);
        bgG.roundRect(-490, -280, 980, 560, 16);
        bgG.stroke();

        // 标题
        const titleNode = new Node('Title');
        panel.addChild(titleNode);
        titleNode.layer = Layers.Enum.UI_2D;
        titleNode.setPosition(0, 232, 0);
        const titleUt = titleNode.addComponent(UITransform);
        titleUt.setContentSize(900, 60);
        this._titleLabel = titleNode.addComponent(Label);
        this._titleLabel.fontSize = 42;
        this._titleLabel.isBold = true;
        this._titleLabel.color = new Color(230, 210, 160, 255);
        this._titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

        // 描述文本
        const descNode = new Node('Description');
        panel.addChild(descNode);
        descNode.layer = Layers.Enum.UI_2D;
        descNode.setPosition(130, 100, 0);
        const descUt = descNode.addComponent(UITransform);
        descUt.setContentSize(560, 220);
        this._descLabel = descNode.addComponent(Label);
        this._descLabel.fontSize = 25;
        this._descLabel.lineHeight = 32;
        this._descLabel.color = new Color(200, 205, 215, 255);
        this._descLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this._descLabel.verticalAlign = Label.VerticalAlign.TOP;
        this._descLabel.enableWrapText = true;
        this._descLabel.overflow = Label.Overflow.CLAMP;

        // 图片区域（预留）
        const imageNode = new Node('EventImage');
        panel.addChild(imageNode);
        imageNode.layer = Layers.Enum.UI_2D;
        imageNode.setPosition(-320, 72, 0);
        const imageUt = imageNode.addComponent(UITransform);
        imageUt.setContentSize(260, 260);
        this._imageSprite = imageNode.addComponent(Sprite);
        this._imageSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._imageSprite.color = new Color(80, 85, 95, 255);

        // 选项容器
        this._choicesContainer = new Node('ChoicesContainer');
        panel.addChild(this._choicesContainer);
        this._choicesContainer.layer = Layers.Enum.UI_2D;
        this._choicesContainer.setPosition(130, -140, 0);
    }

    /** 显示事件内容 */
    private showEvent(event: EventDef): void {
        if (!event) return;

        if (this._titleLabel) {
            this._titleLabel.string = event.title;
        }
        if (this._descLabel) {
            this._descLabel.string = event.description;
        }

        // 加载图片
        if (event.image && this._imageSprite) {
            this.loadEventImage(event.image);
        }

        // 创建选项按钮
        this.createChoiceButtons(event.choices);
    }

    /** 加载事件图片 */
    private loadEventImage(path: string): void {
        const fullPath = path.endsWith('/spriteFrame') ? path : `${path}/spriteFrame`;
        resources.load(fullPath, SpriteFrame, (err, sf) => {
            if (!err && this._imageSprite) {
                this._imageSprite.spriteFrame = sf;
                this._imageSprite.color = new Color(255, 255, 255, 255);
            }
        });
    }

    /** 创建选项按钮 */
    private createChoiceButtons(choices: EventChoice[]): void {
        if (!this._choicesContainer) return;

        // 清除旧按钮
        this._choicesContainer.removeAllChildren();

        const buttonWidth = 560;
        const buttonHeight = 56;
        const spacing = 16;
        const startY = (choices.length - 1) * (buttonHeight + spacing) / 2;

        choices.forEach((choice, index) => {
            const btn = this.createChoiceButton(choice, buttonWidth, buttonHeight);
            btn.setPosition(0, startY - index * (buttonHeight + spacing), 0);
            this._choicesContainer!.addChild(btn);
        });
    }

    /** 创建单个选项按钮 */
    private createChoiceButton(choice: EventChoice, width: number, height: number): Node {
        const btnNode = new Node(`Choice_${choice.text}`);
        btnNode.layer = Layers.Enum.UI_2D;

        const btnUt = btnNode.addComponent(UITransform);
        btnUt.setContentSize(width, height);

        // 按钮背景
        const bg = new Node('Bg');
        btnNode.addChild(bg);
        bg.layer = Layers.Enum.UI_2D;
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(width, height);
        const bgG = bg.addComponent(Graphics);
        bgG.fillColor = new Color(60, 70, 90, 230);
        bgG.roundRect(-width / 2, -height / 2, width, height, 8);
        bgG.fill();

        // 按钮文本
        const text = new Node('Text');
        btnNode.addChild(text);
        text.layer = Layers.Enum.UI_2D;
        const textUt = text.addComponent(UITransform);
        textUt.setContentSize(width - 40, height - 20);
        const label = text.addComponent(Label);
        label.string = choice.text;
        label.fontSize = 20;
        label.color = new Color(220, 225, 235, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;

        // 添加按钮组件
        const button = btnNode.addComponent(Button);
        button.target = bg;

        // 点击事件
        btnNode.on(Node.EventType.TOUCH_END, () => {
            this.onChoiceSelected(choice);
        }, this);

        // 悬停效果
        btnNode.on(Node.EventType.MOUSE_ENTER, () => {
            bgG.clear();
            bgG.fillColor = new Color(80, 95, 120, 230);
            bgG.roundRect(-width / 2, -height / 2, width, height, 8);
            bgG.fill();
        }, this);

        btnNode.on(Node.EventType.MOUSE_LEAVE, () => {
            bgG.clear();
            bgG.fillColor = new Color(60, 70, 90, 230);
            bgG.roundRect(-width / 2, -height / 2, width, height, 8);
            bgG.fill();
        }, this);

        return btnNode;
    }

    /** 处理选项选择 */
    private onChoiceSelected(choice: EventChoice): void {
        const result = choice.result;

        // 应用结果
        this.applyResult(result);

        this.showResultFeedback(result, () => {
            if (result.type === 'combat') {
                GlobalData.instance.prepareEncounter('monster', -1);
                director.loadScene(SCENE_BATTLE);
                return;
            }
            this.returnToMap();
        });
    }

    /** 应用事件结果到玩家状态 */
    private applyResult(result: EventResult): void {
        const gd = GlobalData.instance;
        const char = gd.selectedChar;
        if (!char) return;

        switch (result.type) {
            case 'gain_gold':
                char.gold += result.value ?? 0;
                break;
            case 'lose_gold':
                char.gold = Math.max(0, char.gold - (result.value ?? 0));
                break;
            case 'gain_hp':
                char.hp = Math.min(char.maxHp, char.hp + (result.value ?? 0));
                break;
            case 'lose_hp':
                char.hp = Math.max(0, char.hp - (result.value ?? 0));
                break;
            case 'gain_max_hp':
                char.maxHp += result.value ?? 0;
                char.hp += result.value ?? 0;
                break;
            case 'gain_card':
                this.gainEventCards(result);
                break;
            case 'remove_card':
                this.removeEventCards(result);
                break;
            case 'gain_relic':
                this.gainEventRelic(result);
                break;
        }
        gd.deckCount = gd.deckIds.length || gd.deckCount;
        RunHudManager.startRun();

        console.log(`[Event] ${result.description}`);
    }

    private showResultFeedback(result: EventResult, onDone: () => void): void {
        const visible = view.getVisibleSize();
        const overlay = new Node('EventResultOverlay');
        this.node.addChild(overlay);
        overlay.layer = Layers.Enum.UI_2D;
        overlay.addComponent(BlockInputEvents);
        overlay.addComponent(UITransform).setContentSize(visible.width, visible.height);
        const shade = overlay.addComponent(Graphics);
        shade.fillColor = new Color(0, 0, 0, 150);
        shade.rect(-visible.width / 2, -visible.height / 2, visible.width, visible.height);
        shade.fill();

        const panel = new Node('EventResultPanel');
        overlay.addChild(panel);
        panel.layer = Layers.Enum.UI_2D;
        panel.addComponent(UITransform).setContentSize(720, 340);
        const bg = panel.addComponent(Graphics);
        bg.fillColor = new Color(26, 32, 44, 252);
        bg.roundRect(-360, -170, 720, 340, 12);
        bg.fill();
        bg.lineWidth = 3;
        bg.strokeColor = new Color(214, 176, 96, 255);
        bg.roundRect(-360, -170, 720, 340, 12);
        bg.stroke();

        const title = new Node('Title');
        panel.addChild(title);
        title.layer = Layers.Enum.UI_2D;
        title.setPosition(0, 112, 0);
        title.addComponent(UITransform).setContentSize(640, 42);
        const titleLabel = title.addComponent(Label);
        titleLabel.string = '事件结果';
        titleLabel.fontSize = 30;
        titleLabel.color = new Color(255, 220, 128, 255);
        titleLabel.horizontalAlign = Label.HorizontalAlign.CENTER;

        const body = new Node('Body');
        panel.addChild(body);
        body.layer = Layers.Enum.UI_2D;
        body.setPosition(0, 18, 0);
        body.addComponent(UITransform).setContentSize(620, 126);
        const bodyLabel = body.addComponent(Label);
        bodyLabel.string = this.describeResult(result);
        bodyLabel.fontSize = 20;
        bodyLabel.lineHeight = 28;
        bodyLabel.color = new Color(224, 232, 244, 255);
        bodyLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        bodyLabel.verticalAlign = Label.VerticalAlign.CENTER;
        bodyLabel.enableWrapText = true;
        bodyLabel.overflow = Label.Overflow.SHRINK;

        const btn = this.createChoiceButton({ text: '确定', result }, 180, 56);
        panel.addChild(btn);
        btn.setPosition(0, -122, 0);
        btn.off(Node.EventType.TOUCH_END);
        btn.on(Node.EventType.TOUCH_END, () => {
            overlay.destroy();
            onDone();
        }, this);
    }

    private describeResult(result: EventResult): string {
        if (result.description) {
            return result.description;
        }
        const value = result.value ?? 0;
        const data = result.data ? ` ${result.data}` : '';
        switch (result.type) {
            case 'gain_gold': return `获得 ${value} 金币`;
            case 'lose_gold': return `失去 ${value} 金币`;
            case 'gain_hp': return `回复 ${value} 点生命`;
            case 'lose_hp': return `失去 ${value} 点生命`;
            case 'gain_max_hp': return `最大生命提高 ${value}`;
            case 'gain_card': return `获得 ${value || 1} 张卡牌${data}`;
            case 'remove_card': return `移除 ${value || 1} 张卡牌${data}`;
            case 'gain_relic': return `获得遗物${data}`;
            case 'combat': return '遭遇敌人，确认后进入战斗';
            default: return '事件已响应';
        }
    }

    private gainEventCards(result: EventResult): void {
        const gd = GlobalData.instance;
        const count = Math.max(1, result.value ?? 1);
        const preferred = result.data && getCardDef(result.data) ? result.data : '';
        for (let i = 0; i < count; i++) {
            const id = (preferred || this._eventCardRewards[(gd.deckIds.length + i) % this._eventCardRewards.length]) as CardId;
            if (getCardDef(id)) {
                gd.deckIds.push(id);
            }
        }
        gd.deckCount = gd.deckIds.length;
    }

    private removeEventCards(result: EventResult): void {
        const gd = GlobalData.instance;
        const count = Math.max(1, result.value ?? 1);
        for (let i = 0; i < count && gd.deckIds.length > 0; i++) {
            const preferred = result.data ? gd.deckIds.indexOf(result.data) : -1;
            const strike = gd.deckIds.indexOf('strike');
            const idx = preferred >= 0 ? preferred : strike >= 0 ? strike : 0;
            gd.deckIds.splice(idx, 1);
        }
        gd.deckCount = gd.deckIds.length;
    }

    private gainEventRelic(result: EventResult): void {
        const char = GlobalData.instance.selectedChar;
        if (!char) {
            return;
        }
        const preferred = result.data && getRelicDef(result.data) ? result.data : '';
        const fallback = this._eventRelicRewards.find((id) => !char.relics.includes(id));
        const id = (preferred || fallback) as RelicId | '';
        if (id && getRelicDef(id) && !char.relics.includes(id)) {
            char.relics.push(id);
        }
    }

    /** 返回地图场景 */
    private returnToMap(): void {
        loadGameMapScene();
    }

    /** 随机选择事件 */
    private selectRandomEvent(): EventDef {
        // 根据稀有度权重选择
        const totalWeight = EVENT_POOL.reduce((sum, e) => {
            return sum + (e.rarity ? this.getRarityWeight(e.rarity) : 60);
        }, 0);

        let random = Math.random() * totalWeight;

        for (const event of EVENT_POOL) {
            const weight = event.rarity ? this.getRarityWeight(event.rarity) : 60;
            random -= weight;
            if (random <= 0) {
                return event;
            }
        }

        return EVENT_POOL[0];
    }

    /** 获取稀有度权重 */
    private getRarityWeight(rarity: string): number {
        const weights: Record<string, number> = {
            common: 60,
            uncommon: 30,
            rare: 10,
        };
        return weights[rarity] ?? 60;
    }
}
