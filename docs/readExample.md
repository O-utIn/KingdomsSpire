import { GlobalData } from './GlobalData'; // 引用你写的全局类

start() {
    // 伙伴读取你传过来的数据
    const playerData = GlobalData.instance.selectedChar;
    const gameDiff = GlobalData.instance.difficulty;

    if (playerData) {
        console.log("伙伴收到了数据！");
        console.log("角色名:", playerData.name);
        console.log("初始血量:", playerData.hp);
        console.log("初始物品:", playerData.relics);
        console.log("当前难度:", gameDiff);
        
        // 伙伴在这里初始化他的战斗系统、UI或地图...
    }
}
