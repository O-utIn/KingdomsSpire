export interface CharacterPackage {
    id: number;
    name: string;
    hp: number;
    maxHp: number;
    gold: number;
    relics: string[];
    desc: string;
}

export type CombatEncounterKind = '' | 'monster' | 'elite' | 'boss';

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
    public deckCount: number = 17;
    public runHudCenterText: string = '';

    /** 地图进入战斗前写入，战斗场景用它决定怪物组和奖励 */
    public pendingEncounterKind: CombatEncounterKind = '';
    public pendingEncounterNodeId: number = -1;

    /** 当前站立的地图节点 id（与 MapScreenManager 内图数据一致） */
    public mapCurrentNodeId: number = 0;
    /** 从出生点到当前节点经过的节点 id 序列（含起点） */
    public mapPathNodeIds: number[] = [0];
    /** 地图总层数（最顶层 floor + 1），HUD 用 */
    public mapFloorCount: number = 0;

    public resetMapProgress(): void {
        this.mapCurrentNodeId = 0;
        this.mapPathNodeIds = [0];
        this.mapFloorCount = 0;
        this.pendingEncounterKind = '';
        this.pendingEncounterNodeId = -1;
        this.deckCount = 17;
        this.runHudCenterText = '';
    }

    public prepareEncounter(kind: CombatEncounterKind, nodeId: number): void {
        this.pendingEncounterKind = kind;
        this.pendingEncounterNodeId = nodeId;
    }

    public clearPendingEncounter(): void {
        this.pendingEncounterKind = '';
        this.pendingEncounterNodeId = -1;
    }

    public setRunHudCenterText(text: string): void {
        this.runHudCenterText = text;
    }
}
