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
import { SCENE_GAME_MAP, SCENE_MAIN_MENU } from './GameConfig';
import { GlobalAudioManager } from './GlobalAudioManager';
import { GlobalData } from './GlobalData';
import type { CharacterPackage, CombatEncounterKind } from './GlobalData';
import { getRelicDefs, getStarterRelicsForCharacter } from './relics/RelicDef';
import type { RelicDef } from './relics/RelicDef';
import { RunHudManager } from './RunHudManager';
import type { CardDef, CardId, ShadowId } from './cards/CardDef';
import { getCardDef, isDescentCard } from './cards/CardDef';
import type { CardInstance } from './cards/CardInstance';
import { createCardInstance } from './cards/CardInstance';
import { CombatCardFlow } from './cards/CombatCardFlow';
import { CombatEnergyPool } from './cards/CombatEnergyPool';
import { getStarterDeckForCharacter } from './cards/StarterDeck';
import type { EnemyId } from './enemies/EnemyDef';
import { getEnemyDef } from './enemies/EnemyDef';
import { createEnemyInstance, EnemyInstance } from './enemies/EnemyInstance';

const { ccclass } = _decorator;

type BattleState = 'player' | 'enemy' | 'victory' | 'defeat';

const DESCENT_CYCLE_IDS: CardId[] = ['descent_wusheng', 'descent_wolong', 'descent_wushuang'];

const SHADOW_NAME: Record<ShadowId, string> = {
    spirit: '虚影',
    wusheng: '武圣',
    wolong: '卧龙',
    wushuang: '无双',
};

const SHADOW_ART: Partial<Record<ShadowId, string>> = {
    wusheng: 'textures/chars/Phantom/guanyu',
    wolong: 'textures/chars/Phantom/zhuge',
    wushuang: 'textures/chars/Phantom/zhaoyun',
};

const CARD_DESCRIPTION_LINE_COLUMNS = 9;

interface EnemyView {
    enemy: EnemyInstance;
    root: Node;
    frame: Graphics;
    frameW: number;
    frameH: number;
    hpBar: Graphics;
    nameLabel: Label;
    hpLabel: Label;
    blockLabel: Label;
    intentLabel: Label;
}

const BATTLE_BG = 'textures/spire-codex-ui-map-backgrounds/map_middle_underdocks';

const PLAYER_ART_BY_CHAR = [
    'textures/chars/character_battle',
    'textures/chars/moj_battle',
    'textures/chars/small_battle',
] as const;

const FALLBACK_CHARACTERS: CharacterPackage[] = [
    { id: 0, name: '静默猎手', hp: 70, maxHp: 70, gold: 99, relics: getStarterRelicsForCharacter(0), desc: '来自雾地的致命女猎手。' },
    { id: 1, name: '故障机器人', hp: 75, maxHp: 75, gold: 99, relics: getStarterRelicsForCharacter(1), desc: '产生了自我意识的自动机械。' },
    { id: 2, name: '铁甲卫士', hp: 80, maxHp: 80, gold: 99, relics: getStarterRelicsForCharacter(2), desc: '挥舞恶魔之剑的战士。' },
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
    private _firstHpLossImmuneReady = false;
    private _activeShadow: ShadowId | null = null;
    private _playerStrength = 0;
    private _nextTurnEnergyCapBonus = 0;
    private _firstDescentCoverUsedThisTurn = false;
    private _hasTacticalTerrain = false;
    private _playerVulnerableTurns = 0;
    private _playerFrailTurns = 0;
    private _zhouyuFlameLevel = 0;
    private _zhouyuFlameGrowthThisTurn = 0;
    private _finalRunSettlement = false;
    private _killCountThisBattle = 0;
    private _nextDescentCycleIndex = 0;
    private readonly _countedDeadEnemyUids = new Set<number>();

    private _playerHpLabel: Label | null = null;
    private _playerBlockLabel: Label | null = null;
    private _energyLabel: Label | null = null;
    private _shadowSprite: Sprite | null = null;
    private _shadowLabel: Label | null = null;
    private _logLabel: Label | null = null;
    private _handRoot: Node | null = null;
    private _relicTooltip: Node | null = null;
    private _relicTooltipTitle: Label | null = null;
    private _relicTooltipDesc: Label | null = null;
    private _enemyViews: EnemyView[] = [];

    async start(): Promise<void> {
        this.syncCanvasCameraToScreen();
        this.setupCombatData();
        GlobalAudioManager.playRunBgm();
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

        const deckIds = gd.deckIds.length > 0 ? gd.deckIds : getStarterDeckForCharacter(gd.selectedCharId);
        gd.deckIds = [...deckIds];
        gd.deckCount = deckIds.length;
        const deck = deckIds.map((id) => createCardInstance(id));
        this._flow.resetCombat(deck);
        this._energy.perTurn = 3;
        this._firstHpLossImmuneReady = this.relicDefs().some((relic) => !!relic.effects.firstHpLossImmune);
        this._activeShadow = null;
        this._playerStrength = 0;
        this._nextTurnEnergyCapBonus = 0;
        this._firstDescentCoverUsedThisTurn = false;
        this._hasTacticalTerrain = false;
        this._playerVulnerableTurns = 0;
        this._playerFrailTurns = 0;
        this._zhouyuFlameLevel = 0;
        this._zhouyuFlameGrowthThisTurn = 0;
        this._finalRunSettlement = false;
        this._killCountThisBattle = 0;
        this._nextDescentCycleIndex = 0;
        this._countedDeadEnemyUids.clear();
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
            return Math.abs(nodeId + GlobalData.instance.selectedCharId) % 2 === 0
                ? ['cao_cao_warlord']
                : ['zhouyu_grand_duke'];
        }
        if (kind === 'elite') {
            return Math.abs(nodeId) % 2 === 0 ? ['xiahoudun_blind'] : ['ganning_raider'];
        }
        const normalPools: EnemyId[][] = [
            ['cultist'],
            ['jaw_worm'],
            ['red_louse', 'red_louse'],
            ['tiger_leopard_rider', 'red_louse'],
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
        this._relicTooltip = null;
        this._relicTooltipTitle = null;
        this._relicTooltipDesc = null;

        const vs = view.getVisibleSize();
        await this.buildBackground(vs.width, vs.height);
        await this.buildPlayerPanel(vs.width, vs.height);
        await this.buildRelicIcons(vs.width, vs.height);
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
        const root = this.makePanel('PlayerPanel', 330, 380, -w * 0.34, -10, new Color(31, 38, 50, 225), new Color(80, 105, 138, 255));
        this.addLabel(root, 'PlayerTitle', 270, 34, 0, 132, 22, new Color(255, 218, 134, 255));

        const artNode = new Node('PlayerArt');
        root.addChild(artNode);
        artNode.setPosition(-72, 54, 0);
        const artUt = artNode.addComponent(UITransform);
        artUt.setContentSize(118, 118);
        const artSf = await loadSpriteFrame(PLAYER_ART_BY_CHAR[GlobalData.instance.selectedCharId] ?? PLAYER_ART_BY_CHAR[0]);
        if (artSf) {
            const sp = artNode.addComponent(Sprite);
            sp.spriteFrame = artSf;
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
        } else {
            const g = artNode.addComponent(Graphics);
            paintRoundRect(g, 118, 118, new Color(60, 86, 115, 255), new Color(130, 160, 195, 255));
        }

        const shadowNode = new Node('ShadowArt');
        root.addChild(shadowNode);
        shadowNode.setPosition(80, 54, 0);
        const shadowUt = shadowNode.addComponent(UITransform);
        shadowUt.setContentSize(118, 118);
        const shadowBg = shadowNode.addComponent(Graphics);
        paintRoundRect(shadowBg, 118, 118, new Color(18, 22, 30, 180), new Color(126, 148, 170, 220));
        const shadowSpriteNode = new Node('Sprite');
        shadowNode.addChild(shadowSpriteNode);
        const shadowSpriteUt = shadowSpriteNode.addComponent(UITransform);
        shadowSpriteUt.setContentSize(112, 112);
        this._shadowSprite = shadowSpriteNode.addComponent(Sprite);
        this._shadowSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this._shadowSprite.node.active = false;
        this._shadowLabel = this.addLabel(shadowNode, 'ShadowText', 104, 30, 0, -46, 16, new Color(210, 222, 236, 255));
        this._shadowLabel.string = '无虚影';

        this._playerHpLabel = this.addLabel(root, 'PlayerHp', 270, 28, 0, -24, 22, new Color(245, 232, 224, 255));
        this._playerBlockLabel = this.addLabel(root, 'PlayerBlock', 270, 28, 0, -112, 20, new Color(190, 225, 255, 255));
        this._energyLabel = this.addLabel(root, 'Energy', 270, 30, 0, -143, 22, new Color(150, 225, 255, 255));
    }

    private async buildRelicIcons(w: number, h: number): Promise<void> {
        const defs = this.relicDefs();
        const root = new Node('BattleRelicBar');
        this.node.addChild(root);
        const barX = -w * 0.5 + 92;
        const barY = h * 0.5 - 118;
        root.setPosition(barX, barY, 0);
        const rootUt = root.addComponent(UITransform);
        rootUt.setContentSize(360, 54);

        if (defs.length === 0) {
            this.addLabel(root, 'EmptyRelics', 240, 32, 0, 0, 16, new Color(192, 202, 216, 255)).string = '遗物：无';
            return;
        }

        const iconSize = 42;
        const gap = 12;
        const visibleDefs = defs.slice(0, 8);
        const startX = iconSize * 0.5;

        for (let i = 0; i < visibleDefs.length; i++) {
            const def = visibleDefs[i];
            const slot = new Node(`Relic_${def.id}`);
            root.addChild(slot);
            const slotX = startX + i * (iconSize + gap);
            slot.setPosition(slotX, 0, 0);
            const ut = slot.addComponent(UITransform);
            ut.setContentSize(iconSize + 6, iconSize + 6);
            const bg = slot.addComponent(Graphics);
            paintRoundRect(bg, iconSize + 6, iconSize + 6, new Color(18, 22, 30, 225), new Color(176, 148, 86, 255), 2);
            slot.on(Node.EventType.MOUSE_ENTER, () => this.showRelicTooltip(def, barX + slotX, barY, w, h), this);
            slot.on(Node.EventType.MOUSE_LEAVE, () => this.hideRelicTooltip(), this);
            slot.on(Node.EventType.TOUCH_START, () => this.showRelicTooltip(def, barX + slotX, barY, w, h), this);
            slot.on(Node.EventType.TOUCH_END, () => this.hideRelicTooltip(), this);
            slot.on(Node.EventType.TOUCH_CANCEL, () => this.hideRelicTooltip(), this);

            const icon = new Node('Icon');
            slot.addChild(icon);
            const iconUt = icon.addComponent(UITransform);
            iconUt.setContentSize(iconSize, iconSize);
            const sf = await loadSpriteFrame(def.iconPath);
            if (sf) {
                const sp = icon.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                sp.spriteFrame = sf;
                iconUt.setContentSize(iconSize, iconSize);
            } else {
                this.addLabel(icon, 'Fallback', iconSize, iconSize, 0, 0, 16, new Color(255, 218, 120, 255)).string = def.name.slice(0, 1);
            }
        }
    }

    private showRelicTooltip(def: RelicDef, iconX: number, iconY: number, w: number, h: number): void {
        const tooltip = this.ensureRelicTooltip();
        const tooltipW = 320;
        const tooltipH = 94;
        const minX = -w * 0.5 + tooltipW * 0.5 + 18;
        const maxX = w * 0.5 - tooltipW * 0.5 - 18;
        const x = Math.min(maxX, Math.max(minX, iconX + tooltipW * 0.5 + 32));
        const minY = -h * 0.5 + tooltipH * 0.5 + 18;
        const maxY = h * 0.5 - 76 - tooltipH * 0.5;
        const y = Math.min(maxY, Math.max(minY, iconY - tooltipH * 0.5 - 18));

        tooltip.setPosition(x, y, 0);
        tooltip.active = true;
        tooltip.setSiblingIndex(this.node.children.length - 1);

        if (this._relicTooltipTitle) {
            this._relicTooltipTitle.string = def.name;
        }
        if (this._relicTooltipDesc) {
            this._relicTooltipDesc.string = def.description;
        }
    }

    private hideRelicTooltip(): void {
        if (this._relicTooltip) {
            this._relicTooltip.active = false;
        }
    }

    private ensureRelicTooltip(): Node {
        if (this._relicTooltip && this._relicTooltip.isValid) {
            return this._relicTooltip;
        }

        const tooltipW = 320;
        const tooltipH = 94;
        const tooltip = new Node('RelicTooltip');
        this.node.addChild(tooltip);
        tooltip.active = false;
        const ut = tooltip.addComponent(UITransform);
        ut.setContentSize(tooltipW, tooltipH);
        const g = tooltip.addComponent(Graphics);
        paintRoundRect(g, tooltipW, tooltipH, new Color(18, 22, 30, 242), new Color(214, 176, 96, 255), 2);

        this._relicTooltipTitle = this.addLabel(tooltip, 'Title', tooltipW - 28, 30, 0, 24, 20, new Color(255, 218, 128, 255));
        this._relicTooltipTitle.horizontalAlign = Label.HorizontalAlign.LEFT;
        this._relicTooltipTitle.overflow = Label.Overflow.CLAMP;
        this._relicTooltipTitle.enableWrapText = false;
        this._relicTooltipTitle.isBold = true;
        this._relicTooltipTitle.node.getComponent(UITransform)?.setContentSize(tooltipW - 28, 30);
        this._relicTooltipDesc = this.addLabel(tooltip, 'Desc', tooltipW - 28, 46, 0, -18, 16, new Color(225, 232, 244, 255));
        this._relicTooltipDesc.horizontalAlign = Label.HorizontalAlign.LEFT;
        this._relicTooltipDesc.overflow = Label.Overflow.CLAMP;
        this._relicTooltipDesc.enableWrapText = true;
        this._relicTooltipDesc.lineHeight = 22;
        this._relicTooltipDesc.node.getComponent(UITransform)?.setContentSize(tooltipW - 28, 46);

        this._relicTooltip = tooltip;
        return tooltip;
    }

    private buildEnemyPanels(w: number, _h: number): void {
        const root = new Node('EnemyRoot');
        this.node.addChild(root);
        const rootUt = root.addComponent(UITransform);
        rootUt.setContentSize(Math.min(1080, w * 0.62), 420);
        root.setPosition(w * 0.16, 20, 0);

        const gap = this._enemies.some((enemy) => getEnemyDef(enemy.defId)?.tier === 'boss') ? 310 : 260;
        const startX = -gap * (this._enemies.length - 1) * 0.5;
        this._enemyViews = this._enemies.map((enemy, i) => {
            const isBoss = getEnemyDef(enemy.defId)?.tier === 'boss';
            const frameW = isBoss ? 340 : 220;
            const frameH = isBoss ? 430 : 260;
            const panel = new Node(`Enemy_${enemy.uid}`);
            root.addChild(panel);
            panel.setPosition(startX + i * gap, 0, 0);
            panel.on(Node.EventType.TOUCH_END, () => this.selectEnemy(enemy.uid), this);

            const ut = panel.addComponent(UITransform);
            ut.setContentSize(frameW, frameH);
            const frame = panel.addComponent(Graphics);

            const avatar = new Node('EnemyAvatar');
            panel.addChild(avatar);
            avatar.setPosition(0, isBoss ? 82 : 36, 0);
            const aUt = avatar.addComponent(UITransform);
            const avatarW = isBoss ? 270 : 94;
            const avatarH = isBoss ? 390 : 94;
            aUt.setContentSize(avatarW, avatarH);
            const aG = avatar.addComponent(Graphics);
            if (!isBoss) {
                paintRoundRect(aG, avatarW, avatarH, new Color(93, 54, 58, 255), new Color(210, 120, 108, 255));
            }
            const avatarText = this.addLabel(avatar, 'AvatarText', avatarW - 12, 34, 0, 0, 28, new Color(250, 220, 180, 255));
            avatarText.string = '敌';
            this.tryLoadEnemyArt(avatar, enemy.defId, avatarW, avatarH, avatarText);

            const nameLabel = this.addLabel(panel, 'Name', frameW - 30, 28, 0, isBoss ? -126 : 104, 20, new Color(255, 220, 160, 255));
            const hpLabel = this.addLabel(panel, 'Hp', frameW - 40, 24, 0, isBoss ? -154 : -32, 18, new Color(238, 238, 238, 255));
            const blockLabel = this.addLabel(panel, 'Block', frameW - 40, 24, 0, isBoss ? -180 : -58, 17, new Color(180, 222, 255, 255));
            const intentLabel = this.addLabel(panel, 'Intent', frameW + (isBoss ? 120 : -30), isBoss ? 56 : 44, 0, isBoss ? -224 : -96, 16, new Color(226, 232, 242, 255));
            if (isBoss) {
                intentLabel.lineHeight = 22;
            }

            const hpBarNode = new Node('HpBar');
            panel.addChild(hpBarNode);
            hpBarNode.setPosition(0, isBoss ? -106 : -10, 0);
            const hbUt = hpBarNode.addComponent(UITransform);
            hbUt.setContentSize(isBoss ? 230 : 160, 12);
            const hpBar = hpBarNode.addComponent(Graphics);

            return { enemy, root: panel, frame, frameW, frameH, hpBar, nameLabel, hpLabel, blockLabel, intentLabel };
        });
    }

    private tryLoadEnemyArt(parent: Node, defId: EnemyId, width: number, height: number, fallbackLabel: Label): void {
        const artPath = getEnemyDef(defId)?.artPath;
        if (!artPath) {
            return;
        }
        const artNode = new Node('EnemyArt');
        parent.addChild(artNode);
        const artUt = artNode.addComponent(UITransform);
        artUt.setContentSize(width, height);
        const sprite = artNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        loadSpriteFrame(artPath).then((sf) => {
            if (!sf || !artNode.isValid) {
                return;
            }
            sprite.spriteFrame = sf;
            fallbackLabel.node.active = false;
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
        this._firstDescentCoverUsedThisTurn = false;
        this._flow.resetTemporaryCosts();
        this._energy.perTurn = 3 + this._nextTurnEnergyCapBonus;
        if (this._nextTurnEnergyCapBonus > 0) {
            this.pushLog(`无双离场生效，本回合能量上限 +${this._nextTurnEnergyCapBonus}。`);
            this._nextTurnEnergyCapBonus = 0;
        }
        this._energy.startTurn();
        this._flow.draw(5);
        this.pushLog(isFirstTurn ? '你的回合开始，抽 5 张牌。' : `第 ${this._turn} 回合开始，抽 5 张牌。`);
        if (isFirstTurn) {
            const energyBonus = this.startCombatEnergyBonus();
            if (energyBonus > 0) {
                this._energy.add(energyBonus);
                this.pushLog(`能量核心生效，额外获得 ${energyBonus} 点能量。`);
            }
        }
        this.refreshAll();
    }

    private endPlayerTurn(): void {
        if (this._state !== 'player') {
            return;
        }
        this._state = 'enemy';
        this.leaveShadow(true, '回合结束');
        this._flow.discardAllHand();
        this.pushLog('结束回合，弃掉所有手牌。');
        this.runEnemyTurn();
    }

    private runEnemyTurn(): void {
        this._zhouyuFlameGrowthThisTurn = 0;
        for (const enemy of this._enemies) {
            if (!enemy.isDead) {
                enemy.block = 0;
            }
        }

        for (const enemy of [...this._enemies]) {
            if (enemy.isDead) {
                continue;
            }
            const def = getEnemyDef(enemy.defId);
            const intent = enemy.currentIntent;
            const name = def?.name ?? enemy.defId;

            if (intent?.damage) {
                const hits = Math.max(1, intent.hits ?? 1);
                const damagePerHit = intent.damage + enemy.strength;
                let totalHpLoss = 0;
                for (let i = 0; i < hits; i++) {
                    totalHpLoss += this.damagePlayer(damagePerHit);
                    if (this.ensureSelectedCharacter().hp <= 0) {
                        break;
                    }
                }
                const totalDamage = damagePerHit * hits;
                const hitText = hits > 1 ? `，攻击 ${hits} 次` : '';
                this.pushLog(`${name} 攻击${hitText}，造成 ${totalHpLoss}/${totalDamage} 点生命伤害。`);
            }
            if (intent?.block) {
                enemy.addBlock(intent.block);
                this.pushLog(`${name} 获得 ${intent.block} 点格挡。`);
            }
            if (intent?.summons?.length) {
                const summoned = this.summonEnemies(intent.summons, intent.summonLimitPerId);
                if (summoned > 0) {
                    this.pushLog(`${name} 召唤了 ${summoned} 名援军。`);
                    this.rebuildEnemyPanels();
                } else if (intent.strength) {
                    const buffed = this.addFactionStrength(enemy.defId, intent.strength);
                    this.pushLog(`${name} 号令全军，${buffed} 名友军获得 ${intent.strength} 点力量。`);
                }
            } else if (intent?.strength) {
                enemy.strength += intent.strength;
                this.pushLog(`${name} 获得 ${intent.strength} 点力量。`);
            }
            if (intent?.playerDebuff) {
                this.pushLog(`${name} 施加 ${intent.playerDebuff}。`);
            }
            if (intent?.statusCards) {
                this.pushLog(`${name} 将 ${intent.statusCards} 加入战斗压力（状态牌效果待接入）。`);
            }

            if (intent?.playerVulnerable) {
                this._playerVulnerableTurns = Math.max(this._playerVulnerableTurns, intent.playerVulnerable + 1);
                this.pushLog('曹操施加虚弱：下一次敌方回合受到的伤害提高 50%。');
            }
            if (intent?.playerFrail) {
                this._playerFrailTurns = Math.max(this._playerFrailTurns, intent.playerFrail + 1);
                this.pushLog('周瑜施加铁索：下一回合获得的格挡降低 25%。');
            }
            if (intent?.flameGrowth) {
                this._zhouyuFlameGrowthThisTurn += intent.flameGrowth;
            }

            enemy.advanceIntent();
            if (this.ensureSelectedCharacter().hp <= 0) {
                this.finishDefeat();
                return;
            }
        }

        this.applyBossPassives();
        if (this.ensureSelectedCharacter().hp <= 0) {
            this.finishDefeat();
            return;
        }
        this._playerVulnerableTurns = Math.max(0, this._playerVulnerableTurns - 1);
        this._playerFrailTurns = Math.max(0, this._playerFrailTurns - 1);
        this.startPlayerTurn();
    }

    private applyBossPassives(): void {
        const caoCao = this._enemies.find((enemy) => enemy.defId === 'cao_cao_warlord' && !enemy.isDead);
        if (caoCao && !this._activeShadow) {
            const before = caoCao.currentHp;
            caoCao.heal(3);
            caoCao.addBlock(2);
            this.pushLog(`曹操发动“宁我负人”：恢复 ${caoCao.currentHp - before} 点生命并获得 2 点格挡。`);
        }

        const zhouYu = this._enemies.find((enemy) => enemy.defId === 'zhouyu_grand_duke' && !enemy.isDead);
        if (zhouYu) {
            this._zhouyuFlameLevel = Math.min(4, this._zhouyuFlameLevel + 1 + this._zhouyuFlameGrowthThisTurn);
            const hpLoss = this.losePlayerHp(this._zhouyuFlameLevel);
            this.pushLog(`周瑜借东风，业火提升至 ${this._zhouyuFlameLevel} 层并造成 ${hpLoss} 点生命流失。`);
        }
    }

    private summonEnemies(ids: readonly EnemyId[], limitPerId = 2): number {
        let summoned = 0;
        for (const id of ids) {
            if (this.countAliveEnemiesByDefId(id) >= limitPerId) {
                continue;
            }
            this._enemies.push(createEnemyInstance(id));
            summoned += 1;
        }
        if (summoned > 0 && !this.selectedEnemy()) {
            this._selectedEnemyUid = this.firstAliveEnemy()?.uid ?? 0;
        }
        return summoned;
    }

    private countAliveEnemiesByDefId(id: EnemyId): number {
        return this._enemies.filter((enemy) => enemy.defId === id && !enemy.isDead).length;
    }

    private addFactionStrength(sourceDefId: EnemyId, amount: number): number {
        const sourceFaction = getEnemyDef(sourceDefId)?.faction;
        let buffed = 0;
        for (const enemy of this._enemies) {
            const def = getEnemyDef(enemy.defId);
            const isSameFaction = sourceFaction ? def?.faction === sourceFaction : enemy.defId === sourceDefId;
            if (!enemy.isDead && isSameFaction) {
                enemy.strength += amount;
                buffed += 1;
            }
        }
        return buffed;
    }

    private rebuildEnemyPanels(): void {
        this.node.getChildByName('EnemyRoot')?.destroy();
        const vs = view.getVisibleSize();
        this.buildEnemyPanels(vs.width, vs.height);
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
        const damageTargets = this.resolveDamageTargets(def, target);
        if (this.effectiveDamage(def) > 0 && damageTargets.length === 0) {
            this.pushLog('没有可攻击的敌人。');
            this.refreshAll();
            return;
        }
        const cost = this.cardCost(card, def);
        if (!this._energy.spend(cost)) {
            this.pushLog(`能量不足，无法打出「${def.name}」。`);
            this.refreshAll();
            return;
        }

        this._flow.playFromHand(handIndex);
        this.applyCardEffect(card, def, target, damageTargets);

        if (this.isDefeated()) {
            return;
        }
        if (this._enemies.every((enemy) => enemy.isDead)) {
            this.finishVictory();
            return;
        }
        if (this.selectedEnemy()) {
            this.refreshAll();
            return;
        }
        this._selectedEnemyUid = this.firstAliveEnemy()?.uid ?? 0;
        this.refreshAll();
    }

    private resolveCardTarget(def: CardDef): EnemyInstance | null {
        if (this.effectiveDamage(def) <= 0) {
            return null;
        }
        return this.selectedEnemy() ?? this.firstAliveEnemy();
    }

    private applyCardEffect(_card: CardInstance, def: CardDef, target: EnemyInstance | null, damageTargets: EnemyInstance[]): void {
        const parts: string[] = [];
        const wolongWasActive = this._activeShadow === 'wolong';
        let shouldFinishDefeat = false;

        if (def.forcesShadowLeave) {
            if (this._activeShadow) {
                this.leaveShadow(true, '过河拆桥');
                parts.push('强制虚影离场');
            } else {
                parts.push('当前没有虚影');
            }
        }

        const damage = this.effectiveDamage(def);
        if (damage > 0) {
            for (const enemy of damageTargets) {
                const wasDead = enemy.isDead;
                const hpLoss = enemy.takeDamage(damage);
                const targetName = getEnemyDef(enemy.defId)?.name ?? enemy.defId;
                parts.push(`对 ${targetName} 造成 ${hpLoss}/${damage} 点生命伤害`);
                if (!wasDead && enemy.isDead && this.recordEnemyKill(enemy)) {
                    parts.push(`${targetName} 被击倒`);
                }
            }
        }

        const block = this.effectiveBlock(def);
        if (block > 0) {
            this._playerBlock += block;
            parts.push(`获得 ${block} 点格挡`);
        }

        const drawCount = this.effectiveDraw(def);
        if (drawCount > 0) {
            const drawn = this._flow.draw(drawCount).length;
            parts.push(`抽 ${drawn} 张牌`);
        }

        if (def.hpLoss) {
            const hpLoss = this.losePlayerHp(def.hpLoss);
            parts.push(`失去 ${hpLoss} 点生命`);
            shouldFinishDefeat = this.ensureSelectedCharacter().hp <= 0;
        }

        if (shouldFinishDefeat) {
            this.pushLog(`打出「${def.name}」：${parts.join('，')}。`);
            this.finishDefeat();
            return;
        }

        if (def.createsRandomDescent) {
            const created = this.createNextDescentCard();
            parts.push(`生成「${getCardDef(created.defId)?.name ?? created.defId}」`);
        }

        if (def.grantsPower === 'tactical_terrain') {
            this._hasTacticalTerrain = true;
            parts.push('兵势险要常驻');
        }

        if (def.descentShadow) {
            this.coverShadow(def.descentShadow);
            parts.push(`覆盖为【${SHADOW_NAME[def.descentShadow]}】`);
        }

        if (wolongWasActive && def.type === 'skill') {
            const reduced = this.reduceDescentCostsInHand();
            if (reduced > 0) {
                parts.push(`卧龙使 ${reduced} 张【降临】费用 -1`);
            }
        }

        if (parts.length === 0) {
            parts.push('没有直接效果');
        }
        this.pushLog(`打出「${def.name}」：${parts.join('，')}。`);
    }

    private cardCost(card: CardInstance, def: CardDef): number {
        return Math.max(0, card.temporaryCost ?? def.cost);
    }

    private effectiveDamage(def: CardDef): number {
        if (!def.forcesShadowLeave && this._activeShadow === 'wushuang' && (def.block ?? 0) > 0) {
            return def.block! + 5 + this._playerStrength;
        }
        const base = def.damage ?? 0;
        if (base <= 0) {
            return 0;
        }
        const shadowBonus = this._activeShadow === 'wusheng' && def.type === 'attack' ? 2 : 0;
        return base + shadowBonus + this._playerStrength;
    }

    private effectiveBlock(def: CardDef): number {
        if (!def.forcesShadowLeave && this._activeShadow === 'wushuang') {
            return 0;
        }
        const block = def.block ?? 0;
        return this._playerFrailTurns > 0 ? Math.floor(block * 0.75) : block;
    }

    private effectiveDraw(def: CardDef): number {
        if (this._activeShadow && def.drawIfShadow !== undefined) {
            return def.drawIfShadow;
        }
        return def.draw ?? 0;
    }

    private resolveDamageTargets(def: CardDef, target: EnemyInstance | null): EnemyInstance[] {
        if (this.effectiveDamage(def) <= 0) {
            return [];
        }
        if (def.damageAllEnemies || (this._activeShadow === 'wusheng' && def.type === 'attack')) {
            return this._enemies.filter((enemy) => !enemy.isDead);
        }
        return target ? [target] : [];
    }

    private coverShadow(next: ShadowId): void {
        const previous = this._activeShadow;
        if (previous) {
            this.leaveShadow(true, '降临覆盖');
        }
        this._activeShadow = next;
        if (!this._firstDescentCoverUsedThisTurn) {
            this._firstDescentCoverUsedThisTurn = true;
            const energy = this.firstDescentCoverEnergyBonus();
            const draw = this.firstDescentCoverDrawBonus();
            if (energy > 0 || draw > 0) {
                this._energy.add(energy);
                const drawn = this._flow.draw(draw).length;
                this.pushLog(`引魂灯生效，获得 ${energy} 能量并抽 ${drawn} 张牌。`);
            }
        }
        if (previous) {
            this.pushLog(`【${SHADOW_NAME[previous]}】离场，【${SHADOW_NAME[next]}】降临。`);
        }
    }

    private leaveShadow(isReplacement: boolean, source: string): void {
        const leaving = this._activeShadow;
        if (!leaving) {
            return;
        }
        this._activeShadow = null;
        this.applyShadowLeaveEffect(leaving);
        if (isReplacement) {
            this.triggerTacticalTerrain(source);
        }
    }

    private applyShadowLeaveEffect(shadow: ShadowId): void {
        if (shadow === 'wusheng') {
            this._playerStrength += 1;
            this.pushLog('武圣离场：获得 1 层力量。');
        } else if (shadow === 'wolong') {
            this._playerBlock += 5;
            this.pushLog('卧龙离场：获得 5 点格挡。');
        } else if (shadow === 'wushuang') {
            this._nextTurnEnergyCapBonus += 2;
            this.pushLog('无双离场：下回合能量上限 +2。');
        } else {
            this.pushLog('虚影离场。');
        }
    }

    private triggerTacticalTerrain(source: string): void {
        if (!this._hasTacticalTerrain) {
            return;
        }
        if (this._flow.hand.length === 0) {
            this.pushLog(`兵势险要因${source}触发，但没有手牌可弃。`);
            return;
        }
        const discarded = this._flow.hand[0];
        const discardedName = getCardDef(discarded.defId)?.name ?? discarded.defId;
        this._flow.discardFromHand(0);
        this._energy.add(1);
        const drawn = this._flow.draw(1).length;
        this.pushLog(`兵势险要触发，弃掉「${discardedName}」，获得 1 能量并抽 ${drawn} 张牌。`);
    }

    private reduceDescentCostsInHand(): number {
        let changed = 0;
        for (const card of this._flow.hand) {
            const def = getCardDef(card.defId);
            if (!def || !isDescentCard(def)) {
                continue;
            }
            const current = this.cardCost(card, def);
            const next = Math.max(0, current - 1);
            if (next !== current) {
                card.temporaryCost = next;
                changed += 1;
            }
        }
        return changed;
    }

    private createNextDescentCard(): CardInstance {
        const id = DESCENT_CYCLE_IDS[this._nextDescentCycleIndex % DESCENT_CYCLE_IDS.length] ?? DESCENT_CYCLE_IDS[0];
        this._nextDescentCycleIndex = (this._nextDescentCycleIndex + 1) % DESCENT_CYCLE_IDS.length;
        const card = createCardInstance(id);
        card.temporaryCost = 0;
        this._flow.addToHand(card);
        return card;
    }

    private recordEnemyKill(enemy: EnemyInstance): boolean {
        if (this._countedDeadEnemyUids.has(enemy.uid)) {
            return false;
        }
        this._countedDeadEnemyUids.add(enemy.uid);
        this._killCountThisBattle += 1;
        return true;
    }

    private losePlayerHp(amount: number): number {
        const ch = this.ensureSelectedCharacter();
        const hpLoss = Math.min(ch.hp, Math.max(0, amount));
        ch.hp -= hpLoss;
        return hpLoss;
    }

    private damagePlayer(amount: number): number {
        const ch = this.ensureSelectedCharacter();
        let remaining = Math.max(0, this._playerVulnerableTurns > 0 ? Math.ceil(amount * 1.5) : amount);
        if (this._playerBlock > 0) {
            const absorbed = Math.min(this._playerBlock, remaining);
            this._playerBlock -= absorbed;
            remaining -= absorbed;
        }
        if (remaining > 0 && this._firstHpLossImmuneReady) {
            this._firstHpLossImmuneReady = false;
            this.pushLog('灵体羽翼生效，免疫了本次生命伤害。');
            return 0;
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
        this._finalRunSettlement = GlobalData.instance.isFinalMapEncounter();
        GlobalData.instance.recordBattleVictory(this._killCountThisBattle);
        if (this._finalRunSettlement) {
            GlobalData.instance.finishRunTimer();
        }
        this._flow.discardAllHand();
        const kind = this._encounterKind || 'monster';
        this._rewardGold = REWARD_GOLD[kind as Exclude<CombatEncounterKind, ''>] ?? REWARD_GOLD.monster;
        const ch = this.ensureSelectedCharacter();
        ch.gold += this._rewardGold;
        this.pushLog(`战斗胜利，获得 ${this._rewardGold} 金币。`);
        const goldRewardHeal = this.goldRewardHealAmount();
        if (goldRewardHeal > 0) {
            this.healPlayer(goldRewardHeal, '黄金玫瑰');
        }
        const victoryHeal = this.victoryHealAmount();
        if (victoryHeal > 0) {
            this.healPlayer(victoryHeal, '燃烧之血');
        }
        this.refreshAll();
        this.showSettlement('victory');
    }

    private finishDefeat(): void {
        if (this._state === 'defeat') {
            return;
        }
        this._state = 'defeat';
        this._finalRunSettlement = true;
        GlobalData.instance.recordBattleDefeat(this._killCountThisBattle);
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
        pUt.setContentSize(640, 360);
        const pG = panel.addComponent(Graphics);
        paintRoundRect(pG, 640, 360, new Color(30, 36, 48, 250), new Color(184, 155, 92, 255), 3);

        const title = this.addLabel(panel, 'Title', 560, 56, 0, 124, 38, result === 'victory' ? new Color(255, 218, 120, 255) : new Color(255, 130, 120, 255));
        title.string = result === 'victory' ? '战斗胜利' : '战斗失败';

        const desc = this.addLabel(panel, 'Desc', 560, 158, 0, 24, 20, new Color(230, 236, 246, 255));
        desc.lineHeight = 27;
        desc.string = result === 'victory'
            ? `结算奖励：${this._rewardGold} 金币\n当前金币：${this.ensureSelectedCharacter().gold}\n当前生命：${this.ensureSelectedCharacter().hp}/${this.ensureSelectedCharacter().maxHp}`
            : this.runSettlementText('本局失败');

        if (this._finalRunSettlement && result === 'victory') {
            title.string = '通关结算';
            desc.string = this.runSettlementText('已完成地图最后一环');
        }

        const btn = new Node('BackToMap');
        panel.addChild(btn);
        btn.setPosition(0, -120, 0);
        const bUt = btn.addComponent(UITransform);
        bUt.setContentSize(280, 56);
        const bG = btn.addComponent(Graphics);
        paintRoundRect(bG, 280, 56, new Color(78, 108, 138, 255), new Color(170, 215, 255, 255));
        const bLb = this.addLabel(btn, 'Label', 250, 48, 0, 0, 22, new Color(245, 250, 255, 255));
        bLb.string = result === 'victory' ? '领取奖励，返回地图' : '返回主菜单';
        if (this._finalRunSettlement && result === 'victory') {
            bLb.string = '完成本局，返回主菜单';
        }
        btn.on(Node.EventType.TOUCH_END, () => this.exitSettlement(), this);
    }

    private runSettlementText(prefix: string): string {
        const gd = GlobalData.instance;
        const ch = this.ensureSelectedCharacter();
        const resultText = gd.runResult === 'victory' ? '胜利' : gd.runResult === 'defeat' ? '失败' : '进行中';
        return `${prefix}\n结果：${resultText}    总用时：${gd.getRunElapsedText()}\n到达节点：${gd.mapCurrentNodeId}    牌组：${gd.deckIds.length || gd.deckCount} 张\n战斗胜场：${gd.runBattlesWon}    败场：${gd.runBattlesLost}    击杀：${gd.runEnemiesKilled}\n生命：${ch.hp}/${ch.maxHp}    金币：${ch.gold}`;
    }

    private exitSettlement(): void {
        if (this._finalRunSettlement) {
            GlobalData.instance.clearPendingEncounter();
            RunHudManager.stopRun();
            GlobalAudioManager.stopBgm();
            director.loadScene(SCENE_MAIN_MENU, (err) => {
                if (err) {
                    console.error('[BattlePlaceholderManager] 返回主菜单失败', err);
                }
            });
            return;
        }
        this.backToMap();
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

    private isDefeated(): boolean {
        return this._state === 'defeat';
    }

    private pushLog(line: string): void {
        this._logLines.unshift(line);
        if (this._logLines.length > 6) {
            this._logLines.length = 6;
        }
    }

    private relicDefs(): RelicDef[] {
        return getRelicDefs(this.ensureSelectedCharacter().relics);
    }

    private startCombatEnergyBonus(): number {
        return this.relicDefs().reduce((sum, relic) => sum + (relic.effects.startCombatEnergy ?? 0), 0);
    }

    private firstDescentCoverEnergyBonus(): number {
        return this.relicDefs().reduce((sum, relic) => sum + (relic.effects.firstDescentCoverEnergy ?? 0), 0);
    }

    private firstDescentCoverDrawBonus(): number {
        return this.relicDefs().reduce((sum, relic) => sum + (relic.effects.firstDescentCoverDraw ?? 0), 0);
    }

    private goldRewardHealAmount(): number {
        return this.relicDefs().reduce((sum, relic) => sum + (relic.effects.goldRewardHeal ?? 0), 0);
    }

    private victoryHealAmount(): number {
        return this.relicDefs().reduce((sum, relic) => sum + (relic.effects.victoryHeal ?? 0), 0);
    }

    private healPlayer(amount: number, source: string): number {
        const ch = this.ensureSelectedCharacter();
        const before = ch.hp;
        ch.hp = Math.min(ch.maxHp, ch.hp + Math.max(0, amount));
        const healed = ch.hp - before;
        this.pushLog(healed > 0 ? `${source}生效，回复 ${healed} 点生命。` : `${source}生效，但生命已满。`);
        return healed;
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
            this._playerBlockLabel.string = `格挡 ${this._playerBlock}  力量 ${this._playerStrength}`;
        }
        if (this._energyLabel) {
            const shadow = this._activeShadow ? SHADOW_NAME[this._activeShadow] : '无';
            this._energyLabel.string = `能量 ${this._energy.current}/${this._energy.perTurn}  虚影 ${shadow}`;
        }
        this.refreshShadowArt();
    }

    private refreshShadowArt(): void {
        const sprite = this._shadowSprite;
        const label = this._shadowLabel;
        if (!sprite || !label) {
            return;
        }
        const shadow = this._activeShadow;
        label.string = shadow ? SHADOW_NAME[shadow] : '无虚影';
        const artPath = shadow ? SHADOW_ART[shadow] : undefined;
        if (!artPath) {
            sprite.node.active = false;
            return;
        }
        const expected = artPath;
        sprite.node.active = true;
        loadSpriteFrame(artPath).then((sf) => {
            if (!sf || !sprite.node.isValid || this._activeShadow !== shadow || SHADOW_ART[shadow] !== expected) {
                return;
            }
            sprite.spriteFrame = sf;
        });
    }

    private refreshEnemyViews(): void {
        for (const viewData of this._enemyViews) {
            const enemy = viewData.enemy;
            const def = getEnemyDef(enemy.defId);
            const selected = enemy.uid === this._selectedEnemyUid && !enemy.isDead;
            const isBoss = def?.tier === 'boss';
            if (isBoss) {
                this.paintBossInfoPanel(viewData.frame, viewData.frameW, viewData.frameH, selected, enemy.isDead);
            } else {
                const fill = enemy.isDead ? new Color(44, 44, 48, 210) : new Color(45, 36, 42, 232);
                const stroke = selected ? new Color(255, 218, 110, 255) : new Color(130, 82, 82, 255);
                paintRoundRect(viewData.frame, viewData.frameW, viewData.frameH, fill, stroke, selected ? 5 : 2);
            }
            viewData.nameLabel.string = enemy.isDead ? `${def?.name ?? enemy.defId}（已击倒）` : def?.name ?? enemy.defId;
            viewData.hpLabel.string = `生命 ${enemy.currentHp}/${enemy.maxHp}`;
            viewData.blockLabel.string = `格挡 ${enemy.block}  力量 ${enemy.strength}`;
            viewData.intentLabel.string = enemy.isDead ? '无意图' : enemy.currentIntentLabel;
            this.paintEnemyHpBar(viewData.hpBar, enemy);
        }
    }

    private paintBossInfoPanel(g: Graphics, w: number, h: number, selected: boolean, dead: boolean): void {
        g.clear();
        const panelW = w - 34;
        const panelH = 118;
        const panelY = -h * 0.5 + panelH * 0.5 + 18;
        g.fillColor = dead ? new Color(25, 25, 28, 130) : new Color(10, 14, 20, 150);
        g.roundRect(-panelW * 0.5, panelY - panelH * 0.5, panelW, panelH, 8);
        g.fill();
        if (selected) {
            g.lineWidth = 3;
            g.strokeColor = new Color(255, 218, 110, 210);
            g.roundRect(-panelW * 0.5, panelY - panelH * 0.5, panelW, panelH, 8);
            g.stroke();
        }
    }

    private paintEnemyHpBar(g: Graphics, enemy: EnemyInstance): void {
        const w = getEnemyDef(enemy.defId)?.tier === 'boss' ? 230 : 160;
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
            const cost = this.cardCost(card, def);
            const canPlay = this._state === 'player' && this._energy.current >= cost;
            const n = new Node(`Card_${card.uid}`);
            root.addChild(n);
            n.setPosition(startX + index * (cardW + gap), 0, 0);
            const ut = n.addComponent(UITransform);
            ut.setContentSize(cardW, cardH);
            const g = n.addComponent(Graphics);
            const fill = canPlay ? new Color(226, 210, 172, 245) : new Color(122, 118, 110, 230);
            const stroke = canPlay ? new Color(86, 60, 40, 255) : new Color(82, 78, 74, 255);
            paintRoundRect(g, cardW, cardH, fill, stroke);

            this.renderCardArt(n, def, cardW, cardH, canPlay);

            this.addLabel(n, 'Cost', 36, 32, -cardW * 0.5 + 28, cardH * 0.5 - 26, 22, new Color(32, 42, 54, 255)).string = `${cost}`;
            const nameLb = this.addLabel(n, 'Name', cardW - 54, 32, 18, cardH * 0.5 - 28, 20, new Color(42, 33, 24, 255));
            nameLb.string = def.name;
            nameLb.isBold = true;

            const typeLb = this.addLabel(n, 'Type', cardW - 28, 22, 0, 1, 14, new Color(78, 62, 46, 255));
            typeLb.overflow = Label.Overflow.SHRINK;
            typeLb.string = this.cardTypeLabel(def);

            this.renderCardDescription(n, def, cardW);

            if (def.exhaustsOnPlay) {
                this.addLabel(n, 'Exhaust', cardW - 28, 24, 0, -cardH * 0.5 + 24, 14, new Color(120, 52, 42, 255)).string = '消耗';
            }
            n.on(Node.EventType.TOUCH_END, () => this.tryPlayCard(index), this);
        });
    }

    private renderCardArt(parent: Node, def: CardDef, cardW: number, cardH: number, enabled: boolean): void {
        if (!def.artPath) {
            return;
        }
        const artY = 50;
        const artH = 66;
        const art = new Node('CardArt');
        parent.addChild(art);
        art.setSiblingIndex(1);
        art.setPosition(0, artY, 0);
        const ut = art.addComponent(UITransform);
        ut.setContentSize(cardW - 24, artH);
        const sp = art.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;
        sp.color = new Color(255, 255, 255, enabled ? 230 : 120);
        loadSpriteFrame(def.artPath).then((sf) => {
            if (!sf || !art.isValid) {
                return;
            }
            sp.spriteFrame = sf;
        });

        const shade = new Node('CardArtShade');
        parent.addChild(shade);
        shade.setSiblingIndex(2);
        shade.setPosition(0, artY, 0);
        const shadeUt = shade.addComponent(UITransform);
        shadeUt.setContentSize(cardW - 24, artH);
        const g = shade.addComponent(Graphics);
        g.fillColor = new Color(0, 0, 0, enabled ? 28 : 96);
        g.roundRect(-(cardW - 24) * 0.5, -artH * 0.5, cardW - 24, artH, 5);
        g.fill();
    }

    private cardTypeLabel(def: CardDef): string {
        const parts: string[] = [];
        const damage = this.effectiveDamage(def);
        const block = this.effectiveBlock(def);
        if (damage) {
            parts.push(`${this.isMultiTargetAttack(def) ? '群伤' : '伤害'} ${damage}`);
        }
        if (block) {
            parts.push(`格挡 ${block}`);
        }
        if (def.draw || def.drawIfShadow) {
            parts.push(`抽牌 ${this.effectiveDraw(def)}`);
        }
        if (def.type === 'power') {
            parts.push('能力');
        }
        return parts.join(' / ') || (def.type === 'attack' ? '攻击' : '技能');
    }

    private cardFaceDescription(def: CardDef): string {
        const text = def.description
            .replace(/：/g, '：\n')
            .replace(/。/g, '。\n')
            .replace(/\n+/g, '\n')
            .trim();
        return this.wrapCardDescription(text);
    }

    private wrapCardDescription(text: string): string {
        const lines: string[] = [];
        for (const paragraph of text.split('\n')) {
            let current = '';
            let width = 0;
            for (const char of paragraph) {
                const charWidth = this.cardDescriptionCharWidth(char);
                const shouldBreakBefore = current.length > 0 && width + charWidth > CARD_DESCRIPTION_LINE_COLUMNS;
                if (shouldBreakBefore) {
                    lines.push(current.trim());
                    current = '';
                    width = 0;
                }
                current += char;
                width += charWidth;
                if (/[，。；]/.test(char)) {
                    lines.push(current.trim());
                    current = '';
                    width = 0;
                }
            }
            if (current.trim()) {
                lines.push(current.trim());
            }
        }
        return lines.join('\n');
    }

    private cardDescriptionCharWidth(char: string): number {
        return /[ -~]/.test(char) ? 0.55 : 1;
    }

    private cardDescriptionFontSize(lineCount: number): number {
        if (lineCount >= 7) {
            return 10;
        }
        if (lineCount >= 6) {
            return 11;
        }
        if (lineCount >= 5) {
            return 12;
        }
        return 14;
    }

    private renderCardDescription(parent: Node, def: CardDef, cardW: number): void {
        const allLines = this.cardFaceDescription(def).split('\n').filter((line) => line.length > 0);
        const maxLines = 5;
        const lines = allLines.slice(0, maxLines);
        if (allLines.length > maxLines && lines.length > 0) {
            lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(0, CARD_DESCRIPTION_LINE_COLUMNS - 1))}…`;
        }
        const fontSize = this.cardDescriptionFontSize(lines.length);
        const lineHeight = Math.ceil(fontSize * 1.18);
        const topY = -24;
        lines.forEach((line, index) => {
            const lb = this.addLabel(parent, `Desc_${index}`, cardW - 34, lineHeight + 2, 0, topY - index * lineHeight, fontSize, new Color(42, 34, 25, 255));
            lb.string = line;
            lb.horizontalAlign = Label.HorizontalAlign.LEFT;
            lb.verticalAlign = Label.VerticalAlign.CENTER;
            lb.enableWrapText = false;
            lb.overflow = Label.Overflow.SHRINK;
        });
    }

    private isMultiTargetAttack(def: CardDef): boolean {
        return !!def.damageAllEnemies || (this._activeShadow === 'wusheng' && def.type === 'attack');
    }

    private refreshLog(): void {
        if (this._logLabel) {
            this._logLabel.string = this._logLines.join('\n');
        }
    }
}
