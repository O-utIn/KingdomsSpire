import type { CardId } from './CardDef';
import { getCardDef } from './CardDef';

let _nextUid = 1;

/** 战斗中一张具体牌（可有多张同 defId，uid 区分） */
export class CardInstance {
    readonly uid: number;
    private _baseDefId: CardId;
    /** 仅本回合生效的费用修正或覆盖值，回合开始清空 */
    temporaryCost: number | null = null;

    constructor(public defId: CardId, public readonly cyclesDescentOnDraw = false) {
        if (!getCardDef(defId)) {
            throw new Error(`[CardInstance] 未知卡牌 defId: ${defId}`);
        }
        this._baseDefId = defId;
        this.uid = _nextUid++;
    }

    setDefinition(defId: CardId): void {
        if (!getCardDef(defId)) {
            throw new Error(`[CardInstance] 未知卡牌 defId: ${defId}`);
        }
        this.defId = defId;
    }

    upgradeDefinition(defId: CardId): void {
        this.setDefinition(defId);
        this._baseDefId = defId;
    }

    resetDefinition(): void {
        this.defId = this._baseDefId;
    }
}

export function resetCardUidCounterForTests(start = 1): void {
    _nextUid = start;
}

export function createCardInstance(defId: CardId, cyclesDescentOnDraw = false): CardInstance {
    return new CardInstance(defId, cyclesDescentOnDraw);
}
