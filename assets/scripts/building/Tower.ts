import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { GameConfig } from '../core/GameConfig';
import { Building } from './Building';

const { ccclass, property } = _decorator;

export type TowerType = 'basic' | 'advanced';

/** P2-011 Soldier 部署接口；Tower 不直接 import Soldier 以避免循环依赖。 */
interface ISoldierDeployment {
    setDeployment(deployment: 'tower' | 'barracks'): void;
    deactivate?(): void;
    activate?(): void;
}

@ccclass('Tower')
export class Tower extends Building {
    @property({ type: Node, tooltip: '塔身 Visual 子节点（Sprite + Billboard + SortingOrder2D）' })
    visualNode: Node | null = null;

    @property({ type: [Node], tooltip: '塔顶 3 个小兵挂载点' })
    soldierMounts: Node[] = [];

    @property({ type: Prefab, tooltip: '远程小兵预制体 pref_soldier_ranged' })
    soldierPrefab: Prefab | null = null;

    @property({ tooltip: '高级塔 Visual 缩放倍率' })
    advancedVisualScale = 1.25;

    @property({ tooltip: '预制体配置的塔类型' })
    towerType: TowerType = 'basic';

    private _towerType: TowerType = 'basic';
    private _isActive = false;
    private readonly _spawnedSoldiers: Node[] = [];

    onLoad(): void {
        if (this.maxHp <= 0) {
            this.maxHp = GameConfig.towerMaxHp;
        }
        super.onLoad();
        this.setTowerType(this.towerType);
    }

    setTowerType(type: TowerType): void {
        this._towerType = type;
        this._applyVisualScale();
    }

    getTowerType(): TowerType {
        return this._towerType;
    }

    activate(): void {
        if (this._isActive) {
            return;
        }
        this._isActive = true;
        this.spawnSoldiers();
        for (const soldierNode of this._spawnedSoldiers) {
            const soldier = soldierNode.getComponent('Soldier') as (Component & ISoldierDeployment) | null;
            soldier?.activate?.();
        }
    }

    deactivate(): void {
        this._isActive = false;
        for (const soldierNode of this._spawnedSoldiers) {
            const soldier = soldierNode.getComponent('Soldier') as (Component & ISoldierDeployment) | null;
            soldier?.deactivate?.();
            soldierNode.active = false;
        }
    }

    spawnSoldiers(): void {
        this.clearSoldiers();
        if (!this.soldierPrefab) {
            return;
        }

        const mounts = this._resolveMounts();
        for (const mount of mounts) {
            const soldierNode = instantiate(this.soldierPrefab);
            soldierNode.setParent(mount);
            soldierNode.setPosition(Vec3.ZERO);
            soldierNode.active = this._isActive;

            const soldier = soldierNode.getComponent('Soldier') as (Component & ISoldierDeployment) | null;
            soldier?.setDeployment('tower');

            this._spawnedSoldiers.push(soldierNode);
        }
    }

    clearSoldiers(): void {
        for (const soldierNode of this._spawnedSoldiers) {
            if (soldierNode.isValid) {
                soldierNode.destroy();
            }
        }
        this._spawnedSoldiers.length = 0;
    }

    reset(): void {
        this.deactivate();
        this.clearSoldiers();
        this._isActive = false;
    }

    onDestroy(): void {
        this.clearSoldiers();
    }

    protected _onDestroyed(): void {
        this.clearSoldiers();
        super._onDestroyed();
    }

    private _resolveMounts(): Node[] {
        if (this.soldierMounts.length > 0) {
            return this.soldierMounts.filter((node) => node != null);
        }
        const mounts: Node[] = [];
        for (let i = 0; i < 3; i++) {
            const mount = this.node.getChildByName(`SoldierMount_${i}`);
            if (mount) {
                mounts.push(mount);
            }
        }
        return mounts;
    }

    private _applyVisualScale(): void {
        const visual = this.visualNode;
        if (!visual) {
            return;
        }
        const scale = this._towerType === 'advanced' ? this.advancedVisualScale : 1;
        visual.setScale(scale, scale, scale);
    }
}
