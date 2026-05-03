export interface CharacterPackage {
    id: number;
    name: string;
    hp: number;
    maxHp: number;
    gold: number;
    relics: string[];
    desc: string;
}


// 全局字段一律采用instance写法而不是static写法
export class GlobalData {
    private static _instance: GlobalData;
    public static get instance() {
        if (!this._instance) this._instance = new GlobalData();
        return this._instance;
    }

    public selectedCharId: number = 0;
    public difficulty: number = 1; 
    public selectedChar: CharacterPackage | null = null; 
    public initialRewardChoiceIndex: number = -1;
}