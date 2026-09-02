import { _decorator, Component, Node } from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { EnemySpawner } from '../enemy/EnemySpawner';
import { Log } from '../item/Log';
import { Joystick } from '../ui/Joystick';
import { JoystickHintUI } from '../ui/JoystickHintUI';
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

    onLoad(): void {
        EventManager.instance.onEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);

        if (this.player && this.joystick) {
            this.joystick.bindPlayer(this.player);
            this.joystick.setMode('parkour');
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

        this._bindPreplacedMinions();

        const gm = GameManager.instance;
        if (gm) {
            gm.setPhase(GamePhase.RunParkour);
        }
    }

    onDestroy(): void {
        EventManager.instance.offEvent(GameEvents.LOG_FIXED, this._onLogFixed, this);
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

    private _onLogFixed = (): void => {
        const gm = GameManager.instance;
        if (gm) {
            gm.setPhase(GamePhase.CombatGuide);
        }
        // 玩家/摇杆切 defense：Player 已监听 LOG_FIXED；Joystick 听 PHASE_CHANGED('defense')
        // CombatGuide 阶段仍用全方向移动，额外发 defense 语义给摇杆
        EventManager.instance.emitEvent(GameEvents.PHASE_CHANGED, 'defense');
    };
}
