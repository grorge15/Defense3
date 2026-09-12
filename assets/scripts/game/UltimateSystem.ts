import {
    _decorator,
    Animation,
    Component,
    EventKeyboard,
    Input,
    instantiate,
    input,
    KeyCode,
    Node,
    Prefab,
    resources,
} from 'cc';
import { Player } from '../character/Player';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../core/GameConfig';
import { GameEvents } from '../core/GameEvents';
import { EnemyBoss } from '../enemy/EnemyBoss';
import { EnemyMinion } from '../enemy/EnemyMinion';
import { EnemySpawner } from '../enemy/EnemySpawner';
import { CameraFollow } from './CameraFollow';
import { GameManager } from './GameManager';
import { GamePhase } from './GamePhase';

const { ccclass, property } = _decorator;
const BIG_MOVE_VFX_PATH = 'prefabs/VFX/Vfx_BigMove';

/**
 * 大招/收尾：两侧高级塔完成后自动清场 → 锁移动 → 镜头拉远 → GameOver。
 * 空格仍可手动触发（若尚未自动播完）。
 */
@ccclass('UltimateSystem')
export class UltimateSystem extends Component {
    @property({ type: Player, tooltip: '玩家；空则场景查找' })
    player: Player | null = null;

    @property({ type: CameraFollow, tooltip: '主相机跟随；空则场景查找' })
    cameraFollow: CameraFollow | null = null;

    @property({ type: [Node], tooltip: '大招 BigMove 播放点位；由 SceneSetup 注入' })
    bigMovePoints: Node[] = [];

    @property({ type: Prefab, tooltip: 'BigMove VFX；空则从既有资源加载' })
    bigMoveVfxPrefab: Prefab | null = null;

    private _unlocked = false;
    private _castCount = 0;
    private _finishing = false;
    private _finaleSettled = false;

    setBigMovePoints(points: Node[]): void {
        this.bigMovePoints = points;
    }

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
        console.log('[UltimateSystem] unlocked (BOTH_ADVANCED_TOWERS_COMPLETE) → auto finale');
        // 不依赖空格 / castUltimate 回调，直接收尾（锁移动、拉镜头、GameOver）
        this._runFinale();
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
        if (this.player && !this.player.isDead && this.player.onUltimateCast) {
            this.player.castUltimate();
            return;
        }
        this._runFinale();
    }

    private readonly _onUltimateCast = (): void => {
        this._runFinale();
    };

    private _runFinale(): void {
        if (!this._unlocked || this._finishing) {
            return;
        }
        if (GameConfig.ultimateOnce && this._castCount > 0) {
            return;
        }
        this._castCount += 1;
        this._finishing = true;

        this._resolveRefs();
        this.player?.setCanMove(false);
        GameManager.instance?.setPhase(GamePhase.Ultimate);

        const dist = GameConfig.ultimateZoomDistance;
        const dur = GameConfig.ultimateZoomDuration;
        if (this.cameraFollow) {
            this.cameraFollow.zoomOut(dist, dur);
        } else {
            console.warn('[UltimateSystem] cameraFollow missing — skip zoomOut');
        }

        console.log('[UltimateSystem] finale started — locked move and zoomed out');
        this._playBigMoveAndFinish();
    }

    private _playBigMoveAndFinish(): void {
        const points = this.bigMovePoints.filter(
            (point, index, all) =>
                !!point &&
                point.isValid &&
                !!point.scene &&
                point.activeInHierarchy &&
                all.indexOf(point) === index,
        );
        if (points.length === 0) {
            console.warn('[UltimateSystem] no valid BigMove points — continue finale');
            this._finishFinale();
            return;
        }

        const spawn = (prefab: Prefab): void => {
            let pending = 0;
            let finished = false;
            const complete = (): void => {
                if (finished) {
                    return;
                }
                finished = true;
                this._finishFinale();
            };

            for (const point of points) {
                let node: Node;
                try {
                    node = instantiate(prefab);
                } catch (error) {
                    console.warn('[UltimateSystem] failed to instantiate BigMove VFX', error);
                    continue;
                }
                const parent = point.parent ?? this.node.scene;
                if (!parent) {
                    console.warn('[UltimateSystem] BigMove point has no scene parent — skipped');
                    node.destroy();
                    continue;
                }
                parent.addChild(node);
                node.setWorldPosition(point.worldPosition);
                node.active = true;

                const animation = node.getComponent(Animation);
                const state = animation?.getState('BigMove');
                if (!animation || !state) {
                    console.warn('[UltimateSystem] BigMove animation or clip missing — skipped');
                    node.destroy();
                    continue;
                }

                pending += 1;
                let callbackDone = false;
                const onFinished = (): void => {
                    if (callbackDone) {
                        return;
                    }
                    callbackDone = true;
                    if (node.isValid) {
                        node.destroy();
                    }
                    pending -= 1;
                    if (pending <= 0) {
                        complete();
                    }
                };
                animation.once(Animation.EventType.FINISHED, onFinished);
                animation.play('BigMove');
                const speed = Number(state.speed);
                const effectiveSpeed = Number.isFinite(speed) && Math.abs(speed) > 0 ? Math.abs(speed) : 1;
                const clipDuration = Number(state.clip?.duration);
                const stateDuration = Number(state.duration);
                const baseDuration = Number.isFinite(clipDuration) && clipDuration > 0
                    ? clipDuration
                    : stateDuration;
                const fallbackDuration = Number.isFinite(baseDuration) && baseDuration > 0
                    ? baseDuration / effectiveSpeed
                    : 0.1;
                this.scheduleOnce(onFinished, Math.max(fallbackDuration, 0.1));
            }

            if (pending <= 0) {
                console.warn('[UltimateSystem] no BigMove instance could play — continue finale');
                complete();
            }
        };

        if (this.bigMoveVfxPrefab) {
            spawn(this.bigMoveVfxPrefab);
            return;
        }
        resources.load(BIG_MOVE_VFX_PATH, Prefab, (err, prefab) => {
            if (err || !prefab || !this.isValid) {
                console.warn(`[UltimateSystem] missing BigMove VFX path=${BIG_MOVE_VFX_PATH}`, err);
                this._finishFinale();
                return;
            }
            this.bigMoveVfxPrefab = prefab;
            spawn(prefab);
        });
    }

    private _finishFinale(): void {
        if (this._finaleSettled) {
            return;
        }
        this._finaleSettled = true;
        this.clearAllEnemies();
        console.log('[UltimateSystem] BigMove finished — cleared enemies');

        const delay = GameConfig.ultimateGameOverDelay;
        this.scheduleOnce(() => {
            GameManager.instance?.setGameOver('win');
            this.player?.setCanMove(false);
            console.log('[UltimateSystem] setGameOver');
        }, delay);
    }

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
