import { _decorator, SpriteFrame } from 'cc';

// 角色数据接口
export interface CharData {
    id: number;
    name: string;
    hp: number;
    gold: number;
    desc: string;
    artPath: string; // 大立绘资源路径 (resources目录下)
}

// 全局静态数据，用于跨场景传递选择结果
export class GlobalData {
    public static selectedCharId: number = 0;
    public static difficulty: number = 1; // 1-20级难度
}

// 模拟角色配置表
export const CHAR_LIST: CharData[] = [
    { id: 0, name: "亡灵契约师", hp: 66, gold: 99, desc: "一位出生在尖塔的巫妖，正在寻求复仇。\n战斗中会召唤她可靠的左手奥斯提。", artPath: "textures/chars/necromancer" },
    { id: 1, name: "铁甲卫士", hp: 80, gold: 99, desc: "出卖灵魂，挥舞恶魔之剑的战士。", artPath: "textures/chars/ironclad" },
];