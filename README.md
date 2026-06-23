# KingdomsSpire

一款基于 Cocos Creator 3.8.8 的三国主题肉鸽卡牌项目，核心流程是选角、选初始遗物、进地图冒险、战斗、事件、商店与结算。

## 项目运行

1. 使用 **Cocos Creator 3.8.8** 打开本项目根目录。
2. 从编辑器中直接运行场景，推荐入口：
   - `assets/scenes/MainMenu.scene`
3. 常见流程场景：
   - `assets/scenes/CharSelect.scene`
   - `assets/scenes/InitialReward.scene`
   - `assets/scenes/GameMap.scene`
   - `assets/scenes/Battle.scene`
   - `assets/scenes/Event.scene`

## 主要内容

- 三国主题角色选择界面
- 初始遗物选择
- 地图探索与节点生成
- 战斗系统与敌人数值缩放
- 随机事件与结果反馈
- 商店购买与二次确认
- 对局记录保存与查看
- 背景音乐暂停续播

## 目录说明

- `assets/scripts/`：核心逻辑脚本
- `assets/scenes/`：各个场景资源
- `assets/resources/`：图片、音频等运行资源
- `docs/`：数值和规则说明

## 说明文档

- [怪物数值说明](docs/怪物数值.md)
- [卡牌数值说明](docs/三国尖塔卡牌数值.md)

## 备注

- 对局记录保存在本地存储中。
- 图像资源和场景配置已按当前版本整理，直接在编辑器中打开即可预览。
