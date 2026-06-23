import type { EnemyId } from './EnemyDef';
import { getEnemyDef } from './EnemyDef';
import type { EnemyIntentDef } from './EnemyDef';

let _nextUid = 1;

/**
 * 战斗中单个怪物实例：生命、格挡、当前意图展示。
 * 与 Cocos 节点无关；Battle 里用 View 组件绑定本对象即可。
 */
export class EnemyInstance {
    readonly uid: number;
    currentHp: number;
    private readonly _statScale: number;
    /** 当前格挡（回合结束是否清空由战斗系统决定） */
    block = 0;
    /** 当前回合展示的意图文案（由 pickIntentAt / setIntent 维护） */
    currentIntentLabel = '';
    /** 力量会追加到攻击意图的伤害上 */
    strength = 0;
    /** 意图池轮转用 */
    private _intentIndex = 0;

    constructor(public readonly defId: EnemyId, statScale = 1) {
        const def = getEnemyDef(defId);
        if (!def) {
            throw new Error(`[EnemyInstance] 未知怪物 defId: ${defId}`);
        }
        this.uid = _nextUid++;
        this._statScale = Math.max(0.1, statScale);
        this.currentHp = this.scaleStat(def.maxHp);
        this.pickIntentAt(0);
    }

    get maxHp(): number {
        return this.scaleStat(getEnemyDef(this.defId)?.maxHp ?? 0);
    }

    get isDead(): boolean {
        return this.currentHp <= 0;
    }

    get currentIntent(): EnemyIntentDef | null {
        const def = getEnemyDef(this.defId);
        return def?.intents[this._intentIndex] ?? null;
    }

    scaleStat(value: number): number {
        return Math.max(1, Math.round(value * this._statScale));
    }

    scaledIntentDamage(intent: EnemyIntentDef): number {
        return intent.damage ? this.scaleStat(intent.damage) : 0;
    }

    scaledIntentBlock(intent: EnemyIntentDef): number {
        return intent.block ? this.scaleStat(intent.block) : 0;
    }

    scaledIntentStrength(intent: EnemyIntentDef): number {
        return intent.strength ? this.scaleStat(intent.strength) : 0;
    }

    /** 从配置池按索引取意图（循环） */
    pickIntentAt(index: number): void {
        const def = getEnemyDef(this.defId);
        if (!def || def.intents.length === 0) {
            this.currentIntentLabel = '';
            return;
        }
        this._intentIndex = ((index % def.intents.length) + def.intents.length) % def.intents.length;
        this.currentIntentLabel = def.intents[this._intentIndex]!.label;
    }

    /** 下一格意图（常用于回合结束） */
    advanceIntent(): void {
        this.pickIntentAt(this._intentIndex + 1);
    }

    addBlock(amount: number): void {
        if (amount > 0) {
            this.block += amount;
        }
    }

    /** 先扣格挡再扣血；返回实际扣血数值 */
    takeDamage(amount: number): number {
        if (amount <= 0) {
            return 0;
        }
        let remaining = amount;
        if (this.block > 0) {
            const absorbed = Math.min(this.block, remaining);
            this.block -= absorbed;
            remaining -= absorbed;
        }
        const hpLoss = Math.min(this.currentHp, remaining);
        this.currentHp -= hpLoss;
        return hpLoss;
    }

    heal(amount: number): void {
        if (amount > 0) {
            const cap = this.maxHp;
            this.currentHp = Math.min(cap, this.currentHp + amount);
        }
    }
}

export function resetEnemyUidCounterForTests(start = 1): void {
    _nextUid = start;
}

export function createEnemyInstance(defId: EnemyId, statScale = 1): EnemyInstance {
    return new EnemyInstance(defId, statScale);
}
