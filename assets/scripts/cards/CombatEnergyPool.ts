/** 每回合能量；与卡牌费用配合，由战斗系统驱动 startTurn / spend */

export class CombatEnergyPool {
    /** 当前可用能量 */
    current = 0;
    /** 每回合开始时的基础能量（遗物等可在外部改此值再 startTurn） */
    perTurn = 3;

    startTurn(): void {
        this.current = this.perTurn;
    }

    canSpend(amount: number): boolean {
        return amount >= 0 && this.current >= amount;
    }

    /** 成功扣费返回 true */
    spend(amount: number): boolean {
        if (!this.canSpend(amount)) {
            return false;
        }
        this.current -= amount;
        return true;
    }

    add(amount: number): void {
        if (amount > 0) {
            this.current += amount;
        }
    }
}
