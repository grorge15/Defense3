import { _decorator, Component, Node } from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { GameConfig } from '../core/GameConfig';
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
import { CombatSystem } from './CombatSystem';
import { GameManager } from './GameManager';
import { GamePhase } from './GamePhase';

const { ccclass, property } = _decorator;

/**
 * 开局接线：读场景已有节点，不 instantiate 静态关卡布局。
 * 绑玩家/滚木/摇杆；setPhase(RunParkour)；LOG_FIXED → CombatGuide。
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

    onLoad(): void {
        if (!this.getComponent(Physics2DSetup)) {
            this.addComponent(Physics2DSetup);
        }

        this._resolveGameplayRefs();

        EventManager.instance.onEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);

        if (this.player && this.joystick) {
            this.joystick.bindPlayer(this.player);
            this.joystick.setMode('parkour');
        } else {
            console.warn(
                '[SceneSetup] missing player/joystick binding',
                !!this.player,
                !!this.joystick,
            );
        }

        if (this.player && this.log) {
            this.log.bindPlayer(this.player.node);
            this.log.beginParkour();
            this.player.setMode('parkour');
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
        this._ensureCombatGuide();

        const gm = GameManager.instance;
        if (gm) {
            gm.setPhase(GamePhase.RunParkour);
        }
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
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
        if (!this.getComponent(CombatGuideController)) {
            this.addComponent(CombatGuideController);
        }
    }

    private _onLogFixed = (): void => {
        // 唯一阶段出口：setPhase → PHASE_CHANGED(GamePhase.CombatGuide)；监听方映射为 defense 移动
        const gm = GameManager.instance;
        if (gm) {
            gm.setPhase(GamePhase.CombatGuide);
        }

        if (this.bossSpawner) {
            this.scheduleOnce(() => {
                this.bossSpawner?.trySpawnFirst();
            }, GameConfig.bossFirstSpawnDelay);
        }
    };
}
