import type { CardId } from '../cards/CardDef';

/** 怪物配置 id，与数据表主键一致 */
export type EnemyId = string;

export interface EnemyStatusCardAddition {
    cardId: CardId;
    count: number;
    destination: 'drawPile' | 'hand';
}

export interface EnemyIntentDef {
    label: string;
    /** 每段伤害；hits > 1 时按多段攻击结算 */
    damage?: number;
    hits?: number;
    block?: number;
    strength?: number;
    /** 召唤指定怪物；当前战斗会限制同 id 召唤物数量，避免铺场失控 */
    summons?: EnemyId[];
    summonLimitPerId?: number;
    /** 暂未完整实现状态系统的效果，先进入战斗记录，便于调试体验节奏 */
    playerDebuff?: string;
    statusCards?: string;
    addsStatusCards?: EnemyStatusCardAddition[];
    playerVulnerable?: number;
    playerFrail?: number;
}

export interface EnemyDef {
    id: EnemyId;
    name: string;
    maxHp: number;
    artPath?: string;
    faction?: 'neutral' | 'wei' | 'wu';
    tier?: 'normal' | 'elite' | 'boss' | 'minion';
    role: string;
    passive?: string;
    /** 意图池；当前 MVP 使用顺序轮换，后续可替换成权重随机 */
    intents: EnemyIntentDef[];
}

const DEFS: Record<EnemyId, EnemyDef> = {
    cultist: {
        id: 'cultist',
        name: '邪教徒',
        maxHp: 48,
        artPath: 'textures/chars/ritual priest',
        faction: 'neutral',
        tier: 'normal',
        role: '成长型普通怪，迫使玩家尽快击杀',
        intents: [
            { label: '攻击：造成 6 点伤害', damage: 6 },
            { label: '仪式：获得 3 点力量', strength: 3 },
        ],
    },
    jaw_worm: {
        id: 'jaw_worm',
        name: '颚虫',
        maxHp: 40,
        artPath: 'textures/chars/JawWorm',
        faction: 'neutral',
        tier: 'normal',
        role: '攻防轮换普通怪，检验基础攻防效率',
        intents: [
            { label: '啃咬：造成 5 点伤害', damage: 5 },
            { label: '翻滚：获得 5 点格挡', block: 5 },
        ],
    },
    red_louse: {
        id: 'red_louse',
        name: '红虱',
        maxHp: 18,
        artPath: 'textures/chars/RedLouse',
        faction: 'neutral',
        tier: 'normal',
        role: '低血量成长怪，鼓励玩家优先点杀',
        intents: [
            { label: '生长：获得 2 点力量', strength: 2 },
            { label: '叮咬：造成 5 点伤害', damage: 5 },
        ],
    },
    xiahoudun_blind: {
        id: 'xiahoudun_blind',
        name: '盲目·夏侯惇',
        maxHp: 65,
        artPath: 'textures/chars/XiaHoudun',
        faction: 'wei',
        tier: 'elite',
        role: '第一层精英，检验爆发输出与防守节奏',
        passive: '拔矢啖睛：受到虚影常驻或离场伤害时获得力量（当前版本以数值定位保留）',
        intents: [
            { label: '激怒：获得 1 力量和 5 格挡', strength: 1, block: 5 },
            { label: '重劈：造成 10 点伤害', damage: 10 },
            { label: '狂乱：造成 3 点伤害，攻击 3 次', damage: 3, hits: 3 },
            { label: '休整：获得 7 格挡，并施加 1 层脆弱', block: 7, playerDebuff: '脆弱 1', playerVulnerable: 1 },
        ],
    },
    tiger_leopard_rider: {
        id: 'tiger_leopard_rider',
        name: '虎豹骑',
        maxHp: 20,
        artPath: 'textures/chars/TigerLeo',
        faction: 'wei',
        tier: 'minion',
        role: '曹操召唤物，持续制造小额伤害压力',
        intents: [
            { label: '突击：造成 6 点伤害', damage: 6 },
        ],
    },
    cao_cao_warlord: {
        id: 'cao_cao_warlord',
        name: '乱世奸雄·曹操',
        maxHp: 145,
        artPath: 'textures/chars/cao_cao_warlord2',
        faction: 'wei',
        tier: 'boss',
        role: '第一层 Boss，检验 AOE 清理能力和状态保持',
        passive: '宁我负人：玩家场上没有虚影时，回合结束恢复 3 点生命并获得 2 点格挡',
        intents: [
            {
                label: '号令虎豹：召唤 2 名虎豹骑；若已满员则全体魏军获得 1 力量',
                summons: ['tiger_leopard_rider', 'tiger_leopard_rider'],
                summonLimitPerId: 2,
                strength: 1,
            },
            { label: '倚天剑击：造成 10 点伤害，并塞入 1 张伤口', damage: 10, statusCards: '伤口 1' },
            { label: '挟天子：造成 16 点伤害，并施加 1 层虚弱', damage: 16, playerDebuff: '虚弱 1', playerVulnerable: 1 },
            { label: '倚天剑击：造成 10 点伤害，并塞入 1 张伤口', damage: 10, statusCards: '伤口 1' },
        ],
    },
    ganning_raider: {
        id: 'ganning_raider',
        name: '锦帆贼·甘宁',
        maxHp: 78,
        artPath: 'textures/chars/GanNing',
        faction: 'wu',
        tier: 'elite',
        role: '第二层精英，检验手牌运转效率和爆发窗口',
        passive: '游侠铃铛：玩家额外抽牌时获得格挡（当前版本以数值定位保留）',
        intents: [
            { label: '百骑劫营：造成 4 点伤害，攻击 2 次，并偷走最左手牌', damage: 4, hits: 2, statusCards: '偷牌 1' },
            { label: '连斩：造成 5 点伤害，攻击 3 次', damage: 5, hits: 3 },
            { label: '嘲笑：施加 1 层虚弱和 1 层脆弱', playerDebuff: '虚弱 1 / 脆弱 1', playerVulnerable: 1, playerFrail: 1 },
        ],
    },
    zhouyu_grand_duke: {
        id: 'zhouyu_grand_duke',
        name: '大都督·周瑜',
        maxHp: 170,
        artPath: 'textures/chars/zhouyu_grand_duke2',
        faction: 'wu',
        tier: 'boss',
        role: '第二层 Boss，检验成型速度和极限生存',
        passive: '借东风：周瑜回合结束时，将玩家弃牌堆中的灼伤升级为灼伤+',
        intents: [
            { label: '火烧赤壁：造成 8 点伤害，塞入 2 张灼伤', damage: 8, addsStatusCards: [{ cardId: 'burn', count: 2, destination: 'drawPile' }] },
            { label: '苦肉连环：获得 12 格挡，塞入 1 张铁索', block: 12, addsStatusCards: [{ cardId: 'iron_chain', count: 1, destination: 'hand' }] },
            { label: '业火滔天：造成 5 点伤害，攻击 5 次', damage: 5, hits: 5 },
        ],
    },
};

export function getEnemyDef(id: EnemyId): EnemyDef | undefined {
    return DEFS[id];
}

export function allEnemyIds(): EnemyId[] {
    return Object.keys(DEFS);
}
