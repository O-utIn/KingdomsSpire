import { _decorator, Color, Component, director, Graphics, Label, Node, UITransform, view, Widget } from 'cc';
import { SCENE_GAME_MAP } from './GameConfig';
import { GlobalData } from './GlobalData';

const { ccclass } = _decorator;

/** 战斗场景占位：明显区别于地图的界面，战斗逻辑后续再接 */
@ccclass('BattlePlaceholderManager')
export class BattlePlaceholderManager extends Component {
    start(): void {
        const vs = view.getVisibleSize();
        const canvasUt = this.node.getComponent(UITransform);
        if (canvasUt) {
            canvasUt.setContentSize(vs.width, vs.height);
        }
        const w = this.node.getComponent(Widget);
        if (w) {
            w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
            w.top = w.bottom = w.left = w.right = 0;
            w.updateAlignment();
        }

        const bg = new Node('BattleBg');
        this.node.addChild(bg);
        bg.setSiblingIndex(0);
        const bgUt = bg.addComponent(UITransform);
        bgUt.setContentSize(vs.width, vs.height);
        bgUt.anchorPoint.set(0.5, 0.5);
        const g = bg.addComponent(Graphics);
        g.fillColor = new Color(12, 18, 28, 255);
        g.rect(-vs.width * 0.5, -vs.height * 0.5, vs.width, vs.height);
        g.fill();
        g.fillColor = new Color(28, 42, 58, 120);
        g.roundRect(-vs.width * 0.45, -vs.height * 0.35, vs.width * 0.9, vs.height * 0.5, 12);
        g.fill();

        const title = new Node('Title');
        this.node.addChild(title);
        const tUt = title.addComponent(UITransform);
        tUt.setContentSize(vs.width - 40, 120);
        title.setPosition(0, 120, 0);
        const tLb = title.addComponent(Label);
        tLb.string = '战斗';
        tLb.fontSize = 56;
        tLb.color = new Color(220, 235, 255, 255);
        tLb.enableOutline = true;
        tLb.outlineColor = new Color(0, 0, 0, 220);
        tLb.outlineWidth = 3;

        const sub = new Node('Subtitle');
        this.node.addChild(sub);
        const sUt = sub.addComponent(UITransform);
        sUt.setContentSize(vs.width - 40, 80);
        sub.setPosition(0, 40, 0);
        const sLb = sub.addComponent(Label);
        const nid = GlobalData.instance.mapCurrentNodeId;
        sLb.string = `占位场景 · 当前地图节点 #${nid}\n（正式战斗 UI 之后替换）`;
        sLb.fontSize = 22;
        sLb.lineHeight = 30;
        sLb.color = new Color(160, 180, 205, 255);

        const back = new Node('BtnBackToMap');
        this.node.addChild(back);
        const bUt = back.addComponent(UITransform);
        bUt.setContentSize(280, 52);
        back.setPosition(0, -140, 0);
        const bLb = back.addComponent(Label);
        bLb.string = '← 返回地图';
        bLb.fontSize = 26;
        bLb.color = new Color(120, 220, 190, 255);
        bLb.enableOutline = true;
        bLb.outlineColor = new Color(0, 0, 0, 180);
        bLb.outlineWidth = 2;
        back.on(Node.EventType.TOUCH_END, () => {
            director.loadScene(SCENE_GAME_MAP, (err) => {
                if (err) {
                    console.error('[BattlePlaceholderManager] 返回地图失败', err);
                }
            });
        });
    }
}
