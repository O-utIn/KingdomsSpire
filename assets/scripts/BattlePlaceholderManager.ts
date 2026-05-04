import {
    _decorator,
    Camera,
    Canvas,
    Color,
    Component,
    director,
    Graphics,
    Label,
    Node,
    resources,
    Sprite,
    SpriteFrame,
    UITransform,
    view,
    Widget,
} from 'cc';
import { SCENE_GAME_MAP } from './GameConfig';
import { GlobalData } from './GlobalData';
import type { CharacterPackage, CombatEncounterKind } from './GlobalData';
import { RunHudManager } from './RunHudManager';
import type { CardDef, CardId } from './cards/CardDef';
import { getCardDef } from './cards/CardDef';
import type { CardInstance } from './cards/CardInstance';
import { createCardInstance } from './cards/CardInstance';
import { CombatCardFlow } from './cards/CombatCardFlow';
import { CombatEnergyPool } from './cards/CombatEnergyPool';
import type { EnemyId } from './enemies/EnemyDef';
import { getEnemyDef } from './enemies/EnemyDef';
import { createEnemyInstance, EnemyInstance } from './enemies/EnemyInstance';

const { ccclass } = _decorator;

type BattleState = 'player' | 'enemy' | 'victory' | 'defeat';

interface EnemyView {
    enemy: EnemyInstance;
    root: Node;
    frame: Graphics;
    hpBar: Graphics;
    nameLabel: Label;
    hpLabel: Label;
    blockLabel: Label;
    intentLabel: Label;
}

const BATTLE_BG = 'textures/spire-codex-ui-map-backgrounds/map_middle_underdocks';

const PLAYER_ART_BY_CHAR = [
    'textures/chars/images',
    'textures/chars/moj',
    'textures/chars/small',
] as const;

const FALLBACK_CHARACTERS: CharacterPackage[] = [
    { id: 0, name: '静默猎手', hp: 70, maxHp: 70, gold: 99, relics: [], desc: '来自雾地的致命女猎手。' },
    { id: 1, name: '故障机器人', hp: 75, maxHp: 75, gold: 99, relics: [], desc: '产生了自我意识的自动机械。' },
    { id: 2, name: '铁甲卫士', hp: 80, maxHp: 80, gold: 99, relics: [], desc: '挥舞恶魔之剑的战士。' },
];

const STARTER_DECK_BY_CHAR: CardId[][] = [
    ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'survivor', 'bash'],
    ['strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'bash', 'bash'],
    ['strike', 'strike', 'strike', 'strike', 'strike', 'defend', 'defend', 'defend', 'defend', 'bash'],
];

const REWARD_GOLD: Record<Exclude<CombatEncounterKind, ''>, number> = {
    monster: 15,
    elite: 35,
    boss: 90,
};

function loadSpriteFrame(resourcesPath: string): Promise<SpriteFrame | null> {
    const path = resourcesPath.endsWith('/spriteFrame') ? resourcesPath : `${resourcesPath}/spriteFrame`;
    return new Promise((resolve) => {
        resources.load(path, SpriteFrame, (err, sf) => {
            if (err) {
                console.warn(`[BattlePlaceholderManager] 加载图片失败：${path}`, err);
                resolve(null);
            } else {
                resolve(sf);
            }
        });
    });
}

function paintRoundRect(g: Graphics, w: number, h: number, fill: Color, stroke?: Color, lineWidth = 2): void {
    g.clear();
    g.fillColor = fill;
    g.roundRect(-w * 0.5, -h * 0.5, w, h, 8);
    g.fill();
    if (stroke) {
        g.lineWidth = lineWidth;
        g.strokeColor = stroke;
        g.roundRect(-w * 0.5, -h * 0.5, w, h, 8);
        g.stroke();
    }
}

function encounterTitle(kind: CombatEncounterKind): string {
    if (kind === 'elite') {
        return '精英战';
    }
    if (kind === 'boss') {
        return '首领战';
    }
    return '普通战斗';
}

@ccclass('BattlePlaceholderManager')
export class BattlePlaceholderManager extends Component {
    private readonly _flow = new CombatCardFlow();
    private readonly _energy = new CombatEnergyPool();
    private readonly _enemies: EnemyInstance[] = [];
    private readonly _logLines: string[] = [];

    private _state: BattleState = 'player';
    private _turn = 0;
    private _playerBlock = 0;
    private _selectedEnemyUid = 0;
    private _rewardGold = 0;
    private _settlementShown = false;
    private _encounterKind: CombatEncounterKind = 'monster';

    private _playerHpLabel: Label | null = null;
    private _playerBlockLabel: Label | null = null;
    private _energyLabel: Label | null = null;
    private _logLabel: Label | null = null;
    private _handRoot: Node | null = null;
    private _enemyViews: EnemyView[] = [];

    async start(): Promise<void> {
        this.syncCanvasCameraToScreen();
        this.setupCombatData();
        RunHudManager.startRun();
        await this.buildSceneGraph();
        this.startPlayerTurn(true);
    }

    private syncCanvasCameraToScreen(): void {
        const vs = view.getVisibleSize();
        const canvasUt = this.node.getComponent(UITransform);
        if (canvasUt) {
            canvasUt.setContentSize(vs.width, vs.height);
        }
        const widget = this.node.getComponent(Widget);
        if (widget) {
            widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
            widget.top = widget.bottom = widget.left = widget.right = 0;
            widget.updateAlignment();
        }
        const canvas = this.node.getComponent(Canvas);
        const cam = canvas?.cameraComponent;
        if (cam && cam.projection === Camera.ProjectionType.ORTHO) {
            cam.orthoHeight = Math.max(vs.height * 0.5, 320);
            cam.near = 0;
            cam.far = 2000;
        }
    }

    private setupCombatData(): void {
        const gd = GlobalData.instance;
        this.ensureSelectedCharacter();

        this._encounterKind = gd.pendingEncounterKind || 'monster';
        const enemyIds = this.createEncounterEnemyIds(this._encounterKind, gd.pendingEncounterNodeId);
        this._enemies.length = 0;
        this._enemies.push(...enemyIds.map((id) => createEnemyInstance(id)));
        this._selectedEnemyUid = this.firstAliveEnemy()?.uid ?? 0;

        const deckIds = STARTER_DECK_BY_CHAR[gd.selectedCharId] ?? STARTER_DECK_BY_CHAR[0];
        const deck = deckIds.map((id) => createCardInstance(id));
        this._flow.resetCombat(deck);
        this._energy.perTurn = gd.selectedChar?.relics.includes('relic_a') ? 4 : 3;
        this._logLines.length = 0;
        this.pushLog(`进入${encounterTitle(this._encounterKind)}。`);
    }

    private ensureSelectedCharacter(): CharacterPackage {
        const gd = GlobalData.instance;
        if (gd.selectedChar) {
            return gd.selectedChar;
        }
        const fallback = FALLBACK_CHARACTERS[gd.selectedCharId] ?? FALLBACK_CHARACTERS[0];
        gd.selectedChar = { ...fallback, relics: [...fallback.relics] };
        return gd.selectedChar;
    }

    private createEncounterEnemyIds(kind: CombatEncounterKind, nodeId: number): EnemyId[] {
        if (kind === 'boss') {
            return ['jaw_worm', 'cultist', 'red_louse'];
        }
        if (kind === 'elite') {
            return ['jaw_worm', 'red_louse'];
        }
        const normalPools: EnemyId[][] = [
            ['cultist'],
            ['jaw_worm'],
            ['red_louse', 'red_louse'],
        ];
        const index = Math.abs(nodeId) % normalPools.length;
        return normalPools[index] ?? ['cultist'];
    }

    private async buildSceneGraph(): Promise<void> {
        for (const child of [...this.node.children]) {
            if (child.name !== 'Camera') {
                child.destroy();
            }
        }

        const vs = view.getVisibleSize();
        await this.buildBackground(vs.width, vs.height);
        await this.buildPlayerPanel(vs.width, vs.height);
        this.buildEnemyPanels(vs.width, vs.height);
        this.buildLogPanel(vs.width, vs.height);
        this.buildHandPanel(vs.width, vs.height);
        this.buildEndTurnButton(vs.width, vs.height);
    }

    private async buildBackground(w: number, h: number): Promise<void> {
        const bg = new Node('BattleBackground');
        this.node.addChild(bg);
        bg.setSiblingIndex(0);
        const ut = bg.addComponent(UITransform);
        ut.setContentSize(w, h);
        const sf = await loadSpriteFrame(BATTLE_BG);
        if (sf) {
            const sp = bg.addComponent(Sprite);
            sp.spriteFrame = sf;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.color = new Color(118, 132, 150, 255);
        } else {
            const g = bg.addComponent(Graphics);
            g.fillColor = new Color(18, 24, 32, 255);
            g.rect(-w * 0.5, -h * 0.5, w, h);
            g.fill();
        }

        const shade = new Node('BattleShade');
        this.node.addChild(shade);
        const sUt = shade.addComponent(UITransform);
        sUt.setContentSize(w, h);
        const g = shade.addComponent(Graphics);
        g.fillColor = new Color(8, 10, 14, 122);
        g.rect(-w * 0.5, -h * 0.5, w, h);
        g.fill();
    }

    private async buildPlayerPanel(w: number, h: number): Promise<void> {
        const root = this.makePanel('PlayerPanel', 310, 280, -w * 0.34, -20, new Color(31, 38, 50, 225), new Color(80, 105, 138, 255));
        this.addLabel(root, 'PlayerTitle', 270, 34, 0, 104, 22, new Color(255, 218, 134, 255));

        const artNode = new Node('PlayerArt');
        root.addChild(artNode);
        artNode.setPosition(0, 28, 0);
        const artUt = artNode.addComponent(UITransform);
        artUt.setContentSize(136, 136);
        const artSf = await loadSpriteFrame(PLAYER_ART_BY_CHAR[GlobalData.instance.selectedCharId] ?? PLAYER_ART_BY_CHAR[0]);
        if (artSf) {
            const sp = artNode.addComponent(Sprite);
            sp.spriteFrame = artSf;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
        } else {
            const g = artNode.addComponent(Graphics);
            paintRoundRect(g, 136, 136, new Color(60, 86, 115, 255), new Color(130, 160, 195, 255));
        }

        this._playerHpLabel = this.addLabel(root, 'PlayerHp', 270, 28, 0, -64, 22, new Color(245, 232, 224, 255));
        this._playerBlockLabel = this.addLabel(root, 'PlayerBlock', 270, 28, 0, -95, 20, new Color(190, 225, 255, 255));
        this._energyLabel = this.addLabel(root, 'Energy', 270, 30, 0, -126, 22, new Color(150, 225, 255, 255));
    }

    private buildEnemyPanels(w: number, _h: number): void {
        const root = new Node('EnemyRoot');
        this.node.addChild(root);
        const rootUt = root.addComponent(UITransform);
        rootUt.setContentSize(Math.min(950, w * 0.56), 330);
        root.setPosition(w * 0.16, 20, 0);

        const gap = 260;
        const startX = -gap * (this._enemies.length - 1) * 0.5;
        this._enemyViews = this._enemies.map((enemy, i) => {
            const panel = new Node(`Enemy_${enemy.uid}`);
            root.addChild(panel);
            panel.setPosition(startX + i * gap, 0, 0);
            panel.on(Node.EventType.TOUCH_END, () => this.selectEnemy(enemy.uid), this);

            const ut = panel.addComponent(UITransform);
            ut.setContentSize(220, 260);
            const frame = panel.addComponent(Graphics);

            const avatar = new Node('EnemyAvatar');
            panel.addChild(avatar);
            avatar.setPosition(0, 38, 0);
            const aUt = avatar.addComponent(UITransform);
            aUt.setContentSize(94, 94);
            const aG = avatar.addComponent(Graphics);
            paintRoundRect(aG, 94, 94, new Color(93, 54, 58, 255), new Color(210, 120, 108, 255));
            this.addLabel(avatar, 'AvatarText', 82, 34, 0, 0, 28, new Color(250, 220, 180, 255)).string = '敌';

            const nameLabel = this.addLabel(panel, 'Name', 190, 28, 0, 104, 20, new Color(255, 220, 160, 255));
            const hpLabel = this.addLabel(panel, 'Hp', 180, 24, 0, -32, 18, new Color(238, 238, 238, 255));
            const blockLabel = this.addLabel(panel, 'Block', 180, 24, 0, -58, 17, new Color(180, 222, 255, 255));
            const intentLabel = this.addLabel(panel, 'Intent', 190, 44, 0, -96, 16, new Color(226, 232, 242, 255));

            const hpBarNode = new Node('HpBar');
            panel.addChild(hpBarNode);
            hpBarNode.setPosition(0, -10, 0);
            const hbUt = hpBarNode.addComponent(UITransform);
            hbUt.setContentSize(160, 12);
            const hpBar = hpBarNode.addComponent(Graphics);

            return { enemy, root: panel, frame, hpBar, nameLabel, hpLabel, blockLabel, intentLabel };
        });
    }

    private buildLogPanel(w: number, h: number): void {
        const panel = this.makePanel('BattleLog', 430, 190, w * 0.5 - 245, h * 0.5 - 198, new Color(19, 23, 31, 215), new Color(76, 88, 110, 255));
        this.addLabel(panel, 'LogTitle', 390, 24, 0, 72, 18, new Color(255, 214, 128, 255)).string = '战斗记录';
        this._logLabel = this.addLabel(panel, 'LogText', 390, 128, 0, -16, 16, new Color(219, 226, 236, 255));
        this._logLabel.lineHeight = 21;
    }

    private buildHandPanel(w: number, h: number): void {
        const root = new Node('HandRoot');
        this.node.addChild(root);
        const ut = root.addComponent(UITransform);
        ut.setContentSize(Math.min(1220, w - 260), 240);
        root.setPosition(0, -h * 0.5 + 145, 0);
        this._handRoot = root;
    }

    private buildEndTurnButton(w: number, h: number): void {
        this.makeButton('EndTurnButton', '结束回合', 190, 58, w * 0.5 - 170, -h * 0.5 + 292, () => this.endPlayerTurn());
    }

    private makePanel(name: string, w: number, h: number, x: number, y: number, fill: Color, stroke?: Color): Node {
        const n = new Node(name);
        this.node.addChild(n);
        n.setPosition(x, y, 0);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(w, h);
        const g = n.addComponent(Graphics);
        paintRoundRect(g, w, h, fill, stroke);
        return n;
    }

    private makeButton(name: string, text: string, w: number, h: number, x: number, y: number, onClick: () => void): Node {
        const n = this.makePanel(name, w, h, x, y, new Color(72, 96, 126, 245), new Color(150, 190, 230, 255));
        const lb = this.addLabel(n, 'Label', w - 20, h - 10, 0, 0, 22, new Color(245, 250, 255, 255));
        lb.string = text;
        n.on(Node.EventType.TOUCH_END, onClick, this);
        return n;
    }

    private addLabel(parent: Node, name: string, w: number, h: number, x: number, y: number, fontSize: number, color: Color): Label {
        const n = new Node(name);
        parent.addChild(n);
        n.setPosition(x, y, 0);
        const ut = n.addComponent(UITransform);
        ut.setContentSize(w, h);
        const lb = n.addComponent(Label);
        lb.fontSize = fontSize;
        lb.lineHeight = Math.ceil(fontSize * 1.25);
        lb.color = color;
        lb.horizontalAlign = Label.HorizontalAlign.CENTER;
        lb.verticalAlign = Label.VerticalAlign.CENTER;
        lb.enableWrapText = true;
        return lb;
    }

    private startPlayerTurn(isFirstTurn = false): void {
        if (this._state === 'victory' || this._state === 'defeat') {
            return;
        }
        this._state = 'player';
        this._turn += 1;
        this._playerBlock = 0;
        this._energy.startTurn();
        this._flow.draw(5);
        this.pushLog(isFirstTurn ? '你的回合开始，抽 5 张牌。' : `第 ${this._turn} 回合开始，抽 5 张牌。`);
        this.refreshAll();
    }

    private endPlayerTurn(): void {
        if (this._state !== 'player') {
            return;
        }
        this._state = 'enemy';
        this._flow.discardAllHand();
        this.pushLog('结束回合，弃掉所有手牌。');
        this.runEnemyTurn();
    }

    private runEnemyTurn(): void {
        for (const enemy of this._enemies) {
            if (!enemy.isDead) {
                enemy.block = 0;
            }
        }

        for (const enemy of this._enemies) {
            if (enemy.isDead) {
                continue;
            }
            const def = getEnemyDef(enemy.defId);
            const intent = enemy.currentIntent;
            const name = def?.name ?? enemy.defId;

            if (intent?.damage) {
                const totalDamage = intent.damage + enemy.strength;
                const hpLoss = this.damagePlayer(totalDamage);
                this.pushLog(`${name} 攻击，造成 ${hpLoss}/${totalDamage} 点生命伤害。`);
            }
            if (intent?.block) {
                enemy.addBlock(intent.block);
                this.pushLog(`${name} 获得 ${intent.block} 点格挡。`);
            }
            if (intent?.strength) {
                enemy.strength += intent.strength;
                this.pushLog(`${name} 获得 ${intent.strength} 点力量。`);
            }

            enemy.advanceIntent();
            if (this.ensureSelectedCharacter().hp <= 0) {
                this.finishDefeat();
                return;
            }
        }

        this.startPlayerTurn();
    }

    private tryPlayCard(handIndex: number): void {
        if (this._state !== 'player') {
            return;
        }
        const card = this._flow.hand[handIndex];
        const def = card ? getCardDef(card.defId) : null;
        if (!card || !def) {
            return;
        }

        const target = this.resolveCardTarget(def);
        if ((def.damage ?? 0) > 0 && !target) {
            this.pushLog('没有可攻击的敌人。');
            this.refreshAll();
            return;
        }
        if (!this._energy.spend(def.cost)) {
            this.pushLog(`能量不足，无法打出「${def.name}」。`);
            this.refreshAll();
            return;
        }

        this._flow.playFromHand(handIndex);
        this.applyCardEffect(card, def, target);

        if (this._enemies.every((enemy) => enemy.isDead)) {
            this.finishVictory();
            return;
        }
        if (!this.selectedEnemy()?.isDead) {
            this.refreshAll();
            return;
        }
        this._selectedEnemyUid = this.firstAliveEnemy()?.uid ?? 0;
        this.refreshAll();
    }

    private resolveCardTarget(def: CardDef): EnemyInstance | null {
        if ((def.damage ?? 0) <= 0) {
            return null;
        }
        return this.selectedEnemy() ?? this.firstAliveEnemy();
    }

    private applyCardEffect(_card: CardInstance, def: CardDef, target: EnemyInstance | null): void {
        const parts: string[] = [];
        if (def.damage && target) {
            const hpLoss = target.takeDamage(def.damage);
            const targetName = getEnemyDef(target.defId)?.name ?? target.defId;
            parts.push(`对 ${targetName} 造成 ${hpLoss}/${def.damage} 点生命伤害`);
            if (target.isDead) {
                parts.push(`${targetName} 被击倒`);
            }
        }
        if (def.block) {
            this._playerBlock += def.block;
            parts.push(`获得 ${def.block} 点格挡`);
        }
        this.pushLog(`打出「${def.name}」：${parts.join('，')}。`);
    }

    private damagePlayer(amount: number): number {
        const ch = this.ensureSelectedCharacter();
        let remaining = Math.max(0, amount);
        if (this._playerBlock > 0) {
            const absorbed = Math.min(this._playerBlock, remaining);
            this._playerBlock -= absorbed;
            remaining -= absorbed;
        }
        const hpLoss = Math.min(ch.hp, remaining);
        ch.hp -= hpLoss;
        return hpLoss;
    }

    private finishVictory(): void {
        if (this._state === 'victory') {
            return;
        }
        this._state = 'victory';
        this._flow.discardAllHand();
        const kind = this._encounterKind || 'monster';
        this._rewardGold = REWARD_GOLD[kind as Exclude<CombatEncounterKind, ''>] ?? REWARD_GOLD.monster;
        this.ensureSelectedCharacter().gold += this._rewardGold;
        this.pushLog(`战斗胜利，获得 ${this._rewardGold} 金币。`);
        this.refreshAll();
        this.showSettlement('victory');
    }

    private finishDefeat(): void {
        if (this._state === 'defeat') {
            return;
        }
        this._state = 'defeat';
        this.pushLog('生命归零，战斗失败。');
        this.refreshAll();
        this.showSettlement('defeat');
    }

    private showSettlement(result: 'victory' | 'defeat'): void {
        if (this._settlementShown) {
            return;
        }
        this._settlementShown = true;

        const vs = view.getVisibleSize();
        const overlay = new Node('SettlementOverlay');
        this.node.addChild(overlay);
        const oUt = overlay.addComponent(UITransform);
        oUt.setContentSize(vs.width, vs.height);
        const oG = overlay.addComponent(Graphics);
        oG.fillColor = new Color(0, 0, 0, 165);
        oG.rect(-vs.width * 0.5, -vs.height * 0.5, vs.width, vs.height);
        oG.fill();

        const panel = new Node('SettlementPanel');
        overlay.addChild(panel);
        const pUt = panel.addComponent(UITransform);
        pUt.setContentSize(560, 300);
        const pG = panel.addComponent(Graphics);
        paintRoundRect(pG, 560, 300, new Color(30, 36, 48, 250), new Color(184, 155, 92, 255), 3);

        const title = this.addLabel(panel, 'Title', 500, 56, 0, 96, 38, result === 'victory' ? new Color(255, 218, 120, 255) : new Color(255, 130, 120, 255));
        title.string = result === 'victory' ? '战斗胜利' : '战斗失败';

        const desc = this.addLabel(panel, 'Desc', 500, 90, 0, 22, 22, new Color(230, 236, 246, 255));
        desc.lineHeight = 30;
        desc.string = result === 'victory'
            ? `结算奖励：${this._rewardGold} 金币\n当前金币：${this.ensureSelectedCharacter().gold}`
            : '本轮 MVP 暂不进入死亡结算，可返回地图继续调试流程。';

        const btn = new Node('BackToMap');
        panel.addChild(btn);
        btn.setPosition(0, -92, 0);
        const bUt = btn.addComponent(UITransform);
        bUt.setContentSize(280, 56);
        const bG = btn.addComponent(Graphics);
        paintRoundRect(bG, 280, 56, new Color(78, 108, 138, 255), new Color(170, 215, 255, 255));
        const bLb = this.addLabel(btn, 'Label', 250, 48, 0, 0, 22, new Color(245, 250, 255, 255));
        bLb.string = result === 'victory' ? '领取奖励，返回地图' : '返回地图';
        btn.on(Node.EventType.TOUCH_END, () => this.backToMap(), this);
    }

    private backToMap(): void {
        GlobalData.instance.clearPendingEncounter();
        director.loadScene(SCENE_GAME_MAP, (err) => {
            if (err) {
                console.error('[BattlePlaceholderManager] 返回地图失败', err);
            }
        });
    }

    private selectEnemy(uid: number): void {
        const enemy = this._enemies.find((e) => e.uid === uid);
        if (!enemy || enemy.isDead) {
            return;
        }
        this._selectedEnemyUid = uid;
        this.refreshEnemyViews();
    }

    private firstAliveEnemy(): EnemyInstance | null {
        return this._enemies.find((enemy) => !enemy.isDead) ?? null;
    }

    private selectedEnemy(): EnemyInstance | null {
        const enemy = this._enemies.find((e) => e.uid === this._selectedEnemyUid);
        return enemy && !enemy.isDead ? enemy : null;
    }

    private pushLog(line: string): void {
        this._logLines.unshift(line);
        if (this._logLines.length > 6) {
            this._logLines.length = 6;
        }
    }

    private refreshAll(): void {
        this.refreshRunHud();
        this.refreshPlayerPanel();
        this.refreshEnemyViews();
        this.renderHand();
        this.refreshLog();
    }

    private refreshRunHud(): void {
        const nodeId = GlobalData.instance.pendingEncounterNodeId >= 0
            ? GlobalData.instance.pendingEncounterNodeId
            : GlobalData.instance.mapCurrentNodeId;
        const stateText = this._state === 'player'
            ? '玩家回合'
            : this._state === 'enemy'
                ? '敌方回合'
                : this._state === 'victory'
                    ? '胜利结算'
                    : '失败结算';
        RunHudManager.setCenterText(`${encounterTitle(this._encounterKind)}  |  地图节点 #${nodeId}  |  第 ${this._turn} 回合  |  ${stateText}`);
    }

    private refreshPlayerPanel(): void {
        const ch = this.ensureSelectedCharacter();
        const title = this.node.getChildByName('PlayerPanel')?.getChildByName('PlayerTitle')?.getComponent(Label);
        if (title) {
            title.string = ch.name;
        }
        if (this._playerHpLabel) {
            this._playerHpLabel.string = `生命 ${ch.hp}/${ch.maxHp}`;
        }
        if (this._playerBlockLabel) {
            this._playerBlockLabel.string = `格挡 ${this._playerBlock}`;
        }
        if (this._energyLabel) {
            this._energyLabel.string = `能量 ${this._energy.current}/${this._energy.perTurn}`;
        }
    }

    private refreshEnemyViews(): void {
        for (const viewData of this._enemyViews) {
            const enemy = viewData.enemy;
            const def = getEnemyDef(enemy.defId);
            const selected = enemy.uid === this._selectedEnemyUid && !enemy.isDead;
            const fill = enemy.isDead ? new Color(44, 44, 48, 210) : new Color(45, 36, 42, 232);
            const stroke = selected ? new Color(255, 218, 110, 255) : new Color(130, 82, 82, 255);
            paintRoundRect(viewData.frame, 220, 260, fill, stroke, selected ? 5 : 2);
            viewData.nameLabel.string = enemy.isDead ? `${def?.name ?? enemy.defId}（已击倒）` : def?.name ?? enemy.defId;
            viewData.hpLabel.string = `生命 ${enemy.currentHp}/${enemy.maxHp}`;
            viewData.blockLabel.string = `格挡 ${enemy.block}  力量 ${enemy.strength}`;
            viewData.intentLabel.string = enemy.isDead ? '无意图' : enemy.currentIntentLabel;
            this.paintEnemyHpBar(viewData.hpBar, enemy);
        }
    }

    private paintEnemyHpBar(g: Graphics, enemy: EnemyInstance): void {
        const w = 160;
        const h = 12;
        g.clear();
        g.fillColor = new Color(48, 30, 34, 255);
        g.roundRect(-w * 0.5, -h * 0.5, w, h, 6);
        g.fill();
        const ratio = enemy.maxHp > 0 ? Math.max(0, enemy.currentHp / enemy.maxHp) : 0;
        g.fillColor = new Color(205, 64, 72, 255);
        g.roundRect(-w * 0.5, -h * 0.5, w * ratio, h, 6);
        g.fill();
    }

    private renderHand(): void {
        const root = this._handRoot;
        if (!root) {
            return;
        }
        for (const child of [...root.children]) {
            child.destroy();
        }

        const hand = this._flow.hand;
        if (hand.length === 0) {
            this.addLabel(root, 'EmptyHand', 520, 40, 0, 0, 22, new Color(215, 222, 232, 255)).string = this._state === 'player' ? '没有手牌' : '';
            return;
        }

        const cardW = 172;
        const cardH = 218;
        const gap = 18;
        const totalW = hand.length * cardW + (hand.length - 1) * gap;
        const startX = -totalW * 0.5 + cardW * 0.5;

        hand.forEach((card, index) => {
            const def = getCardDef(card.defId);
            if (!def) {
                return;
            }
            const canPlay = this._state === 'player' && this._energy.current >= def.cost;
            const n = new Node(`Card_${card.uid}`);
            root.addChild(n);
            n.setPosition(startX + index * (cardW + gap), 0, 0);
            const ut = n.addComponent(UITransform);
            ut.setContentSize(cardW, cardH);
            const g = n.addComponent(Graphics);
            const fill = canPlay ? new Color(226, 210, 172, 245) : new Color(122, 118, 110, 230);
            const stroke = canPlay ? new Color(86, 60, 40, 255) : new Color(82, 78, 74, 255);
            paintRoundRect(g, cardW, cardH, fill, stroke);

            this.addLabel(n, 'Cost', 36, 32, -cardW * 0.5 + 28, cardH * 0.5 - 26, 22, new Color(32, 42, 54, 255)).string = `${def.cost}`;
            const nameLb = this.addLabel(n, 'Name', cardW - 54, 32, 18, cardH * 0.5 - 28, 20, new Color(42, 33, 24, 255));
            nameLb.string = def.name;
            nameLb.isBold = true;

            const typeLb = this.addLabel(n, 'Type', cardW - 28, 28, 0, 30, 16, new Color(78, 62, 46, 255));
            typeLb.string = this.cardTypeLabel(def);

            const desc = this.addLabel(n, 'Desc', cardW - 28, 88, 0, -38, 17, new Color(42, 34, 25, 255));
            desc.lineHeight = 24;
            desc.string = def.description;

            if (def.exhaustsOnPlay) {
                this.addLabel(n, 'Exhaust', cardW - 28, 24, 0, -cardH * 0.5 + 24, 14, new Color(120, 52, 42, 255)).string = '消耗';
            }
            n.on(Node.EventType.TOUCH_END, () => this.tryPlayCard(index), this);
        });
    }

    private cardTypeLabel(def: CardDef): string {
        const parts: string[] = [];
        if (def.damage) {
            parts.push(`伤害 ${def.damage}`);
        }
        if (def.block) {
            parts.push(`格挡 ${def.block}`);
        }
        return parts.join(' / ') || '技能';
    }

    private refreshLog(): void {
        if (this._logLabel) {
            this._logLabel.string = this._logLines.join('\n');
        }
    }
}
