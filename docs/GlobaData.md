import { _decorator } from 'cc';

/**
 * 角色详细信息结构
 */
export interface CharacterPackage {
    id: number;
    name: string;
    hp: number;
    maxHp: number;
    gold: number;
    relics: string[];  // 初始遗物/物品列表
    desc: string;
}

/**
 * 全局数据中心 (单例模式)
 * 你的任务：在点击确认时填充它
 * 伙伴的任务：在进入他的场景时读取它
 */
export class GlobalData {
    private static _instance: GlobalData;
    public static get instance() {
        if (!this._instance) this._instance = new GlobalData();
        return this._instance;
    }

    // --- 传递给伙伴的核心数据 ---
    public selectedChar: CharacterPackage | null = null; // 角色全量信息
    public difficulty: number = 1;                      // 阶梯难度 (1,3,5,7,10)
    public gameSeed: string = "";                       // (可选) 预留随机种子
}