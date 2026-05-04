/** 怪物配置 id，与数据表主键一致 */
export type EnemyId = string;

export interface EnemyIntentDef {
    label: string;
    damage?: number;
    block?: number;
    strength?: number;
}

export interface EnemyDef {
    id: EnemyId;
    name: string;
    maxHp: number;
    /** 意图池；当前 MVP 使用顺序轮换，后续可替换成权重随机 */
    intents: EnemyIntentDef[];
}

const DEFS: Record<EnemyId, EnemyDef> = {
    cultist: {
        id: 'cultist',
        name: '邪教徒',
        maxHp: 48,
        intents: [
            { label: '攻击：造成 6 点伤害', damage: 6 },
            { label: '仪式：获得 3 点力量', strength: 3 },
        ],
    },
    jaw_worm: {
        id: 'jaw_worm',
        name: '颚虫',
        maxHp: 40,
        intents: [
            { label: '啃咬：造成 5 点伤害', damage: 5 },
            { label: '翻滚：获得 5 点格挡', block: 5 },
        ],
    },
    red_louse: {
        id: 'red_louse',
        name: '红虱',
        maxHp: 10,
        intents: [
            { label: '生长：获得 2 点力量', strength: 2 },
            { label: '叮咬：造成 5 点伤害', damage: 5 },
        ],
    },
};

export function getEnemyDef(id: EnemyId): EnemyDef | undefined {
    return DEFS[id];
}

export function allEnemyIds(): EnemyId[] {
    return Object.keys(DEFS);
}
