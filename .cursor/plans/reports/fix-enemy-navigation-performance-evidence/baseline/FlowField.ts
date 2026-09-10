export type FlowPoint = {
    x: number;
    y: number;
};

export type FlowRect = {
    xMin: number;
    yMin: number;
    xMax: number;
    yMax: number;
};

export type FlowBody = {
    width: number;
    height: number;
    offsetX?: number;
    offsetY?: number;
};

export type FlowBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

export type FlowPortal = {
    id: number;
    a: FlowPoint;
    b: FlowPoint;
    width: number;
    open: boolean;
};

export type FlowArea = {
    bounds: FlowBounds;
    obstacles: FlowRect[];
    obstacleVersion: number;
    walkablePolygons?: FlowPoint[][];
    castlePolygon?: FlowPoint[];
    portals?: FlowPortal[];
};

export type FlowDirectionResult = {
    x: number;
    y: number;
    waypoint: FlowPoint;
    fieldId: string;
    reached: boolean;
    blocked: boolean;
};

type FlowCell = {
    x: number;
    y: number;
};

type Field = {
    id: string;
    targetCell: FlowCell;
    distances: Int32Array;
    width: number;
    height: number;
    stamp: number;
    refs: number;
};

const ORTHO = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
];

const DIAGONAL = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
];

export class FlowField {
    readonly cellSize: number;
    readonly lookaheadCells: number;
    private readonly _cache = new Map<string, Field>();
    private readonly _queueX: number[] = [];
    private readonly _queueY: number[] = [];
    private _stamp = 0;
    private _buildCount = 0;

    constructor(cellSize: number, lookaheadCells: number) {
        this.cellSize = Math.max(1, cellSize);
        this.lookaheadCells = Math.max(1, Math.floor(lookaheadCells));
    }

    get buildCount(): number {
        return this._buildCount;
    }

    get debugCacheSize(): number {
        return this._cache.size;
    }

    debugRefCount(fieldId: string): number {
        return this._cache.get(fieldId)?.refs ?? 0;
    }

    clear(): void {
        this._cache.clear();
    }

    invalidate(): void {
        this.clear();
    }

    release(fieldId: string): void {
        const field = this._cache.get(fieldId);
        if (!field) {
            return;
        }
        if (field.refs <= 0) {
            return;
        }
        field.refs = Math.max(0, field.refs - 1);
    }

    prune(maxAge = 600): void {
        const minStamp = this._stamp - Math.max(1, maxAge);
        for (const [key, field] of this._cache) {
            if (field.refs <= 0 && field.stamp < minStamp) {
                this._cache.delete(key);
            }
        }
    }

    direction(
        from: FlowPoint,
        target: FlowPoint,
        body: FlowBody,
        area: FlowArea,
        retain = false,
    ): FlowDirectionResult {
        this._stamp += 1;
        const field = this._fieldFor(target, body, area);
        if (retain) {
            field.refs += 1;
        }
        field.stamp = this._stamp;

        const fromCell = this.worldToCell(from, area.bounds);
        const fromIdx = this._index(fromCell.x, fromCell.y, field.width);
        if (
            !this._insideCell(fromCell, field.width, field.height) ||
            field.distances[fromIdx] < 0
        ) {
            return this._emptyResult(field.id, from, true);
        }

        const targetCell = this.worldToCell(target, area.bounds);
        const targetDistSq = (target.x - from.x) * (target.x - from.x) +
            (target.y - from.y) * (target.y - from.y);
        const reached =
            fromCell.x === targetCell.x &&
            fromCell.y === targetCell.y &&
            targetDistSq <= Math.max(1, this.cellSize * 0.25) * Math.max(1, this.cellSize * 0.25) &&
            this.lineClear(from, target, body, area);
        if (reached) {
            return this._emptyResult(field.id, target, false, true);
        }

        if (this.lineClear(from, target, body, area)) {
            return this._dirTo(field.id, from, target, false);
        }

        let best = this._bestDescendingCell(fromCell, field, area, body);
        if (!best) {
            return this._emptyResult(field.id, from, true);
        }

        for (let i = 1; i < this.lookaheadCells; i++) {
            const next = this._bestDescendingCell(best, field, area, body);
            if (!next) {
                break;
            }
            const point = this.cellToWorld(next, area.bounds);
            if (!this.lineClear(from, point, body, area)) {
                break;
            }
            best = next;
        }

        return this._dirTo(field.id, from, this.cellToWorld(best, area.bounds), false);
    }

    fieldIdFor(target: FlowPoint, body: FlowBody, area: FlowArea): string {
        const targetCell = this.worldToCell(target, area.bounds);
        const bodyKey = this._bodyKey(body);
        return `${bodyKey}:${area.obstacleVersion}:${targetCell.x},${targetCell.y}`;
    }

    worldToCell(point: FlowPoint, bounds: FlowBounds): FlowCell {
        return {
            x: Math.floor((point.x - bounds.minX) / this.cellSize),
            y: Math.floor((point.y - bounds.minY) / this.cellSize),
        };
    }

    cellToWorld(cell: FlowCell, bounds: FlowBounds): FlowPoint {
        return {
            x: bounds.minX + cell.x * this.cellSize + this.cellSize * 0.5,
            y: bounds.minY + cell.y * this.cellSize + this.cellSize * 0.5,
        };
    }

    lineClear(from: FlowPoint, to: FlowPoint, body: FlowBody, area: FlowArea): boolean {
        if (!this._segmentRegionAllowed(from, to, area, body)) {
            return false;
        }
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, this.cellSize * 0.5)));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const p = { x: from.x + dx * t, y: from.y + dy * t };
            if (!this.pointWalkable(p, body, area)) {
                return false;
            }
        }
        return true;
    }

    sweep(
        from: FlowPoint,
        desired: FlowPoint,
        body: FlowBody,
        area: FlowArea,
    ): FlowPoint {
        const dx = desired.x - from.x;
        const dy = desired.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) {
            return { x: from.x, y: from.y };
        }
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, this.cellSize * 0.25)));
        let x = from.x;
        let y = from.y;
        for (let i = 1; i <= steps; i++) {
            const nx = from.x + (dx * i) / steps;
            const ny = from.y + (dy * i) / steps;
            if (
                this.lineClear({ x, y }, { x: nx, y: ny }, body, area)
            ) {
                x = nx;
                y = ny;
                continue;
            }
            const xOnly = { x: nx, y };
            const yOnly = { x, y: ny };
            if (this.lineClear({ x, y }, xOnly, body, area)) {
                x = nx;
            }
            if (this.lineClear({ x, y }, yOnly, body, area)) {
                y = ny;
            }
            break;
        }
        return { x, y };
    }

    pointWalkable(point: FlowPoint, body: FlowBody, area: FlowArea): boolean {
        const halfW = Math.max(0, body.width) * 0.5;
        const halfH = Math.max(0, body.height) * 0.5;
        const centerX = point.x + (body.offsetX ?? 0);
        const centerY = point.y + (body.offsetY ?? 0);
        if (
            centerX - halfW < area.bounds.minX ||
            centerX + halfW > area.bounds.maxX ||
            centerY - halfH < area.bounds.minY ||
            centerY + halfH > area.bounds.maxY
        ) {
            return false;
        }
        if (area.walkablePolygons?.length) {
            const corners = [
                { x: centerX - halfW, y: centerY - halfH },
                { x: centerX + halfW, y: centerY - halfH },
                { x: centerX + halfW, y: centerY + halfH },
                { x: centerX - halfW, y: centerY + halfH },
            ];
            for (const corner of corners) {
                if (!area.walkablePolygons.some((poly) => this.pointInPolygon(corner, poly))) {
                    return false;
                }
            }
        }
        for (const obstacle of area.obstacles) {
            if (
                centerX + halfW > obstacle.xMin &&
                centerX - halfW < obstacle.xMax &&
                centerY + halfH > obstacle.yMin &&
                centerY - halfH < obstacle.yMax
            ) {
                return false;
            }
        }
        return true;
    }

    nearestWalkable(
        target: FlowPoint,
        body: FlowBody,
        area: FlowArea,
        maxRadiusCells = 8,
    ): FlowPoint | null {
        const center = this.worldToCell(target, area.bounds);
        const width = this._gridWidth(area.bounds);
        const height = this._gridHeight(area.bounds);
        const probe = (cell: FlowCell, preferTarget = false): FlowPoint | null => {
            if (!this._insideCell(cell, width, height)) {
                return null;
            }
            const point = preferTarget ? target : this.cellToWorld(cell, area.bounds);
            return this.pointWalkable(point, body, area) ? point : null;
        };
        const own = probe(center, true);
        if (own) {
            return own;
        }
        for (let r = 1; r <= maxRadiusCells; r++) {
            for (let ox = -r; ox <= r; ox++) {
                for (let oy = -r; oy <= r; oy++) {
                    if (Math.abs(ox) !== r && Math.abs(oy) !== r) {
                        continue;
                    }
                    const found = probe({ x: center.x + ox, y: center.y + oy });
                    if (found) {
                        return found;
                    }
                }
            }
        }
        return null;
    }

    nearestReachableWalkable(
        from: FlowPoint,
        target: FlowPoint,
        body: FlowBody,
        area: FlowArea,
        maxRadiusCells = 8,
    ): FlowPoint | null {
        const own = this.nearestWalkable(target, body, area, 0);
        if (own && this._canReach(from, own, body, area)) {
            return own;
        }
        const center = this.worldToCell(target, area.bounds);
        const width = this._gridWidth(area.bounds);
        const height = this._gridHeight(area.bounds);
        let best: FlowPoint | null = null;
        let bestDist = Number.POSITIVE_INFINITY;
        for (let r = 1; r <= maxRadiusCells; r++) {
            for (let ox = -r; ox <= r; ox++) {
                for (let oy = -r; oy <= r; oy++) {
                    if (Math.abs(ox) !== r && Math.abs(oy) !== r) {
                        continue;
                    }
                    const cell = { x: center.x + ox, y: center.y + oy };
                    if (!this._insideCell(cell, width, height)) {
                        continue;
                    }
                    const point = this.cellToWorld(cell, area.bounds);
                    if (
                        !this.pointWalkable(point, body, area) ||
                        !this._canReach(from, point, body, area) ||
                        !this._approachLineBlockedOnlyNearTarget(point, target, body, area)
                    ) {
                        continue;
                    }
                    const d = (point.x - target.x) * (point.x - target.x) +
                        (point.y - target.y) * (point.y - target.y);
                    if (d < bestDist) {
                        bestDist = d;
                        best = point;
                    }
                }
            }
            if (best) {
                return best;
            }
        }
        return null;
    }

    separate(
        self: FlowPoint,
        peers: FlowPoint[],
        radius: number,
        maxPush: number,
        seed = 0,
    ): FlowPoint {
        let x = 0;
        let y = 0;
        for (let i = 0; i < peers.length; i++) {
            const peer = peers[i];
            const dx = self.x - peer.x;
            const dy = self.y - peer.y;
            const distSq = dx * dx + dy * dy;
            if (distSq >= radius * radius) {
                continue;
            }
            if (distSq < 0.0001) {
                const angle = ((i + 1 + seed) * 2.399963229728653) % (Math.PI * 2);
                x += Math.cos(angle) * maxPush;
                y += Math.sin(angle) * maxPush;
                continue;
            }
            const dist = Math.sqrt(distSq);
            const push = ((radius - dist) / radius) * maxPush;
            x += (dx / dist) * push;
            y += (dy / dist) * push;
        }
        const mag = Math.sqrt(x * x + y * y);
        if (mag > maxPush && mag > 0.001) {
            x = (x / mag) * maxPush;
            y = (y / mag) * maxPush;
        }
        return { x, y };
    }

    pointInPolygon(point: FlowPoint, polygon: FlowPoint[] | undefined): boolean {
        if (!polygon || polygon.length < 3) {
            return false;
        }
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const pi = polygon[i];
            const pj = polygon[j];
            const intersects =
                pi.y > point.y !== pj.y > point.y &&
                point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
            if (intersects) {
                inside = !inside;
            }
        }
        return inside;
    }

    segmentUsesOpenPortal(
        from: FlowPoint,
        to: FlowPoint,
        area: FlowArea,
        body: FlowBody,
    ): boolean {
        for (const portal of area.portals ?? []) {
            if (!portal.open || portal.width < Math.max(body.width, body.height)) {
                continue;
            }
            if (segmentsIntersect(from, to, portal.a, portal.b)) {
                return true;
            }
        }
        return false;
    }

    private _fieldFor(target: FlowPoint, body: FlowBody, area: FlowArea): Field {
        const id = this.fieldIdFor(target, body, area);
        const cached = this._cache.get(id);
        if (cached) {
            return cached;
        }
        const width = this._gridWidth(area.bounds);
        const height = this._gridHeight(area.bounds);
        const distances = new Int32Array(width * height);
        distances.fill(-1);
        const targetPoint = this.nearestWalkable(target, body, area) ?? target;
        const targetCell = this.worldToCell(targetPoint, area.bounds);
        const field: Field = {
            id,
            targetCell,
            distances,
            width,
            height,
            stamp: this._stamp,
            refs: 0,
        };
        this._bfs(field, body, area);
        this._cache.set(id, field);
        this._buildCount += 1;
        return field;
    }

    private _bfs(field: Field, body: FlowBody, area: FlowArea): void {
        this._queueX.length = 0;
        this._queueY.length = 0;
        if (!this._insideCell(field.targetCell, field.width, field.height)) {
            return;
        }
        const targetPoint = this.cellToWorld(field.targetCell, area.bounds);
        if (!this.pointWalkable(targetPoint, body, area)) {
            return;
        }
        let read = 0;
        field.distances[this._index(field.targetCell.x, field.targetCell.y, field.width)] = 0;
        this._queueX.push(field.targetCell.x);
        this._queueY.push(field.targetCell.y);
        while (read < this._queueX.length) {
            const x = this._queueX[read];
            const y = this._queueY[read];
            read += 1;
            const baseDist = field.distances[this._index(x, y, field.width)];
            for (const [ox, oy] of ORTHO) {
                const nx = x + ox;
                const ny = y + oy;
                if (!this._insideCell({ x: nx, y: ny }, field.width, field.height)) {
                    continue;
                }
                const idx = this._index(nx, ny, field.width);
                if (field.distances[idx] >= 0) {
                    continue;
                }
                const p = this.cellToWorld({ x: nx, y: ny }, area.bounds);
                if (!this.pointWalkable(p, body, area)) {
                    continue;
                }
                const cur = this.cellToWorld({ x, y }, area.bounds);
                if (!this._segmentRegionAllowed(cur, p, area, body)) {
                    continue;
                }
                field.distances[idx] = baseDist + 1;
                this._queueX.push(nx);
                this._queueY.push(ny);
            }
        }
    }

    private _bestDescendingCell(
        from: FlowCell,
        field: Field,
        area: FlowArea,
        body: FlowBody,
    ): FlowCell | null {
        const curIdx = this._index(from.x, from.y, field.width);
        const curDist = field.distances[curIdx];
        if (curDist <= 0) {
            return null;
        }
        let best: FlowCell | null = null;
        let bestDist = curDist;
        const tryCell = (x: number, y: number): void => {
            if (!this._insideCell({ x, y }, field.width, field.height)) {
                return;
            }
            const d = field.distances[this._index(x, y, field.width)];
            if (d >= 0 && d < bestDist) {
                bestDist = d;
                best = { x, y };
            }
        };
        for (const [ox, oy] of ORTHO) {
            tryCell(from.x + ox, from.y + oy);
        }
        for (const [ox, oy] of DIAGONAL) {
            const nx = from.x + ox;
            const ny = from.y + oy;
            const sideA = { x: from.x + ox, y: from.y };
            const sideB = { x: from.x, y: from.y + oy };
            if (
                !this._cellWalkable(sideA, field, area, body) ||
                !this._cellWalkable(sideB, field, area, body)
            ) {
                continue;
            }
            tryCell(nx, ny);
        }
        return best;
    }

    private _cellWalkable(cell: FlowCell, field: Field, area: FlowArea, body: FlowBody): boolean {
        if (!this._insideCell(cell, field.width, field.height)) {
            return false;
        }
        return this.pointWalkable(this.cellToWorld(cell, area.bounds), body, area);
    }

    private _segmentRegionAllowed(
        from: FlowPoint,
        to: FlowPoint,
        area: FlowArea,
        body: FlowBody,
    ): boolean {
        const poly = area.castlePolygon;
        if (!poly || poly.length < 3) {
            return true;
        }
        const fromInside = this.pointInPolygon(from, poly);
        const toInside = this.pointInPolygon(to, poly);
        const crossings = segmentPolygonCrossings(from, to, poly);
        if (fromInside === toInside && crossings.length === 0) {
            return true;
        }
        if (crossings.length === 0) {
            return true;
        }
        for (const crossing of crossings) {
            if (!this._pointCoveredByOpenPortal(crossing, area, body)) {
                return false;
            }
        }
        return true;
    }

    private _pointCoveredByOpenPortal(point: FlowPoint, area: FlowArea, body: FlowBody): boolean {
        for (const portal of area.portals ?? []) {
            if (!portal.open || portal.width < Math.max(body.width, body.height)) {
                continue;
            }
            const tolerance = Math.max(this.cellSize * 0.25, portal.width * 0.5);
            if (distancePointToSegment(point, portal.a, portal.b) <= tolerance) {
                return true;
            }
        }
        return false;
    }

    private _gridWidth(bounds: FlowBounds): number {
        return Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / this.cellSize));
    }

    private _gridHeight(bounds: FlowBounds): number {
        return Math.max(1, Math.ceil((bounds.maxY - bounds.minY) / this.cellSize));
    }

    private _insideCell(cell: FlowCell, width: number, height: number): boolean {
        return cell.x >= 0 && cell.y >= 0 && cell.x < width && cell.y < height;
    }

    private _index(x: number, y: number, width: number): number {
        return y * width + x;
    }

    private _bodyKey(body: FlowBody): string {
        return `${Math.ceil(body.width)}x${Math.ceil(body.height)}@${Math.round((body.offsetX ?? 0) * 10)},${Math.round((body.offsetY ?? 0) * 10)}`;
    }

    private _dirTo(
        fieldId: string,
        from: FlowPoint,
        to: FlowPoint,
        blocked: boolean,
    ): FlowDirectionResult {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.001) {
            return this._emptyResult(fieldId, to, blocked, true);
        }
        return {
            x: dx / dist,
            y: dy / dist,
            waypoint: { x: to.x, y: to.y },
            fieldId,
            reached: false,
            blocked,
        };
    }

    private _emptyResult(
        fieldId: string,
        waypoint: FlowPoint,
        blocked: boolean,
        reached = false,
    ): FlowDirectionResult {
        return { x: 0, y: 0, waypoint: { x: waypoint.x, y: waypoint.y }, fieldId, blocked, reached };
    }

    private _canReach(from: FlowPoint, target: FlowPoint, body: FlowBody, area: FlowArea): boolean {
        const result = this.direction(from, target, body, area);
        return !result.blocked;
    }

    private _approachLineBlockedOnlyNearTarget(
        from: FlowPoint,
        target: FlowPoint,
        body: FlowBody,
        area: FlowArea,
    ): boolean {
        if (!this._segmentRegionAllowed(from, target, area, body)) {
            return false;
        }
        const dx = target.x - from.x;
        const dy = target.y - from.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const allowedBlockDistance = this.cellSize * 1.5 + Math.max(body.width, body.height) * 0.5;
        const steps = Math.max(1, Math.ceil(dist / Math.max(1, this.cellSize * 0.5)));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const p = { x: from.x + dx * t, y: from.y + dy * t };
            if (this.pointWalkable(p, body, area)) {
                continue;
            }
            const px = target.x - p.x;
            const py = target.y - p.y;
            return Math.sqrt(px * px + py * py) <= allowedBlockDistance;
        }
        return true;
    }
}

function segmentsIntersect(a: FlowPoint, b: FlowPoint, c: FlowPoint, d: FlowPoint): boolean {
    const ab1 = orient(a, b, c);
    const ab2 = orient(a, b, d);
    const cd1 = orient(c, d, a);
    const cd2 = orient(c, d, b);
    if (ab1 === 0 && onSegment(a, c, b)) {
        return true;
    }
    if (ab2 === 0 && onSegment(a, d, b)) {
        return true;
    }
    if (cd1 === 0 && onSegment(c, a, d)) {
        return true;
    }
    if (cd2 === 0 && onSegment(c, b, d)) {
        return true;
    }
    return (ab1 > 0) !== (ab2 > 0) && (cd1 > 0) !== (cd2 > 0);
}

function orient(a: FlowPoint, b: FlowPoint, c: FlowPoint): number {
    const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    if (Math.abs(v) < 0.000001) {
        return 0;
    }
    return v > 0 ? 1 : -1;
}

function onSegment(a: FlowPoint, p: FlowPoint, b: FlowPoint): boolean {
    return (
        p.x >= Math.min(a.x, b.x) - 0.000001 &&
        p.x <= Math.max(a.x, b.x) + 0.000001 &&
        p.y >= Math.min(a.y, b.y) - 0.000001 &&
        p.y <= Math.max(a.y, b.y) + 0.000001
    );
}

function segmentIntersectsPolygon(a: FlowPoint, b: FlowPoint, polygon: FlowPoint[]): boolean {
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (segmentsIntersect(a, b, polygon[j], polygon[i])) {
            return true;
        }
    }
    return false;
}

function segmentPolygonCrossings(a: FlowPoint, b: FlowPoint, polygon: FlowPoint[]): FlowPoint[] {
    const out: FlowPoint[] = [];
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const hit = segmentIntersectionPoint(a, b, polygon[j], polygon[i]);
        if (!hit) {
            continue;
        }
        if (!out.some((p) => Math.abs(p.x - hit.x) < 0.0001 && Math.abs(p.y - hit.y) < 0.0001)) {
            out.push(hit);
        }
    }
    return out;
}

function segmentIntersectionPoint(
    a: FlowPoint,
    b: FlowPoint,
    c: FlowPoint,
    d: FlowPoint,
): FlowPoint | null {
    const r = { x: b.x - a.x, y: b.y - a.y };
    const s = { x: d.x - c.x, y: d.y - c.y };
    const denom = r.x * s.y - r.y * s.x;
    if (Math.abs(denom) < 0.000001) {
        return segmentsIntersect(a, b, c, d) ? c : null;
    }
    const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / denom;
    const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / denom;
    if (t < -0.000001 || t > 1.000001 || u < -0.000001 || u > 1.000001) {
        return null;
    }
    return { x: a.x + t * r.x, y: a.y + t * r.y };
}

function distancePointToSegment(p: FlowPoint, a: FlowPoint, b: FlowPoint): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.000001) {
        const px = p.x - a.x;
        const py = p.y - a.y;
        return Math.sqrt(px * px + py * py);
    }
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    const px = p.x - x;
    const py = p.y - y;
    return Math.sqrt(px * px + py * py);
}
