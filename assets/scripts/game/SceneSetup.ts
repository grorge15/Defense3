import { _decorator, Component, Node } from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { Physics2DSetup } from '../core/Physics2DSetup';
import { BossSpawner } from '../enemy/BossSpawner';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { EnemySpawner } from '../enemy/EnemySpawner';
import { Log } from '../item/Log';
import { Joystick } from '../ui/Joystick';
import { JoystickHintUI } from '../ui/JoystickHintUI';
import { HeroSelectUI } from '../ui/HeroSelectUI';
import { CameraFollow } from './CameraFollow';
import { BuildSystem } from '../building/BuildSystem';
import { CoinSystem } from './CoinSystem';
import { CombatGuideController } from './CombatGuideController';
import { GuideIndicatorUI } from '../ui/GuideIndicatorUI';
import { CombatSystem } from './CombatSystem';
import { GameManager } from './GameManager';
import { GamePhase } from './GamePhase';
import { UltimateSystem } from './UltimateSystem';

const { ccclass, property } = _decorator;

/**
 * 开局接线：读场景已有节点，不 instantiate 静态关卡布局。
 * 绑玩家/滚木/摇杆；setPhase(RunParkour)；PARKOUR_FINISHED → CombatGuide。
 */
@ccclass('SceneSetup')
export class SceneSetup extends Component {
    @property({ type: Player, tooltip: '场景中的玩家实例' })
    player: Player | null = null;

    @property({ type: Log, tooltip: 'LogAnchor 下滚木' })
    log: Log | null = null;

    @property({ type: Joystick, tooltip: 'UI 摇杆' })
    joystick: Joystick | null = null;

    @property({ type: JoystickHintUI, tooltip: '摇杆提示 UI' })
    joystickHint: JoystickHintUI | null = null;

    @property({ type: Node, tooltip: 'ParkourContent 根' })
    parkourContent: Node | null = null;

    @property({ type: EnemySpawner, tooltip: '远端刷怪器' })
    enemySpawner: EnemySpawner | null = null;

    @property({ type: BossSpawner, tooltip: 'Boss 首次生成器' })
    bossSpawner: BossSpawner | null = null;

    @property({ type: CameraFollow, tooltip: '主相机跟随（可选补绑）' })
    cameraFollow: CameraFollow | null = null;

    @property({ type: CombatSystem, tooltip: '战斗系统（可选补绑）' })
    combatSystem: CombatSystem | null = null;

    @property({ type: CoinSystem, tooltip: '金币系统（可选补绑）' })
    coinSystem: CoinSystem | null = null;

    @property({ type: BuildSystem, tooltip: '建造系统（可选补绑）' })
    buildSystem: BuildSystem | null = null;

    @property({ type: HeroSelectUI, tooltip: '英雄二选一 UI（可选补绑）' })
    heroSelectUI: HeroSelectUI | null = null;

    @property({ type: GuideIndicatorUI, tooltip: '预摆十步引导 UI（可选补绑）' })
    guideIndicatorUI: GuideIndicatorUI | null = null;

    @property({ type: [Node], tooltip: '大招 BigMove 播放点位（可多选）' })
    ultimateBigMovePoints: Node[] = [];

    onLoad(): void {
        if (!this.getComponent(Physics2DSetup)) {
            this.addComponent(Physics2DSetup);
        }

        EventManager.instance.onEvent(GameEvents.PARKOUR_FINISHED, this._onParkourFinished, this);
        this._wireGameplay();
        this._ensureCombatGuide();
        this._ensureUltimateSystem();

        const gm = GameManager.instance;
        if (gm) {
            gm.setPhase(GamePhase.RunParkour);
        }
    }

    start(): void {
        // prefab 实例可能在 onLoad 时尚未展开，再兜底绑一次
        this._wireGameplay();
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.PARKOUR_FINISHED, this._onParkourFinished, this);
    }

    /** 解析引用并绑定摇杆/滚木/刷怪/预置怪；可重复调用 */
    private _wireGameplay(): void {
        this._resolveGameplayRefs();

        const phase = GameManager.instance?.getPhase();
        const inParkour = !phase || phase === GamePhase.RunParkour;
        const moveMode = inParkour ? 'parkour' : 'defense';

        if (this.player) {
            this.player.setMode(moveMode);
        }

        if (this.player && this.joystick) {
            this.joystick.bindPlayer(this.player);
            this.joystick.setMode(moveMode);
        } else if (!this.player || !this.joystick) {
            console.warn(
                '[SceneSetup] missing player/joystick binding',
                !!this.player,
                !!this.joystick,
            );
        }

        if (this.player && this.log && inParkour) {
            this.log.bindPlayer(this.player.node);
            this.log.beginParkour();
        }

        if (this.joystickHint) {
            this.joystickHint.bindJoystick(this.joystick);
        }

        if (this.enemySpawner && this.player) {
            this.enemySpawner.setTarget(this.player.node);
        }

        if (this.bossSpawner && this.player) {
            this.bossSpawner.setPlayer(this.player.node);
        }

        this._bindCameraAndCombat();
        this._bindCoinSystem();
        this._bindBuildSystem();
        this._bindPreplacedMinions();
    }

    /** 磁盘上 @property 常为 null（仅靠 targetOverrides）；运行时兜底查找 */
    private _resolveGameplayRefs(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        if (!this.player) {
            this.player = scene.getComponentInChildren(Player);
        }
        if (!this.log) {
            this.log = scene.getComponentInChildren(Log);
        }
        if (!this.joystick) {
            this.joystick = scene.getComponentInChildren(Joystick);
        }
        if (!this.joystickHint) {
            this.joystickHint = scene.getComponentInChildren(JoystickHintUI);
        }
    }

    private _bindCameraAndCombat(): void {
        const scene = this.node.scene;
        if (!this.cameraFollow && scene) {
            this.cameraFollow = scene.getComponentInChildren(CameraFollow);
        }
        if (this.cameraFollow && this.player && !this.cameraFollow.target) {
            this.cameraFollow.target = this.player.node;
        }

        if (!this.combatSystem && scene) {
            this.combatSystem = scene.getComponentInChildren(CombatSystem);
        }
        if (this.combatSystem && this.player) {
            if (!this.combatSystem.player) {
                this.combatSystem.player = this.player;
            }
            if (!this.combatSystem.playerNode) {
                this.combatSystem.playerNode = this.player.node;
            }
            this.player.bindCombatSystem(this.combatSystem);
        }
    }

    private _bindCoinSystem(): void {
        if (!this.coinSystem && this.node.scene) {
            this.coinSystem = this.node.scene.getComponentInChildren(CoinSystem);
        }
        if (this.coinSystem && this.player) {
            this.coinSystem.setPlayer(this.player.node);
        }
    }

    private _bindBuildSystem(): void {
        if (!this.buildSystem && this.node.scene) {
            this.buildSystem = this.node.scene.getComponentInChildren(BuildSystem);
        }
        if (this.buildSystem && this.coinSystem && !this.buildSystem.coinSystem) {
            this.buildSystem.coinSystem = this.coinSystem;
        }
        if (this.buildSystem && this.player && !this.buildSystem.playerNode) {
            this.buildSystem.playerNode = this.player.node;
        }
        if (!this.heroSelectUI && this.node.scene) {
            this.heroSelectUI = this.node.scene.getComponentInChildren(HeroSelectUI);
        }
        this.heroSelectUI?.ensureReady();
    }

    private _bindPreplacedMinions(): void {
        if (!this.player) {
            return;
        }
        const root = this.parkourContent ?? this.node.scene;
        if (!root) {
            return;
        }
        const minions = root.getComponentsInChildren(EnemyMinion);
        for (const m of minions) {
            m.setTarget(this.player.node);
        }
    }

    private _ensureCombatGuide(): void {
        const guide = this.getComponent(CombatGuideController) ?? this.addComponent(CombatGuideController);
        if (!this.guideIndicatorUI && this.node.scene) {
            this.guideIndicatorUI = this.node.scene.getComponentInChildren(GuideIndicatorUI);
        }
        guide.bindSceneRefs(this.player, this.log, this.buildSystem, this.coinSystem, this.guideIndicatorUI);
    }

    private _ensureUltimateSystem(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }
        const ultimate = scene.getComponentInChildren(UltimateSystem) ?? this.addComponent(UltimateSystem);
        ultimate.setBigMovePoints(this.ultimateBigMovePoints);
    }

    private _onParkourFinished = (): void => {
        // 唯一阶段出口：setPhase → PHASE_CHANGED(GamePhase.CombatGuide)；监听方映射为 defense 移动
        this.player?.setMode('defense');
        this.joystick?.setMode('defense');

        const gm = GameManager.instance;
        if (gm) {
            gm.setPhase(GamePhase.CombatGuide);
        }
        // Boss 改在首座初级塔/兵营建成后由 BuildSystem 生成
    };

}
