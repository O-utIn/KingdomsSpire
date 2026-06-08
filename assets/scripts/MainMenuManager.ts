import { _decorator, Component, director, game } from 'cc';
import { GlobalAudioManager } from './GlobalAudioManager';
import { RunHudManager } from './RunHudManager';
const { ccclass } = _decorator;

@ccclass('MainMenuManager')
export class MainMenuManager extends Component {
    onLoad(): void {
        RunHudManager.stopRun();
        GlobalAudioManager.stopBgm();
    }

    /**
     * 跳转选角页面
     */
    public onSinglePlayerClick() {
        console.log("尝试加载场景：CharSelect");
        
        // 使用带回调的加载方式，以便排查场景名称错误
        director.loadScene("CharSelect", (err) => {
            if (err) {
                console.error("跳转失败！请确认：1.场景名是否拼对 2.构建发布里是否勾选了该场景。 错误详情：", err);
            } else {
                console.log("场景跳转成功！已进入选角页面。");
            }
        });
    }

    /**
     * 预留设置功能
     */
    public onSettingsClick() {
        console.log("设置按钮被点击");
    }

    /**
     * 退出游戏
     */
    public onExitClick() {
        console.log("正在退出游戏...");
        game.end();
    }
}
