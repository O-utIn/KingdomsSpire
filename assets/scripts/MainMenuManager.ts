import {
    _decorator,
    BlockInputEvents,
    Button,
    Color,
    Component,
    director,
    EventTouch,
    game,
    Graphics,
    Label,
    Node,
    UITransform,
    Vec3,
} from 'cc';
import { GlobalAudioManager } from './GlobalAudioManager';
import { RunHudManager } from './RunHudManager';

const { ccclass } = _decorator;

@ccclass('MainMenuManager')
export class MainMenuManager extends Component {
    private _settingsOverlay: Node | null = null;
    private _toggleLabel: Label | null = null;
    private _volumeLabel: Label | null = null;
    private _volumeFill: Graphics | null = null;

    onLoad(): void {
        RunHudManager.stopRun();
        GlobalAudioManager.playBgm();
        this.node.getChildByName('Btn_Settings')?.on(Button.EventType.CLICK, this.onSettingsClick, this);
    }

    onDestroy(): void {
        this.node.getChildByName('Btn_Settings')?.off(Button.EventType.CLICK, this.onSettingsClick, this);
    }

    public onSinglePlayerClick(): void {
        director.loadScene('CharSelect', (err) => {
            if (err) {
                console.error('跳转选角页面失败', err);
            }
        });
    }

    public onSettingsClick(): void {
        if (this._settingsOverlay?.isValid) {
            this._settingsOverlay.active = true;
            this.refreshSettings();
            return;
        }
        this.createSettingsOverlay();
    }

    public onExitClick(): void {
        game.end();
    }

    private createSettingsOverlay(): void {
        const canvas = this.node.parent;
        if (!canvas) {
            return;
        }

        const overlay = new Node('SettingsOverlay');
        canvas.addChild(overlay);
        overlay.addComponent(BlockInputEvents);
        const overlayTransform = overlay.addComponent(UITransform);
        const canvasSize = canvas.getComponent(UITransform)?.contentSize;
        overlayTransform.setContentSize(canvasSize?.width ?? 1920, canvasSize?.height ?? 1080);
        this.drawRect(overlay, overlayTransform.contentSize.width, overlayTransform.contentSize.height, new Color(0, 0, 0, 175));

        const panel = new Node('SettingsPanel');
        overlay.addChild(panel);
        panel.addComponent(UITransform).setContentSize(620, 410);
        this.drawRect(panel, 620, 410, new Color(28, 35, 48, 250), new Color(205, 166, 92, 255), 4);

        this.addLabel(panel, '设置', 0, 145, 34, new Color(255, 220, 148, 255));
        this.addLabel(panel, '背景音乐', -145, 55, 24, new Color(235, 238, 245, 255));

        const toggle = this.createButton(panel, 'MusicToggle', 155, 55, 180, 54);
        this._toggleLabel = this.addLabel(toggle, '', 0, 0, 22, Color.WHITE);
        toggle.on(Node.EventType.TOUCH_END, () => {
            GlobalAudioManager.setMusicEnabled(!GlobalAudioManager.isMusicEnabled());
            this.refreshSettings();
        });

        this.addLabel(panel, '音量', -190, -35, 24, new Color(235, 238, 245, 255));
        this._volumeLabel = this.addLabel(panel, '', 205, -35, 22, new Color(255, 220, 148, 255));

        const volumeBar = new Node('VolumeBar');
        panel.addChild(volumeBar);
        volumeBar.setPosition(25, -95);
        volumeBar.addComponent(UITransform).setContentSize(390, 44);
        this.drawRect(volumeBar, 390, 16, new Color(68, 77, 92, 255));
        const fillNode = new Node('Fill');
        volumeBar.addChild(fillNode);
        this._volumeFill = fillNode.addComponent(Graphics);
        volumeBar.on(Node.EventType.TOUCH_START, this.onVolumeTouch, this);
        volumeBar.on(Node.EventType.TOUCH_MOVE, this.onVolumeTouch, this);

        const close = this.createButton(panel, 'Close', 0, -160, 180, 54);
        this.addLabel(close, '关闭', 0, 0, 22, Color.WHITE);
        close.on(Node.EventType.TOUCH_END, () => {
            overlay.active = false;
        });

        this._settingsOverlay = overlay;
        this.refreshSettings();
    }

    private onVolumeTouch(event: EventTouch): void {
        const bar = event.currentTarget as Node;
        const transform = bar.getComponent(UITransform);
        if (!transform) {
            return;
        }
        const local = transform.convertToNodeSpaceAR(new Vec3(event.getUILocation().x, event.getUILocation().y));
        GlobalAudioManager.setVolume((local.x + 195) / 390);
        this.refreshSettings();
    }

    private refreshSettings(): void {
        const enabled = GlobalAudioManager.isMusicEnabled();
        const volume = GlobalAudioManager.getVolume();
        if (this._toggleLabel) {
            this._toggleLabel.string = enabled ? '已开启' : '已关闭';
            const graphics = this._toggleLabel.node.parent?.getComponent(Graphics);
            if (graphics) {
                graphics.clear();
                graphics.fillColor = enabled ? new Color(67, 142, 94, 255) : new Color(113, 71, 71, 255);
                graphics.roundRect(-90, -27, 180, 54, 10);
                graphics.fill();
            }
        }
        if (this._volumeLabel) {
            this._volumeLabel.string = `${Math.round(volume * 100)}%`;
        }
        if (this._volumeFill) {
            this._volumeFill.clear();
            if (volume > 0) {
                this._volumeFill.fillColor = new Color(218, 175, 91, 255);
                this._volumeFill.roundRect(-195, -8, 390 * volume, 16, Math.min(8, 195 * volume));
                this._volumeFill.fill();
            }
        }
    }

    private createButton(parent: Node, name: string, x: number, y: number, width: number, height: number): Node {
        const button = new Node(name);
        parent.addChild(button);
        button.setPosition(x, y);
        button.addComponent(UITransform).setContentSize(width, height);
        const graphics = button.addComponent(Graphics);
        graphics.fillColor = new Color(75, 88, 108, 255);
        graphics.roundRect(-width / 2, -height / 2, width, height, 10);
        graphics.fill();
        return button;
    }

    private addLabel(parent: Node, text: string, x: number, y: number, fontSize: number, color: Color): Label {
        const node = new Node('Label');
        parent.addChild(node);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(260, 54);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = fontSize + 8;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        return label;
    }

    private drawRect(node: Node, width: number, height: number, fill: Color, stroke?: Color, lineWidth = 0): void {
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = fill;
        graphics.rect(-width / 2, -height / 2, width, height);
        graphics.fill();
        if (stroke && lineWidth > 0) {
            graphics.strokeColor = stroke;
            graphics.lineWidth = lineWidth;
            graphics.rect(-width / 2, -height / 2, width, height);
            graphics.stroke();
        }
    }
}
