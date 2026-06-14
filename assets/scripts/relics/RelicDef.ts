export type RelicId =
    | 'neow_energy_core'
    | 'neow_spirit_wing'
    | 'neow_golden_rose'
    | 'ironclad_burning_blood'
    | 'spirit_lantern';

export interface RelicEffects {
    startCombatEnergy?: number;
    firstHpLossImmune?: boolean;
    goldRewardHeal?: number;
    victoryHeal?: number;
    firstDescentCoverEnergy?: number;
    firstDescentCoverDraw?: number;
}

export interface RelicDef {
    id: RelicId;
    name: string;
    description: string;
    iconPath: string;
    pool: 'neow' | 'ironclad';
    effects: RelicEffects;
}

export const NEOW_STARTER_RELIC_IDS: RelicId[] = [
    'neow_energy_core',
    'neow_spirit_wing',
    'neow_golden_rose',
];

export const IRONCLAD_STARTER_RELIC_ID: RelicId = 'ironclad_burning_blood';
export const SPIRIT_LANTERN_RELIC_ID: RelicId = 'spirit_lantern';

export const RELIC_DEFS: RelicDef[] = [
    {
        id: 'neow_energy_core',
        name: '能量核心',
        description: '每场战斗第一回合额外获得 1 点能量。',
        iconPath: 'textures/relics/centennial_puzzle',
        pool: 'neow',
        effects: { startCombatEnergy: 1 },
    },
    {
        id: 'neow_spirit_wing',
        name: '灵体羽翼',
        description: '每场战斗首次受到生命伤害时免疫。',
        iconPath: 'textures/relics/paels_wing',
        pool: 'neow',
        effects: { firstHpLossImmune: true },
    },
    {
        id: 'neow_golden_rose',
        name: '黄金玫瑰',
        description: '获得战斗金币奖励时额外回复 3 点生命。',
        iconPath: 'textures/relics/blood_soaked_rose',
        pool: 'neow',
        effects: { goldRewardHeal: 3 },
    },
    {
        id: 'ironclad_burning_blood',
        name: '燃烧之血',
        description: '战斗胜利后回复 6 点生命。',
        iconPath: 'textures/relics/burning_blood',
        pool: 'ironclad',
        effects: { victoryHeal: 6 },
    },
    {
        id: 'spirit_lantern',
        name: '引魂灯',
        description: '每回合第一次通过【降临】覆盖虚影时，获得 1 点能量并抽 1 张牌。',
        iconPath: 'textures/relics/lantern',
        pool: 'ironclad',
        effects: { firstDescentCoverEnergy: 1, firstDescentCoverDraw: 1 },
    },
];

export function getRelicDef(id: string): RelicDef | null {
    return RELIC_DEFS.find((relic) => relic.id === id) ?? null;
}

export function getRelicDefs(ids: readonly string[]): RelicDef[] {
    return ids
        .map((id) => getRelicDef(id))
        .filter((relic): relic is RelicDef => !!relic);
}

export function hasRelic(ids: readonly string[], id: RelicId): boolean {
    return ids.indexOf(id) >= 0;
}

export function getStarterRelicsForCharacter(charId: number): RelicId[] {
    return charId === 2 ? [IRONCLAD_STARTER_RELIC_ID, SPIRIT_LANTERN_RELIC_ID] : [SPIRIT_LANTERN_RELIC_ID];
}
