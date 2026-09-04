import { _decorator, Component, instantiate, Node, Prefab, resources, Vec3 } from 'cc';
import { Hero } from '../character/Hero';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

const HERO_PREFAB_PATHS = [
    'prefabs/character/pref_hero_01',
    'prefabs/character/pref_hero_02',
] as const;

@ccclass('HeroShrine')
export class HeroShrine extends Component {
    @property({ type: Node, tooltip: 'Visual 子节点（Sprite + Billboard + SortingOrder2D）' })
    visualNode: Node | null = null;

    @property({ type: Node, tooltip: '英雄生成位置（道路旁）' })
    heroSpawnPoint: Node | null = null;

    @property({ type: Prefab, tooltip: '英雄 01 预制体 pref_hero_01' })
    heroPrefab01: Prefab | null = null;

    @property({ type: Prefab, tooltip: '英雄 02 预制体 pref_hero_02' })
    heroPrefab02: Prefab | null = null;

    /**
     * G4 兜底：为 true 时跳过 UI 直接选英雄 0。
     * 场景已有 `GameRoot/UI/HeroSelect`+HeroSelectUI；正式二选一手测时请在 Inspector 关闭本开关。
     */
    @property({ tooltip: '为 true 时跳过 UI 自动选英雄 0；正式二选一请保持 false' })
    autoSelectOnActivate = false;

    /** P5-002 UI 可注册此回调弹出二选一界面 */
    public onHeroSelectRequested: ((shrine: HeroShrine) => void) | null = null;

    /** 英雄生成后回调，供 P4 跟随玩家等系统接入 */
    public onHeroSpawned: ((heroNode: Node) => void) | null = null;

    private _isActivated = false;
    private _hasSelected = false;
    private readonly _spawnPos = new Vec3();

    activate(): void {
        if (this._isActivated || this._hasSelected) {
            return;
        }
        this._isActivated = true;
        this._requestHeroSelect();
    }

    onHeroSelected(heroIndex: 0 | 1): void {
        if (this._hasSelected) {
            return;
        }
        this._hasSelected = true;

        const existing = heroIndex === 0 ? this.heroPrefab01 : this.heroPrefab02;
        if (existing) {
            this._spawnHero(existing, heroIndex);
            return;
        }

        const path = HERO_PREFAB_PATHS[heroIndex];
        resources.load(path, Prefab, (err, prefab) => {
            if (err || !prefab) {
                console.warn(`[HeroShrine] missing heroPrefab index=${heroIndex} path=${path}`, err);
                this._hasSelected = false;
                return;
            }
            if (heroIndex === 0) {
                this.heroPrefab01 = prefab;
            } else {
                this.heroPrefab02 = prefab;
            }
            this._spawnHero(prefab, heroIndex);
        });
    }

    private _spawnHero(prefab: Prefab, heroIndex: 0 | 1): void {
        const spawnParent = this._resolveSpawnParent();
        const heroNode = instantiate(prefab);
        spawnParent.addChild(heroNode);

        const spawnPoint = this.heroSpawnPoint ?? this.node;
        spawnPoint.getWorldPosition(this._spawnPos);
        heroNode.setWorldPosition(this._spawnPos);

        const hero = heroNode.getComponent(Hero);
        hero?.setHeroVariant(heroIndex === 0 ? 1 : 2);

        console.info(
            `[HeroShrine] spawned hero${heroIndex + 1} at (${this._spawnPos.x.toFixed(1)}, ${this._spawnPos.y.toFixed(1)})`,
        );

        this.onHeroSpawned?.(heroNode);
        this.node.active = false;
    }

    private _resolveSpawnParent(): Node {
        const scene = this.node.scene;
        if (scene) {
            const world = scene.getChildByName('GameRoot')?.getChildByName('World');
            if (world) {
                return world;
            }
        }
        return this.heroSpawnPoint?.parent ?? this.node.parent ?? this.node;
    }

    private _requestHeroSelect(): void {
        if (this.autoSelectOnActivate) {
            this.onHeroSelected(0);
            return;
        }
        if (this.onHeroSelectRequested) {
            this.onHeroSelectRequested(this);
            return;
        }
        EventManager.instance.emitEvent(GameEvents.HERO_SELECT_REQUESTED, this);
    }
}
