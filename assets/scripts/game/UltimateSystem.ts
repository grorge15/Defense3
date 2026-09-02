import { _decorator, Component, input, Input, EventKeyboard, KeyCode } from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { EnemyBoss } from '../enemy/EnemyBoss';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { EnemySpawner } from '../enemy/EnemySpawner';
import { CameraFollow } from './CameraFollow';
import { GameManager } from './GameManager';

const { ccclass, property } = _decorator;

/**
 * 大招系统：两侧高级塔完成后解锁；空格触发 Player.castUltimate → 清场 → 镜头拉远 → GameOver。
 * 无结束 UI prefab（§5.8）。
 */
@ccclass('UltimateSystem')
export class UltimateSystem extends Component {
    @property({ type: Player, tooltip: '玩家；空则场景查找' })
    player: Player | null = null;

    @property({ type: CameraFollow, tooltip: '主相机跟随；空则场景查找' })
    cameraFollow: CameraFollow | null = null;

    private _unlocked = false;
    private _castCount = 0;
    private _finishing = false;

    onLoad(): void {
        EventManager.instance.onEvent(
            GameEvents.BOTH_ADVANCED_TOWERS_COMPLETE,
            this._onBothAdvanced,
            this,
        );
        input.on(Input.EventType.KEY_DOWN, this._onKeyDown, this);
    }

    start(): void {
        this._resolveRefs();
    }

    onDestroy(): void {
        EventManager.instance.offEvent(
            GameEvents.BOTH_ADVANCED_TOWERS_COMPLETE,
            this._onBothAdvanced,
            this,
        );
        input.off(Input.EventType.KEY_DOWN, this._onKeyDown, this);
        if (this.player && this.player.onUltimateCast === this._onUltimateCast) {
            this.player.onUltimateCast = null;
        }
    }

    /** 清场：停刷怪并 deactivate 场景内 Minion/Boss */
    clearAllEnemies(): void {
        const scene = this.node.scene;
        if (!scene) {
            return;
        }

        const spawners = scene.getComponentsInChildren(EnemySpawner);
        for (const spawner of spawners) {
            spawner.enabled = false;
            spawner.unscheduleAllCallbacks();
        }

        const minions = scene.getComponentsInChildren(EnemyMinion);
        for (const m of minions) {
            if (!m.node.active) {
                continue;
            }
            m.unscheduleAllCallbacks();
            m.node.active = false;
        }

        const bosses = scene.getComponentsInChildren(EnemyBoss);
        for (const b of bosses) {
            if (!b.node.active) {
                continue;
            }
            b.unscheduleAllCallbacks();
            b.node.active = false;
        }
    }

    private _onBothAdvanced = (): void => {
        this._unlocked = true;
        this._bindPlayerCallback();
        console.log('[UltimateSystem] unlocked (BOTH_ADVANCED_TOWERS_COMPLETE); press Space to cast');
    };

    private _onKeyDown = (event: EventKeyboard): void => {
        if (event.keyCode !== KeyCode.SPACE) {
            return;
        }
        this._tryCast();
    };

    private _tryCast(): void {
        if (!this._unlocked || this._finishing) {
            return;
        }
        if (GameConfig.ultimateOnce && this._castCount > 0) {
            return;
        }
        this._resolveRefs();
        if (!this.player || this.player.isDead) {
            return;
        }
        this.player.castUltimate();
    }

    private readonly _onUltimateCast = (): void => {
        if (!this._unlocked || this._finishing) {
            return;
        }
        if (GameConfig.ultimateOnce && this._castCount > 0) {
            return;
        }
        this._castCount += 1;
        this._finishing = true;

        this.clearAllEnemies();
        console.log('[UltimateSystem] ultimate cast — cleared enemies');

        this._resolveRefs();
        const dist = GameConfig.ultimateZoomDistance;
        const dur = GameConfig.ultimateZoomDuration;
        this.cameraFollow?.zoomOut(dist, dur);

        const delay = dur + GameConfig.ultimateGameOverDelay;
        this.scheduleOnce(() => {
            GameManager.instance?.setGameOver();
            console.log('[UltimateSystem] setGameOver');
        }, delay);
    };

    private _bindPlayerCallback(): void {
        this._resolveRefs();
        if (this.player) {
            this.player.onUltimateCast = this._onUltimateCast;
        }
    }

    private _resolveRefs(): void {
        const scene = this.node.scene;
        if (!this.player && scene) {
            this.player = scene.getComponentInChildren(Player);
        }
        if (!this.cameraFollow && scene) {
            this.cameraFollow = scene.getComponentInChildren(CameraFollow);
        }
    }
}
