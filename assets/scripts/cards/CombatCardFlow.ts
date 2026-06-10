import type { CardDef } from './CardDef';
import { getCardDef } from './CardDef';
import type { CardInstance } from './CardInstance';

/** Fisher–Yates 洗牌 */
function shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

/**
 * 抽牌堆 / 弃牌 / 消耗 / 手牌 的流转。
 * 不依赖 Cocos 节点；Battle 场景里用组件包装调用即可。
 */
export class CombatCardFlow {
    readonly hand: CardInstance[] = [];
    readonly drawPile: CardInstance[] = [];
    readonly discardPile: CardInstance[] = [];
    readonly exhaustPile: CardInstance[] = [];
    onBeforeDraw: ((card: CardInstance) => void) | null = null;

    /** 用初始卡组重置战斗（拷贝实例引用进抽牌堆并洗牌） */
    resetCombat(masterDeck: CardInstance[]): void {
        this.hand.length = 0;
        this.discardPile.length = 0;
        this.exhaustPile.length = 0;
        this.drawPile.length = 0;
        this.drawPile.push(...masterDeck);
        shuffleInPlace(this.drawPile);
    }

    /** 抽牌堆空时把弃牌堆洗回抽牌堆（常见爬塔规则） */
    private recycleDiscardIfNeeded(): void {
        if (this.drawPile.length > 0) {
            return;
        }
        if (this.discardPile.length === 0) {
            return;
        }
        this.drawPile.push(...this.discardPile.splice(0, this.discardPile.length));
        shuffleInPlace(this.drawPile);
    }

    /** 从抽牌堆顶摸一张到手牌；无牌可摸返回 null */
    drawOne(): CardInstance | null {
        this.recycleDiscardIfNeeded();
        const c = this.drawPile.pop();
        if (!c) {
            return null;
        }
        this.onBeforeDraw?.(c);
        this.hand.push(c);
        return c;
    }

    draw(count: number): CardInstance[] {
        const out: CardInstance[] = [];
        for (let i = 0; i < count; i++) {
            const c = this.drawOne();
            if (!c) {
                break;
            }
            out.push(c);
        }
        return out;
    }

    addToHand(card: CardInstance): void {
        this.hand.push(card);
    }

    resetTemporaryCosts(): void {
        const zones = [this.hand, this.drawPile, this.discardPile, this.exhaustPile];
        for (const zone of zones) {
            for (const card of zone) {
                card.temporaryCost = null;
            }
        }
    }

    /** 手牌索引打出：进弃牌或消耗堆；非法索引返回 false */
    playFromHand(handIndex: number): boolean {
        const c = this.hand[handIndex];
        if (!c) {
            return false;
        }
        const def = getCardDef(c.defId);
        if (!def) {
            return false;
        }
        this.hand.splice(handIndex, 1);
        if (def.exhaustsOnPlay) {
            this.exhaustPile.push(c);
        } else {
            c.resetDefinition();
            this.discardPile.push(c);
        }
        return true;
    }

    /** 弃掉手牌中一张（效果用），不进打出逻辑 */
    discardFromHand(handIndex: number): boolean {
        const [c] = this.hand.splice(handIndex, 1);
        if (!c) {
            return false;
        }
        c.resetDefinition();
        this.discardPile.push(c);
        return true;
    }

    /** 回合结束弃光手牌（规则可在外部决定是否调用） */
    discardAllHand(): void {
        while (this.hand.length > 0) {
            const c = this.hand.pop()!;
            c.resetDefinition();
            this.discardPile.push(c);
        }
    }

    defOf(c: CardInstance): CardDef | undefined {
        return getCardDef(c.defId);
    }
}
