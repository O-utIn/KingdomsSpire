import { _decorator, SpriteFrame } from 'cc';

/** 与 `assets/scenes/GameMap.scene` 资源名一致（不含扩展名） */
export const SCENE_GAME_MAP = 'GameMap';

/** 与 `assets/scenes/Battle.scene` 资源名一致（不含扩展名） */
export const SCENE_BATTLE = 'Battle';

/** 与 `assets/scenes/Event.scene` 资源名一致（不含扩展名）- 事件房间（兴趣点） */
export const SCENE_EVENT = 'Event';

// 角色数据接口
export interface CharData {
    id: number;
    name: string;
    hp: number;
    gold: number;
    desc: string;
    artPath: string; // 大立绘资源路径 (resources目录下)
}
/*
export class GlobalData {
    public static selectedCharId: number = 0;
    public static difficulty: number = 1; // 1-20级难度
}
*/

// 模拟角色配置表
export const CHAR_LIST: CharData[] = [
    { id: 0, name: "亡灵契约师", hp: 66, gold: 99, desc: "一位出生在尖塔的巫妖，正在寻求复仇。\n战斗中会召唤她可靠的左手奥斯提。", artPath: "textures/chars/necromancer" },
    { id: 1, name: "铁甲卫士", hp: 80, gold: 99, desc: "出卖灵魂，挥舞恶魔之剑的战士。", artPath: "textures/chars/ironclad" },
];