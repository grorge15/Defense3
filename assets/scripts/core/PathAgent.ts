import { BoxCollider2D, Vec2, Vec3 } from 'cc';
import { AirWallAabb } from './AirWallAabb';
import { GameConfig } from './GameConfig';

type GridNode = {
    x: number;
    y: number;
    g: number;
    f: number;
    parent: number;
};

/**
 * Per-unit path follower for pursuit/follow movement.
 * Keeps path search low-frequency and falls back to existing local airWall steering.
 */
export class PathAgent {
    private readonly _waypoints: Vec3[] = [];
    private readonly _nodes: GridNode[] = [];
    private readonly _open: number[] = [];
    private readonly _closed = new Set<string>();
    private readonly _bestByKey = new Map<string, number>();
    private readonly _probePos = new Vec3();
    private readonly _lastTarget = new Vec3(Number.NaN, Number.NaN, 0);
    private readonly _gridOrigin = new Vec2();
    private _repathTimer = 0;
    private _waypointIndex = 0;
    private _waypointCount = 0;
    private _hasPathAttempt = false;

    reset(): void {
        this._nodes.length = 0;
        this._open.length = 0;
        this._closed.clear();
        this._bestByKey.clear();
        this._lastTarget.set(Number.NaN, Number.NaN, 0);
        this._repathTimer = 0;
        this._waypointIndex = 0;
        this._waypointCount = 0;
        this._hasPathAttempt = false;
    }

    /**
     * Writes a unit direction into outDir. The caller owns speed scaling and velocity semantics.
     */
    nextDirection(
        dt: number,
        from: Vec3,
        target: Vec3,
        width: number,
        height: number,
        walls: BoxCollider2D[],
        outDir: Vec2,
        fallbackProbeDist?: number,
    ): void {
        this._repathTimer -= dt;
        if (this._shouldRepath(target)) {
            this._repathTimer = GameConfig.pathRepathInterval;
            this._lastTarget.set(target);
            this._rebuildPath(from, target, width, height, walls);
        }

        const waypoint = this._currentWaypoint(from, target);
        if (waypoint) {
            this._writeDirection(from, waypoint, outDir);
            return;
        }

        AirWallAabb.steerDirection(from, target, width, height, walls, outDir, fallbackProbeDist);
    }

    private _shouldRepath(target: Vec3): boolean {
        if (!this._hasPathAttempt) {
            return true;
        }
        if (this._repathTimer > 0) {
            return false;
        }
        if (this._waypointCount === 0 || this._waypointIndex >= this._waypointCount) {
            return true;
        }
        if (!Number.isFinite(this._lastTarget.x) || !Number.isFinite(this._lastTarget.y)) {
            return true;
        }
        const dx = target.x - this._lastTarget.x;
        const dy = target.y - this._lastTarget.y;
        const threshold = GameConfig.pathTargetMoveThreshold;
        return dx * dx + dy * dy >= threshold * threshold;
    }

    private _rebuildPath(
        from: Vec3,
        target: Vec3,
        width: number,
        height: number,
        walls: BoxCollider2D[],
    ): void {
        this._waypointIndex = 0;
        this._waypointCount = 0;
        this._hasPathAttempt = true;

        if (walls.length === 0 || this._lineReachable(from, target, width, height, walls)) {
            this._pushWaypoint(target);
            return;
        }

        if (!this._buildGridPath(from, target, width, height, walls)) {
            this._waypointCount = 0;
        }
    }

    private _currentWaypoint(from: Vec3, target: Vec3): Vec3 | null {
        const reach = GameConfig.pathWaypointReachDistance;
        const reachSq = reach * reach;
        while (this._waypointIndex < this._waypointCount) {
            const wp = this._waypoints[this._waypointIndex];
            const dx = wp.x - from.x;
            const dy = wp.y - from.y;
            if (dx * dx + dy * dy > reachSq) {
                return wp;
            }
            this._waypointIndex += 1;
        }

        if (this._waypointCount > 0) {
            const dx = target.x - from.x;
            const dy = target.y - from.y;
            if (dx * dx + dy * dy > reachSq) {
                return target;
            }
        }
        return null;
    }

    private _lineReachable(
        from: Vec3,
        target: Vec3,
        width: number,
        height: number,
        walls: BoxCollider2D[],
    ): boolean {
        if (walls.length === 0) {
            return true;
        }
        const dx = target.x - from.x;
        const dy = target.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) {
            return true;
        }
        const step = Math.max(GameConfig.pathProbeStep, Math.max(width, height) * 0.5);
        const count = Math.max(1, Math.ceil(dist / step));
        for (let i = 1; i <= count; i++) {
            const t = i / count;
            this._probePos.set(from.x + dx * t, from.y + dy * t, from.z);
            if (AirWallAabb.overlapsAny(this._probePos, width, height, walls)) {
                return false;
            }
        }
        return true;
    }

    private _buildGridPath(
        from: Vec3,
        target: Vec3,
        width: number,
        height: number,
        walls: BoxCollider2D[],
    ): boolean {
        const grid = GameConfig.pathGridSize;
        const padding = GameConfig.pathBoundsPadding;
        const minX = Math.min(from.x, target.x) - padding;
        const minY = Math.min(from.y, target.y) - padding;
        this._gridOrigin.set(minX, minY);

        const start = this._worldToCell(from.x, from.y, grid);
        const end = this._worldToCell(target.x, target.y, grid);
        if (!this._nearestWalkable(start, width, height, walls, grid)) {
            return false;
        }
        if (!this._nearestWalkable(end, width, height, walls, grid)) {
            return false;
        }

        this._nodes.length = 0;
        this._open.length = 0;
        this._closed.clear();
        this._bestByKey.clear();

        this._addNode(start.x, start.y, 0, this._heuristic(start.x, start.y, end.x, end.y), -1);

        const maxNodes = GameConfig.pathMaxNodes;
        while (this._open.length > 0 && this._nodes.length <= maxNodes) {
            const currentIdx = this._popBestOpen();
            const current = this._nodes[currentIdx];
            const currentKey = this._key(current.x, current.y);
            if (this._closed.has(currentKey)) {
                continue;
            }
            this._closed.add(currentKey);

            if (current.x === end.x && current.y === end.y) {
                this._emitPath(currentIdx, target, grid, width, height, walls);
                return this._waypointCount > 0;
            }

            for (let ox = -1; ox <= 1; ox++) {
                for (let oy = -1; oy <= 1; oy++) {
                    if (ox === 0 && oy === 0) {
                        continue;
                    }
                    this._tryNeighbor(currentIdx, current.x + ox, current.y + oy, ox, oy, end, width, height, walls, grid);
                }
            }
        }
        return false;
    }

    private _tryNeighbor(
        parentIdx: number,
        x: number,
        y: number,
        ox: number,
        oy: number,
        end: { x: number; y: number },
        width: number,
        height: number,
        walls: BoxCollider2D[],
        grid: number,
    ): void {
        const key = this._key(x, y);
        if (this._closed.has(key) || !this._cellWalkable(x, y, width, height, walls, grid)) {
            return;
        }

        const parent = this._nodes[parentIdx];
        const stepCost = ox !== 0 && oy !== 0 ? 1.4142 : 1;
        const g = parent.g + stepCost;
        const best = this._bestByKey.get(key);
        if (best !== undefined && g >= this._nodes[best].g) {
            return;
        }

        this._addNode(x, y, g, g + this._heuristic(x, y, end.x, end.y), parentIdx);
    }

    private _addNode(x: number, y: number, g: number, f: number, parent: number): void {
        const node = { x, y, g, f, parent };
        const idx = this._nodes.length;
        this._nodes.push(node);
        this._open.push(idx);
        this._bestByKey.set(this._key(x, y), idx);
    }

    private _popBestOpen(): number {
        let bestSlot = 0;
        let bestF = this._nodes[this._open[0]].f;
        for (let i = 1; i < this._open.length; i++) {
            const f = this._nodes[this._open[i]].f;
            if (f < bestF) {
                bestSlot = i;
                bestF = f;
            }
        }
        const best = this._open[bestSlot];
        const last = this._open.pop();
        if (last !== undefined && bestSlot < this._open.length) {
            this._open[bestSlot] = last;
        }
        return best;
    }

    private _emitPath(
        endIdx: number,
        exactTarget: Vec3,
        grid: number,
        width: number,
        height: number,
        walls: BoxCollider2D[],
    ): void {
        const reversed: GridNode[] = [];
        let idx = endIdx;
        while (idx >= 0) {
            const node = this._nodes[idx];
            reversed.push(node);
            idx = node.parent;
        }

        this._waypointCount = 0;
        for (let i = reversed.length - 2; i >= 0; i--) {
            const node = reversed[i];
            const x = this._gridOrigin.x + node.x * grid;
            const y = this._gridOrigin.y + node.y * grid;
            this._probePos.set(x, y, exactTarget.z);
            if (!AirWallAabb.overlapsAny(this._probePos, width, height, walls)) {
                this._pushWaypoint(this._probePos);
            }
        }
        this._pushWaypoint(exactTarget);
        this._smoothPath(width, height, walls);
    }

    private _smoothPath(width: number, height: number, walls: BoxCollider2D[]): void {
        if (this._waypointCount <= 2) {
            return;
        }
        let write = 1;
        for (let read = 1; read < this._waypointCount - 1; read++) {
            const prev = this._waypoints[write - 1];
            const next = this._waypoints[read + 1];
            if (!this._lineReachable(prev, next, width, height, walls)) {
                this._waypoints[write] = this._waypoints[read];
                write += 1;
            }
        }
        this._waypoints[write] = this._waypoints[this._waypointCount - 1];
        this._waypointCount = write + 1;
    }

    private _pushWaypoint(pos: Vec3): void {
        let wp = this._waypoints[this._waypointCount];
        if (!wp) {
            wp = new Vec3();
            this._waypoints.push(wp);
        }
        wp.set(pos);
        this._waypointCount += 1;
    }

    private _nearestWalkable(
        cell: { x: number; y: number },
        width: number,
        height: number,
        walls: BoxCollider2D[],
        grid: number,
    ): boolean {
        if (this._cellWalkable(cell.x, cell.y, width, height, walls, grid)) {
            return true;
        }
        for (let radius = 1; radius <= GameConfig.pathNearestCellRadius; radius++) {
            for (let ox = -radius; ox <= radius; ox++) {
                for (let oy = -radius; oy <= radius; oy++) {
                    if (Math.abs(ox) !== radius && Math.abs(oy) !== radius) {
                        continue;
                    }
                    const x = cell.x + ox;
                    const y = cell.y + oy;
                    if (this._cellWalkable(x, y, width, height, walls, grid)) {
                        cell.x = x;
                        cell.y = y;
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private _cellWalkable(
        x: number,
        y: number,
        width: number,
        height: number,
        walls: BoxCollider2D[],
        grid: number,
    ): boolean {
        this._probePos.set(this._gridOrigin.x + x * grid, this._gridOrigin.y + y * grid, 0);
        return !AirWallAabb.overlapsAny(
            this._probePos,
            width * GameConfig.pathProbePadding,
            height * GameConfig.pathProbePadding,
            walls,
        );
    }

    private _worldToCell(x: number, y: number, grid: number): { x: number; y: number } {
        return {
            x: Math.round((x - this._gridOrigin.x) / grid),
            y: Math.round((y - this._gridOrigin.y) / grid),
        };
    }

    private _heuristic(x: number, y: number, tx: number, ty: number): number {
        const dx = Math.abs(tx - x);
        const dy = Math.abs(ty - y);
        return Math.max(dx, dy) + (1.4142 - 1) * Math.min(dx, dy);
    }

    private _key(x: number, y: number): string {
        return `${x},${y}`;
    }

    private _writeDirection(from: Vec3, target: Vec3, outDir: Vec2): void {
        const dx = target.x - from.x;
        const dy = target.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) {
            outDir.set(0, 0);
            return;
        }
        outDir.set(dx / dist, dy / dist);
    }
}
