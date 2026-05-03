/** 怪物配置 id，与数据表主键一致 */
export type EnemyId = string;

export interface EnemyDef {
    id: EnemyId;
    name: string;
    maxHp: number;
    /** 意图描述池；战斗 AI 可轮换或随机选取（此处仅占位文案） */
    intents: string[];
}

const DEFS: Record<EnemyId, EnemyDef> = {
    cultist: {
        id: 'cultist',
        name: '邪教徒',
        maxHp: 48,
        intents: ['攻击：造成 6 点伤害', '仪式：获得 3 点力量'],
    },
    jaw_worm: {
        id: 'jaw_worm',
        name: '颚虫',
        maxHp: 40,
        intents: ['啃咬：造成 5 点伤害', '翻滚：获得 5 点格挡'],
    },
    red_louse: {
        id: 'red_louse',
        name: '红虱',
        maxHp: 10,
        intents: ['生长：获得 2 点力量', '叮咬：造成 5 点伤害'],
    },
};

export function getEnemyDef(id: EnemyId): EnemyDef | undefined {
    return DEFS[id];
}

export function allEnemyIds(): EnemyId[] {
    return Object.keys(DEFS);
}
