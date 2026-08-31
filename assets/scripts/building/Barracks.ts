import { _decorator, Component, instantiate, Node, Prefab, Vec3 } from 'cc';
import { GameConfig } from '../core/GameConfig';

const { ccclass, property } = _decorator;

/** P2-011 Soldier 部署接口；Barracks 不直接 import Soldier 以避免循环依赖。 */
interface ISoldierDeployment {
    setDeployment(deployment: 'tower' | 'barracks'): void;
    deactivate?(): void;
    activate?(): void;
}

@ccclass('Barracks')
export class Barracks extends Component {
    @property({ type: Node, tooltip: '兵营 Visual 子节点（Sprite + Billboard + SortingOrder2D）' })
    visualNode: Node | null = null;

    @property({ type: [Node], tooltip: '8 个小兵放置点' })
    soldierMounts: Node[] = [];

    @property({ type: Prefab, tooltip: '近战小兵预制体 pref_soldier_melee' })
    soldierPrefab: Prefab | null = null;

    private _isActive = false;
    private readonly _spawnedSoldiers: Node[] = [];

    activate(): void {
        if (this._isActive) {
            return;
        }
        this._isActive = true;
        this.spawnWave();
        this.schedule(this.spawnWave, GameConfig.barracksSpawnInterval);
    }

    deactivate(): void {
        this._isActive = false;
        this.unschedule(this.spawnWave);
        for (const soldierNode of this._spawnedSoldiers) {
            const soldier = soldierNode.getComponent('Soldier') as Component & ISoldierDeployment | null;
            soldier?.deactivate?.();
            if (soldierNode.isValid) {
                soldierNode.active = false;
            }
        }
    }

    spawnWave(): void {
        if (!this.soldierPrefab) {
            return;
        }

        const mounts = this._resolveMounts();
        for (const mount of mounts) {
            if (this._mountHasAliveSoldier(mount)) {
                continue;
            }

            const soldierNode = instantiate(this.soldierPrefab);
            soldierNode.setParent(mount);
            soldierNode.setPosition(Vec3.ZERO);
            soldierNode.active = this._isActive;

            const soldier = soldierNode.getComponent('Soldier') as Component & ISoldierDeployment | null;
            soldier?.setDeployment('barracks');
            soldier?.activate?.();

            this._spawnedSoldiers.push(soldierNode);
        }
    }

    reset(): void {
        this.deactivate();
        this._clearSpawnedSoldiers();
        this._isActive = false;
    }

    onDestroy(): void {
        this.unschedule(this.spawnWave);
        this._clearSpawnedSoldiers();
    }

    private _clearSpawnedSoldiers(): void {
        for (const soldierNode of this._spawnedSoldiers) {
            if (soldierNode.isValid) {
                soldierNode.destroy();
            }
        }
        this._spawnedSoldiers.length = 0;
    }

    private _resolveMounts(): Node[] {
        if (this.soldierMounts.length > 0) {
            return this.soldierMounts.filter((node) => node != null);
        }
        const mounts: Node[] = [];
        for (let i = 0; i < 8; i++) {
            const mount = this.node.getChildByName(`SoldierMount_${i}`);
            if (mount) {
                mounts.push(mount);
            }
        }
        return mounts;
    }

    private _mountHasAliveSoldier(mount: Node): boolean {
        for (const child of mount.children) {
            if (!child.active) {
                continue;
            }
            const soldier = child.getComponent('Soldier');
            if (soldier) {
                return true;
            }
        }
        return false;
    }
}
