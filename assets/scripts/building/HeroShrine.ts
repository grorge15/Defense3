import { _decorator, Component, instantiate, Node, Prefab } from 'cc';
import { Hero } from '../character/Hero';
import { EventManager } from '../core/EventManager';
import { GameEvents } from '../core/GameEvents';

const { ccclass, property } = _decorator;

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

    /** P5-002 UI 可注册此回调弹出二选一界面 */
    public onHeroSelectRequested: ((shrine: HeroShrine) => void) | null = null;

    /** 英雄生成后回调，供 P4 跟随玩家等系统接入 */
    public onHeroSpawned: ((heroNode: Node) => void) | null = null;

    private _isActivated = false;
    private _hasSelected = false;

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

        const prefab = heroIndex === 0 ? this.heroPrefab01 : this.heroPrefab02;
        if (!prefab) {
            return;
        }

        const spawnParent = this.heroSpawnPoint?.parent ?? this.node.parent ?? this.node.scene;
        const heroNode = instantiate(prefab);
        heroNode.setParent(spawnParent);

        const spawnPoint = this.heroSpawnPoint ?? this.node;
        const spawnPos = spawnPoint.worldPosition;
        heroNode.setWorldPosition(spawnPos);

        const hero = heroNode.getComponent(Hero);
        hero?.setHeroVariant(heroIndex === 0 ? 1 : 2);

        this.onHeroSpawned?.(heroNode);
        this.node.active = false;
    }

    private _requestHeroSelect(): void {
        if (this.onHeroSelectRequested) {
            this.onHeroSelectRequested(this);
            return;
        }
        EventManager.instance.emitEvent(GameEvents.HERO_SELECT_REQUESTED, this);
    }
}
