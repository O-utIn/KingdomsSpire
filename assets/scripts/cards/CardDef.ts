/** 卡牌配置 id，与数据表主键一致 */
export type CardId = string;
export type CardType = 'attack' | 'skill' | 'power' | 'status';
export type ShadowId = 'spirit' | 'wusheng' | 'wolong' | 'wushuang';
export type PowerId = 'tactical_terrain';

export interface CardDef {
    id: CardId;
    name: string;
    cost: number;
    /** 战斗类型：攻击 / 技能 / 能力 */
    type: CardType;
    /** 简短说明，UI 用 */
    description: string;
    /** resources 下的卡面或卡图路径，不含 /spriteFrame */
    artPath?: string;
    /** 对选中敌人造成的伤害 */
    damage?: number;
    /** 伤害打到全部敌人 */
    damageAllEnemies?: boolean;
    /** 给玩家获得的格挡 */
    block?: number;
    /** 抽牌数量 */
    draw?: number;
    /** 场上有【虚影】时改为抽牌数量 */
    drawIfShadow?: number;
    /** 直接失去生命，不受格挡或免伤影响 */
    hpLoss?: number;
    /** 打出后覆盖为指定虚影 */
    descentShadow?: ShadowId;
    /** 强制当前虚影离场 */
    forcesShadowLeave?: boolean;
    /** 生成随机【降临】牌加入手牌 */
    createsRandomDescent?: boolean;
    /** 能力牌常驻效果 */
    grantsPower?: PowerId;
    /** 打出后进入消耗堆而非弃牌堆 */
    exhaustsOnPlay?: boolean;
    /** 无法由玩家主动打出 */
    unplayable?: boolean;
    /** 回合结束时仍在手牌中会直接失去的生命 */
    endTurnHpLoss?: number;
    /** 进入手牌时使本回合无法打出降临牌 */
    blocksDescentInHand?: boolean;
    /** 回合结束时从手牌进入消耗堆 */
    exhaustsAtEndOfTurn?: boolean;
}

const DEFS: Record<CardId, CardDef> = {
    strike: {
        id: 'strike',
        name: '打击',
        cost: 1,
        type: 'attack',
        description: '造成 6 点伤害。',
        artPath: 'textures/cards/perfected_strike',
        damage: 6,
    },
    strike_plus: {
        id: 'strike_plus',
        name: '打击+',
        cost: 1,
        type: 'attack',
        description: '造成 9 点伤害。',
        artPath: 'textures/cards/perfected_strike',
        damage: 9,
    },
    defend: {
        id: 'defend',
        name: '防御',
        cost: 1,
        type: 'skill',
        description: '获得 5 点格挡。',
        artPath: 'textures/cards/survivor',
        block: 5,
    },
    bash: {
        id: 'bash',
        name: '重击',
        cost: 2,
        type: 'attack',
        description: '造成 8 点伤害。',
        artPath: 'textures/cards/bash',
        damage: 8,
    },
    survivor: {
        id: 'survivor',
        name: '生存者',
        cost: 1,
        type: 'skill',
        description: '消耗：获得 8 点格挡。',
        artPath: 'textures/cards/survivor',
        block: 8,
        exhaustsOnPlay: true,
    },
    descent: {
        id: 'descent',
        name: '降临',
        cost: 1,
        type: 'skill',
        description: '【降临】：覆盖基础虚影，获得 4 点格挡。',
        artPath: 'textures/cards/capture_spirit',
        block: 4,
        descentShadow: 'spirit',
    },
    scheme: {
        id: 'scheme',
        name: '锦囊',
        cost: 0,
        type: 'skill',
        description: '抽 1 张牌。若场上有【虚影】，改为抽 2 张牌。消耗。',
        artPath: 'textures/cards/battle_trance',
        draw: 1,
        drawIfShadow: 2,
        exhaustsOnPlay: true,
    },
    descent_wusheng: {
        id: 'descent_wusheng',
        name: '降临：武圣',
        cost: 2,
        type: 'attack',
        description: '【降临】：对所有敌人造成 12 点伤害。虚影常驻：所有攻击变为群体伤害且 +2。',
        artPath: 'textures/chars/Phantom/guanyu',
        damage: 12,
        damageAllEnemies: true,
        descentShadow: 'wusheng',
    },
    descent_wolong: {
        id: 'descent_wolong',
        name: '降临：卧龙',
        cost: 0,
        type: 'skill',
        description: '【降临】：抽 2 张牌。虚影常驻：每打出技能牌，手牌中所有【降临】费用 -1。',
        artPath: 'textures/chars/Phantom/zhuge',
        draw: 2,
        descentShadow: 'wolong',
    },
    descent_wushuang: {
        id: 'descent_wushuang',
        name: '降临：无双',
        cost: 2,
        type: 'attack',
        description: '【降临】：对指定敌人造成 28 点伤害。虚影常驻：格挡牌变为攻击且 +5。',
        artPath: 'textures/chars/Phantom/zhaoyun',
        damage: 28,
        descentShadow: 'wushuang',
    },
    bridge_break: {
        id: 'bridge_break',
        name: '过河拆桥',
        cost: 1,
        type: 'skill',
        description: '强制当前【虚影】离场，触发【离场】效果，然后获得 8 点格挡。',
        artPath: 'textures/cards/burning_pact',
        block: 8,
        forcesShadowLeave: true,
    },
    blood_rite: {
        id: 'blood_rite',
        name: '血祭',
        cost: 0,
        type: 'skill',
        description: '失去 3 点生命，将一张随机【降临】牌加入手牌，其本回合耗能为 0。消耗。',
        artPath: 'textures/cards/bloodletting',
        hpLoss: 3,
        createsRandomDescent: true,
        exhaustsOnPlay: true,
    },
    tactical_terrain: {
        id: 'tactical_terrain',
        name: '兵势险要',
        cost: 2,
        type: 'power',
        description: '本回合内，虚影被替换而离场时，你可以选择弃 1 张手牌；若如此做，获得 1 能量并抽 1 张牌。',
        artPath: 'textures/cards/battle_trance',
        grantsPower: 'tactical_terrain',
        exhaustsOnPlay: true,
    },
    burn: {
        id: 'burn',
        name: '灼伤',
        cost: 0,
        type: 'status',
        description: '无法打出。回合结束时若在手牌中，失去 2 点生命。',
        unplayable: true,
        endTurnHpLoss: 2,
    },
    burn_plus: {
        id: 'burn_plus',
        name: '灼伤+',
        cost: 0,
        type: 'status',
        description: '无法打出。回合结束时若在手牌中，失去 4 点生命。',
        unplayable: true,
        endTurnHpLoss: 4,
    },
    iron_chain: {
        id: 'iron_chain',
        name: '铁索',
        cost: 0,
        type: 'status',
        description: '进入手牌时，本回合无法打出【降临】牌。回合结束时消耗。',
        unplayable: true,
        blocksDescentInHand: true,
        exhaustsAtEndOfTurn: true,
    },
};

export function getCardDef(id: CardId): CardDef | undefined {
    return DEFS[id];
}

export function allCardIds(): CardId[] {
    return Object.keys(DEFS);
}

export function isDescentCard(def: CardDef): boolean {
    return !!def.descentShadow;
}
