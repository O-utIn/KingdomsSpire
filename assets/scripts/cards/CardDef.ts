/** 卡牌配置 id，与数据表主键一致 */
export type CardId = string;

export interface CardDef {
    id: CardId;
    name: string;
    cost: number;
    /** 简短说明，UI 用 */
    description: string;
    /** 对选中敌人造成的伤害 */
    damage?: number;
    /** 给玩家获得的格挡 */
    block?: number;
    /** 打出后进入消耗堆而非弃牌堆 */
    exhaustsOnPlay?: boolean;
}

const DEFS: Record<CardId, CardDef> = {
    strike: {
        id: 'strike',
        name: '打击',
        cost: 1,
        description: '造成 6 点伤害。',
        damage: 6,
    },
    defend: {
        id: 'defend',
        name: '防御',
        cost: 1,
        description: '获得 5 点格挡。',
        block: 5,
    },
    bash: {
        id: 'bash',
        name: '重击',
        cost: 2,
        description: '造成 8 点伤害。',
        damage: 8,
    },
    survivor: {
        id: 'survivor',
        name: '生存者',
        cost: 1,
        description: '消耗：获得 8 点格挡。',
        block: 8,
        exhaustsOnPlay: true,
    },
};

export function getCardDef(id: CardId): CardDef | undefined {
    return DEFS[id];
}

export function allCardIds(): CardId[] {
    return Object.keys(DEFS);
}
