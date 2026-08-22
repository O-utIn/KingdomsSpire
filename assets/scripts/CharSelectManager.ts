import { _decorator, Color, Component, Label, Node, Sprite, Toggle, tween, UIOpacity, UITransform } from 'cc';
import { GlobalData } from './GlobalData';
import { loadSceneFast, loadSpriteFrame, warmSceneAssets } from './AssetLoader';
import { getRelicDef, NEOW_STARTER_RELIC_IDS } from './relics/RelicDef';
const { ccclass, property } = _decorator;

/*
GlobalData.ts已经有全局数据类了
export class GlobalData {
    public static selectedCharId: number = 0; 
    public static difficulty: number = 1;     
}
*/

interface CharacterInfo {
    name: string;
    hp: number;
    gold: number;
    desc: string;
    artPath: string; 
}

@ccclass('CharSelectManager')
export class CharSelectManager extends Component {

    // --- UI 节点绑定 ---
    @property(Label) charNameLabel: Label = null!;
    @property(Label) charDescLabel: Label = null!;
    @property(Label) levelLabel: Label = null!;
    @property(Label) statsLabel: Label = null!;      
    @property(Sprite) bigArtSprite: Sprite = null!;   
    @property(UIOpacity) bigArtOpacity: UIOpacity = null!; 

    // --- 核心配置数据 ---
    
    // 角色列表（按照要求顺序：0祭酒, 1故障, 2铁甲）
    private charList: CharacterInfo[] = [
        { 
            name: "祭酒", 
            hp: 70, gold: 99, 
            desc: "一个被诅咒缠身的凡人，拥有强大的暗影力量。", 
            artPath: "textures/chars/character_background" 
        },
        { 
            name: "故障机器人", 
            hp: 75, gold: 99, 
            desc: "产生了自我意识，操控能量球进行战斗。", 
            artPath: "textures/chars/moj_background"    
        },
        { 
            name: "铁甲卫士", 
            hp: 80, gold: 99, 
            desc: "出卖灵魂，挥舞恶魔之剑的战士。", 
            artPath: "textures/chars/samll_background"  
        }
    ];

    // 阶梯难度配置 (1-3-5-7-10)
    private difficultyLevels: number[] = [1, 3, 5, 7, 10];
    private currentDiffIdx: number = 0; 

    start() {
        // 初始化默认显示
        this.currentDiffIdx = 0;
        GlobalData.instance.difficulty = this.difficultyLevels[this.currentDiffIdx];
        this.applyDifficultyArrowLabels();
        this.updateUI(0);
        this.scheduleOnce(() => {
            void warmSceneAssets('InitialReward', [
                'textures/background/bg1',
                ...NEOW_STARTER_RELIC_IDS
                    .map((id) => getRelicDef(id)?.iconPath)
                    .filter((path): path is string => !!path),
            ]);
        }, 0.05);
    }

    private applyDifficultyArrowLabels(): void {
        this.ensureArrowLabel(this.findNodeDeep(this.node, 'Btn_Prev'), '<');
        this.ensureArrowLabel(this.findNodeDeep(this.node, 'Btn_Next'), '>');
    }

    private findNodeDeep(root: Node, name: string): Node | null {
        if (root.name === name) {
            return root;
        }
        for (const child of root.children) {
            const found = this.findNodeDeep(child, name);
            if (found) {
                return found;
            }
        }
        return null;
    }

    private ensureArrowLabel(button: Node | null, text: string): void {
        if (!button) {
            return;
        }
        let labelNode = button.getChildByName('ArrowLabel');
        if (!labelNode) {
            labelNode = new Node('ArrowLabel');
            button.addChild(labelNode);
            labelNode.layer = button.layer;
            labelNode.addComponent(UITransform).setContentSize(100, 40);
            const label = labelNode.addComponent(Label);
            label.horizontalAlign = Label.HorizontalAlign.CENTER;
            label.verticalAlign = Label.VerticalAlign.CENTER;
            label.color = new Color(35, 24, 0, 255);
            label.enableOutline = true;
            label.outlineColor = new Color(255, 255, 255, 230);
            label.outlineWidth = 2;
        }
        labelNode.layer = button.layer;
        labelNode.setSiblingIndex(button.children.length - 1);
        labelNode.setPosition(0, 0, 0);
        const label = labelNode.getComponent(Label);
        if (label) {
            label.string = text;
            label.fontSize = 34;
            label.lineHeight = 40;
        }
    }

    /**
     * 角色切换逻辑
     */
    onCharToggle(toggle: Toggle, customData: string) {
        if (!toggle.isChecked) return; 

        const id = parseInt(customData);
        GlobalData.instance.selectedCharId = id;
        this.updateUI(id);
    }

    private updateUI(id: number) {
        const data = this.charList[id];
        if (!data) return;

        this.charNameLabel.string = data.name;
        this.charDescLabel.string = data.desc;
        this.statsLabel.string = `❤️ ${data.hp}/${data.hp}   💰 ${data.gold}`;
        this.levelLabel.string = GlobalData.instance.difficulty.toString();

        if (this.bigArtOpacity) {
            tween(this.bigArtOpacity)
                .to(0.1, { opacity: 0 })
                .call(() => { this.loadResourceArt(data.artPath); })
                .to(0.3, { opacity: 255 })
                .start();
        } else {
            this.loadResourceArt(data.artPath);
        }
    }

    private loadResourceArt(path: string) {
        void loadSpriteFrame(path).then((sf) => {
            if (sf && this.bigArtSprite?.node.isValid) {
                this.bigArtSprite.spriteFrame = sf;
            }
        });
    }

    /**
     * 循环式难度切换 (1-3-5-7-10-1...)
     * delta 为 "1" 或 "-1"
     */
    onDifficultyChange(event: any, delta: string) {
        const step = parseInt(delta);
        let nextIdx = this.currentDiffIdx + step;

        const len = this.difficultyLevels.length;

        // --- 核心修改：循环逻辑 ---
        if (nextIdx >= len) {
            nextIdx = 0; // 超过最大值，回到开头
        } else if (nextIdx < 0) {
            nextIdx = len - 1; // 小于最小值，回到末尾
        }

        this.currentDiffIdx = nextIdx;
        GlobalData.instance.difficulty = this.difficultyLevels[this.currentDiffIdx];
        
        this.levelLabel.string = GlobalData.instance.difficulty.toString();
        console.log("循环切换难度值:", GlobalData.instance.difficulty);
    }

    onBackClick() {
        loadSceneFast('MainMenu');
    }

    onConfirmClick() {
        console.log(`[确认选择] 角色ID: ${GlobalData.instance.selectedCharId}, 难度: ${GlobalData.instance.difficulty}`);
        loadSceneFast('InitialReward');
    }
}
