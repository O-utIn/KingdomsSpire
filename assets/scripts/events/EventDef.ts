/**
 * 事件房间（兴趣点）数据定义
 * 对应地图上的问号节点 (?)
 */

/** 事件选项 */
export interface EventChoice {
    /** 选项文本 */
    text: string;
    /** 选项描述（鼠标悬停显示） */
    tooltip?: string;
    /** 选项结果 */
    result: EventResult;
}

/** 事件结果类型 */
export type EventResultType =
    | 'gain_gold'        // 获得金币
    | 'lose_gold'        // 失去金币
    | 'gain_hp'          // 回复生命
    | 'lose_hp'          // 失去生命
    | 'gain_max_hp'      // 增加最大生命
    | 'gain_card'        // 获得卡牌
    | 'remove_card'      // 移除卡牌
    | 'gain_relic'       // 获得遗物
    | 'combat'           // 进入战斗
    | 'nothing'          // 无事发生
    | 'leave';           // 离开

/** 事件结果 */
export interface EventResult {
    /** 结果类型 */
    type: EventResultType;
    /** 数值（如金币数量、生命点数等） */
    value?: number;
    /** 附加数据（如卡牌ID、遗物ID等） */
    data?: string;
    /** 结果描述 */
    description: string;
}

/** 事件定义 */
export interface EventDef {
    /** 事件唯一ID */
    id: string;
    /** 事件标题 */
    title: string;
    /** 事件描述文本 */
    description: string;
    /** 事件图片路径（可选） */
    image?: string;
    /** 事件选项列表 */
    choices: EventChoice[];
    /** 是否只能触发一次（在整个游戏中） */
    onceOnly?: boolean;
    /** 事件稀有度（影响出现概率） */
    rarity?: 'common' | 'uncommon' | 'rare';
}

/** 事件稀有度权重 */
export const EVENT_RARITY_WEIGHTS: Record<string, number> = {
    common: 60,
    uncommon: 30,
    rare: 10,
};
