export interface CharacterPackage {
    id: number;
    name: string;
    hp: number;
    maxHp: number;
    gold: number;
    relics: string[];
    desc: string;
}

export class GlobalData {
    private static _instance: GlobalData;
    public static get instance() {
        if (!this._instance) this._instance = new GlobalData();
        return this._instance;
    }

    public selectedCharId: number = 0;
    public static difficulty: number = 1; // 保持你之前的静态变量
    public selectedChar: CharacterPackage | null = null; 
}