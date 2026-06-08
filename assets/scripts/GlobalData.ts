import type { RelicId } from './relics/RelicDef';
import type { CardId } from './cards/CardDef';

export interface CharacterPackage {
    id: number;
    name: string;
    hp: number;
    maxHp: number;
    gold: number;
    relics: RelicId[];
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
    public deckIds: CardId[] = [];
    public potionIds: string[] = [];
    public shopRemovalCount: number = 0;
    public runHudCenterText: string = '';
    public runStartedAtMs: number = 0;
    public runEndedAtMs: number = 0;

    /** 地图进入战斗前写入，战斗场景用它决定怪物组和奖励 */
    public pendingEncounterKind: CombatEncounterKind = '';
    public pendingEncounterNodeId: number = -1;

    /** 当前站立的地图节点 id（与 MapScreenManager 内图数据一致） */
    public mapCurrentNodeId: number = 0;
    /** 从出生点到当前节点经过的节点 id 序列（含起点） */
    public mapPathNodeIds: number[] = [0];
    /** 地图总层数（最顶层 floor + 1），HUD 用 */
    public mapFloorCount: number = 0;
    /** 已结算过的非战斗节点，避免反复刷火堆/商店 */
    public resolvedMapNodeIds: number[] = [];

    public resetMapProgress(): void {
        this.mapCurrentNodeId = 0;
        this.mapPathNodeIds = [0];
        this.mapFloorCount = 0;
        this.pendingEncounterKind = '';
        this.pendingEncounterNodeId = -1;
        this.deckIds = [];
        this.deckCount = 17;
        this.potionIds = [];
        this.shopRemovalCount = 0;
        this.resolvedMapNodeIds = [];
        this.runHudCenterText = '';
        this.startRunTimer();
    }

    public startRunTimer(): void {
        this.runStartedAtMs = Date.now();
        this.runEndedAtMs = 0;
    }

    public finishRunTimer(): void {
        if (this.runStartedAtMs > 0 && this.runEndedAtMs <= 0) {
            this.runEndedAtMs = Date.now();
        }
    }

    public getRunElapsedMs(): number {
        if (this.runStartedAtMs <= 0) {
            return 0;
        }
        return Math.max(0, (this.runEndedAtMs || Date.now()) - this.runStartedAtMs);
    }

    public getRunElapsedText(): string {
        const totalSeconds = Math.floor(this.getRunElapsedMs() / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const pad = (value: number) => value.toString().padStart(2, '0');
        return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
    }

    public isFinalMapEncounter(nodeId = this.pendingEncounterNodeId): boolean {
        return nodeId >= 0
            && nodeId === this.mapCurrentNodeId
            && this.mapPathNodeIds.length > 1
            && this.pendingEncounterKind === 'boss';
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

    public isMapNodeResolved(nodeId: number): boolean {
        return this.resolvedMapNodeIds.indexOf(nodeId) >= 0;
    }

    public markMapNodeResolved(nodeId: number): void {
        if (!this.isMapNodeResolved(nodeId)) {
            this.resolvedMapNodeIds.push(nodeId);
        }
    }
}
