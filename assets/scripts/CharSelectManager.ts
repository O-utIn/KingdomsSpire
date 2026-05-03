import { _decorator, Component, Node, Label, Sprite, director, resources, SpriteFrame, Toggle, tween, UIOpacity, game } from 'cc';
import { GlobalData } from './GlobalData';
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
    
    // 角色列表（按照要求顺序：0静默, 1故障, 2铁甲）
    private charList: CharacterInfo[] = [
        { 
            name: "静默猎手", 
            hp: 70, gold: 99, 
            desc: "来自雾地的致命女猎手，擅长毒素与爆发。", 
            artPath: "textures/chars/images" 
        },
        { 
            name: "故障机器人", 
            hp: 75, gold: 99, 
            desc: "产生了自我意识，操控能量球进行战斗。", 
            artPath: "textures/chars/moj"    
        },
        { 
            name: "铁甲卫士", 
            hp: 80, gold: 99, 
            desc: "出卖灵魂，挥舞恶魔之剑的战士。", 
            artPath: "textures/chars/small"  
        }
    ];

    // 阶梯难度配置 (1-3-5-7-10)
    private difficultyLevels: number[] = [1, 3, 5, 7, 10];
    private currentDiffIdx: number = 0; 

    start() {
        // 初始化默认显示
        this.currentDiffIdx = 0;
        GlobalData.instance.difficulty = this.difficultyLevels[this.currentDiffIdx];
        this.updateUI(0);
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
        resources.load(path + '/spriteFrame', SpriteFrame, (err, sf) => {
            if (err) {
                console.error("[加载失败] 请检查资源:", path, err);
                return;
            }
            this.bigArtSprite.spriteFrame = sf;
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
        director.loadScene("MainMenu");
    }

    onConfirmClick() {
        console.log(`[确认选择] 角色ID: ${GlobalData.instance.selectedCharId}, 难度: ${GlobalData.instance.difficulty}`);
        director.loadScene("InitialReward"); 
    }
}