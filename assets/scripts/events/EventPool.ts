/**
 * 事件池 - 所有可触发的事件配置
 * 对应地图上的"兴趣点"（问号节点）
 */

import { EventDef, EVENT_RARITY_WEIGHTS } from './EventDef';

/** 示例事件池 - 可以扩展更多事件 */
export const EVENT_POOL: EventDef[] = [
    // ========== 普通事件 (common) ==========

    // 事件1: 神秘宝箱
    {
        id: 'mystery_chest',
        title: '神秘宝箱',
        description: '你发现了一个被遗弃的宝箱，它看起来已经被放置在这里很久了。宝箱上积满了灰尘，但锁看起来已经锈蚀。你可以尝试打开它，或者为了安全起见离开它。',
        image: 'textures/events/StS2_Sunken_Treasury',
        rarity: 'common',
        choices: [
            {
                text: '打开宝箱',
                tooltip: '可能获得金币，也可能触发陷阱',
                result: {
                    type: 'gain_gold',
                    value: 50,
                    description: '你小心地撬开了锁，发现里面有50金币！',
                },
            },
            {
                text: '踢开它',
                tooltip: '粗鲁但快速的方法，有风险',
                result: {
                    type: 'lose_hp',
                    value: 5,
                    description: '你用力踢开了宝箱，触发了隐藏的毒气陷阱！失去5点生命。但你在残骸中找到了30金币。',
                },
            },
            {
                text: '离开',
                tooltip: '安全第一',
                result: {
                    type: 'nothing',
                    description: '你决定不冒险，继续前行。',
                },
            },
        ],
    },

    // 事件2: 流浪商人
    {
        id: 'wandering_merchant',
        title: '流浪商人',
        description: '一个行色匆匆的商人拦住了你。"旅行者，我赶时间，但我有一些好东西要出手。你给我75金币，我给你一件随机遗物。怎么样？"',
        image: 'textures/events/StS2_Fake_Merchant_Rug',
        rarity: 'common',
        choices: [
            {
                text: '购买遗物 (75金币)',
                tooltip: '获得一件随机遗物',
                result: {
                    type: 'gain_relic',
                    value: 1,
                    description: '你支付了75金币，获得了一件神秘遗物！',
                },
            },
            {
                text: '抢劫他',
                tooltip: '获得金币但会受伤',
                result: {
                    type: 'gain_gold',
                    value: 100,
                    description: '商人奋力反抗，但你最终抢到了100金币。不过你也受了轻伤，失去10点生命。',
                },
            },
            {
                text: '拒绝并离开',
                tooltip: '无事发生',
                result: {
                    type: 'nothing',
                    description: '你觉得这笔交易不太划算，礼貌地拒绝了商人。',
                },
            },
        ],
    },

    // 事件3: 圣泉
    {
        id: 'holy_spring',
        title: '圣泉',
        description: '你发现了一处散发着微光的圣泉。泉水清澈见底，你能感受到其中蕴含的治愈之力。你可以在这里休息恢复，或者用泉水强化自己。',
        image: 'textures/events/StS2_Wellspring',
        rarity: 'common',
        choices: [
            {
                text: '饮用泉水 (回复20生命)',
                tooltip: '立即恢复生命值',
                result: {
                    type: 'gain_hp',
                    value: 20,
                    description: '你饮用了圣泉之水，感觉体力恢复了20点！',
                },
            },
            {
                text: '沐浴 (最大生命+5)',
                tooltip: '永久增加最大生命值',
                result: {
                    type: 'gain_max_hp',
                    value: 5,
                    description: '你在泉水中沐浴，感受到生命力在体内涌动。最大生命值增加5点！',
                },
            },
            {
                text: '装满瓶子离开',
                tooltip: '获得一瓶回复药水',
                result: {
                    type: 'gain_card',
                    value: 1,
                    description: '你装满了水瓶，准备在路上使用。获得一张"圣水"卡牌！',
                },
            },
        ],
    },

    // 事件4: 古老祭坛
    {
        id: 'ancient_altar',
        title: '古老祭坛',
        description: '一座布满青苔的古老祭坛矗立在道路中央。祭坛上刻着你无法辨认的文字，中央有一个凹槽，看起来可以放入某样东西。你感觉这里弥漫着神秘的能量。',
        image: 'textures/events/Event-ForgottenAltar',
        rarity: 'common',
        choices: [
            {
                text: '献上金币 (失去50金币)',
                tooltip: '可能获得祝福',
                result: {
                    type: 'gain_hp',
                    value: 15,
                    description: '你献上了50金币。祭坛发出柔和的光芒，你感到一阵温暖，恢复了15点生命。',
                },
            },
            {
                text: '无视它',
                tooltip: '直接离开',
                result: {
                    type: 'nothing',
                    description: '你觉得最好不要打扰古老的力量，悄悄绕过了祭坛。',
                },
            },
            {
                text: '触摸祭坛',
                tooltip: '未知的风险',
                result: {
                    type: 'gain_gold',
                    value: 80,
                    description: '当你触摸祭坛时，一阵电流传遍全身！你强忍着疼痛，发现祭坛裂开了，露出了里面藏的80金币。你也受了点伤，失去8点生命。',
                },
            },
        ],
    },

    // ========== 罕见事件 (uncommon) ==========

    // 事件5: 神秘商人
    {
        id: 'mysterious_trader',
        title: '神秘商人',
        description: '一个披着斗篷的神秘人物从阴影中走出。"我有一些...特别的商品。"他低声说道，"我可以移除你牌组中的一张牌，只需付出一点代价。或者，如果你愿意冒更大的风险，我可以给你更好的回报。"',
        image: 'textures/events/StS2_Relic_Trader',
        rarity: 'uncommon',
        choices: [
            {
                text: '移除一张牌 (失去25金币)',
                tooltip: '精简你的牌组',
                result: {
                    type: 'remove_card',
                    value: 1,
                    description: '你支付了25金币。神秘商人施展了某种法术，你感觉牌组变得更轻盈了。移除一张卡牌！',
                },
            },
            {
                text: '赌博 (50%获得200金币，50%失去50金币)',
                tooltip: '高风险高回报',
                result: {
                    type: 'gain_gold',
                    value: 200,
                    description: '神秘商人笑了，抛出一枚硬币。正面！你赢得了200金币！',
                },
            },
            {
                text: '拒绝',
                tooltip: '无事发生',
                result: {
                    type: 'nothing',
                    description: '你觉得这个商人有些可疑，礼貌地拒绝了他。',
                },
            },
        ],
    },

    // 事件6: 废弃图书馆
    {
        id: 'abandoned_library',
        title: '废弃图书馆',
        description: '你发现了一座半倒塌的图书馆。书架虽然已经腐朽，但一些书籍似乎还保存完好。你可以在这里寻找知识，或者休息一下。',
        image: 'textures/events/StS2_Waterlogged_Scriptorium',
        rarity: 'uncommon',
        choices: [
            {
                text: '阅读古书 (获得2张随机卡牌)',
                tooltip: '扩充牌组',
                result: {
                    type: 'gain_card',
                    value: 2,
                    description: '你花了些时间阅读古书，学会了一些新技巧。获得2张随机卡牌！',
                },
            },
            {
                text: '寻找宝藏 (获得100金币)',
                tooltip: '找到藏起来的金币',
                result: {
                    type: 'gain_gold',
                    value: 100,
                    description: '你翻遍了书架，在一本空心书里发现了100金币！',
                },
            },
            {
                text: '休息 (回复15生命)',
                tooltip: '恢复体力',
                result: {
                    type: 'gain_hp',
                    value: 15,
                    description: '你在图书馆的角落找到了一个安全的休息处，恢复了15点生命。',
                },
            },
        ],
    },

    // ========== 稀有事件 (rare) ==========

    // 事件7: 神秘传送门
    {
        id: 'mystery_portal',
        title: '神秘传送门',
        description: '空气中突然出现了一道裂缝，逐渐扩展成一个旋转的传送门。你感受到从门中传出的强大能量，既令人兴奋又令人恐惧。你不知道它通向哪里，但感觉这可能是改变命运的机会。',
        image: 'textures/events/StS2_Doors_of_Light_And_Dark',
        rarity: 'rare',
        choices: [
            {
                text: '进入传送门',
                tooltip: '随机结果：可能是巨大收益，也可能是巨大风险',
                result: {
                    type: 'gain_relic',
                    value: 1,
                    description: '你鼓起勇气踏入了传送门！一阵眩晕之后，你发现自己在一个充满宝物的密室中。获得一件稀有遗物和100金币！',
                },
            },
            {
                text: '向传送门投入金币 (100金币)',
                tooltip: '祈求好运',
                result: {
                    type: 'gain_max_hp',
                    value: 10,
                    description: '你向传送门投入了100金币。门中传来一声满足的低鸣，一股能量涌入你的身体。最大生命值增加10点！',
                },
            },
            {
                text: '远远避开',
                tooltip: '安全第一',
                result: {
                    type: 'nothing',
                    description: '你觉得这个传送门太危险了，决定保持距离。传送门慢慢消失了。',
                },
            },
        ],
    },

    // 事件8: 天使降临
    {
        id: 'angelic_encounter',
        title: '天使降临',
        description: '一道金色的光芒从天而降，一个神圣的身影出现在你面前。"勇敢的战士，"天使的声音如同音乐，"你的勇气令我感动。我可以赐予你祝福，但世间万物皆有代价。"',
        image: 'textures/events/Event-ShiningLight',
        rarity: 'rare',
        onceOnly: true,
        choices: [
            {
                text: '接受祝福 (回复全部生命)',
                tooltip: '完全恢复',
                result: {
                    type: 'gain_hp',
                    value: 999,
                    description: '天使将手放在你的额头，温暖的光芒流遍全身。你的所有伤势都愈合了！生命值完全恢复！',
                },
            },
            {
                text: '祈求力量 (获得一件稀有遗物)',
                tooltip: '获得强力遗物',
                result: {
                    type: 'gain_relic',
                    value: 1,
                    description: '天使点了点头，从光芒中取出一物递给你。这是一件传说中的遗物！',
                },
            },
            {
                text: '请求金币 (获得250金币)',
                tooltip: '世俗的财富',
                result: {
                    type: 'gain_gold',
                    value: 250,
                    description: '天使似乎有些失望，但还是满足了你的愿望。250金币出现在你手中。',
                },
            },
        ],
    },
];

/** 根据ID获取事件 */
export function getEventById(id: string): EventDef | undefined {
    return EVENT_POOL.find(e => e.id === id);
}

/** 获取特定稀有度的事件列表 */
export function getEventsByRarity(rarity: 'common' | 'uncommon' | 'rare'): EventDef[] {
    return EVENT_POOL.filter(e => e.rarity === rarity);
}

/** Select once on the map so the chosen event image can be decoded before entry. */
export function selectWeightedRandomEvent(random: () => number = Math.random): EventDef {
    const getWeight = (event: EventDef): number => EVENT_RARITY_WEIGHTS[event.rarity ?? 'common'] ?? 60;
    const totalWeight = EVENT_POOL.reduce((sum, event) => sum + getWeight(event), 0);
    let roll = random() * totalWeight;
    for (const event of EVENT_POOL) {
        roll -= getWeight(event);
        if (roll <= 0) {
            return event;
        }
    }
    return EVENT_POOL[0];
}
