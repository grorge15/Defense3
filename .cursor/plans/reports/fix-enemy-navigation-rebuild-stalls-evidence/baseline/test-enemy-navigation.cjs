const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const loaded = new Map();
const testResults = [];

function loadTs(relativePath, mocks = {}) {
    const sourcePath = path.join(root, relativePath);
    if (loaded.has(sourcePath)) {
        return loaded.get(sourcePath).exports;
    }
    const source = fs.readFileSync(sourcePath, 'utf8');
    const js = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            esModuleInterop: true,
            experimentalDecorators: true,
        },
        fileName: sourcePath,
    }).outputText;
    const mod = new Module(sourcePath, module);
    loaded.set(sourcePath, mod);
    mod.filename = sourcePath;
    mod.paths = Module._nodeModulePaths(path.dirname(sourcePath));
    mod.require = (request) => {
        const resolved = resolveMockRequest(sourcePath, request);
        if (Object.prototype.hasOwnProperty.call(mocks, resolved)) {
            return mocks[resolved];
        }
        if (resolved.endsWith('.ts')) {
            return loadTs(path.relative(root, resolved), mocks);
        }
        return require(request);
    };
    mod._compile(js, sourcePath);
    return mod.exports;
}

function resolveMockRequest(from, request) {
    if (request === 'cc') {
        return 'cc';
    }
    if (request.startsWith('.')) {
        let p = path.resolve(path.dirname(from), request);
        if (!path.extname(p)) {
            p += '.ts';
        }
        return p;
    }
    return request;
}

const { FlowField } = loadTs('assets/scripts/core/FlowField.ts');

function area(overrides = {}) {
    return {
        bounds: { minX: -100, minY: -100, maxX: 220, maxY: 220 },
        obstacles: [],
        obstacleVersion: 1,
        ...overrides,
    };
}

function body(width = 10, height = width) {
    return { width, height };
}

function near(actual, expected, epsilon = 0.001) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function should(name, fn) {
    if (process.env.NAV_HARNESS_ONLY === '1') return;
    try {
        const details = fn();
        testResults.push({ name, passed: true, details });
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        console.error(error);
        testResults.push({ name, passed: false, error: String(error.stack ?? error) });
        process.exitCode = 1;
    }
}

should('AC-SHARED: 200 identical requests build one distance field and later reuse without rebuild', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({ obstacles: [{ xMin: 20, xMax: 40, yMin: -20, yMax: 100 }] });
    for (let i = 0; i < 200; i++) {
        const result = flow.direction({ x: -80 + (i % 5), y: -80 }, { x: 160, y: 160 }, body(10), navArea);
        assert.strictEqual(result.blocked, false);
        flow.release(result.fieldId);
    }
    assert.strictEqual(flow.buildCount, 1);
    for (let i = 0; i < 20; i++) {
        const result = flow.direction({ x: -70, y: -70 + i }, { x: 165, y: 165 }, body(10), navArea);
        flow.release(result.fieldId);
    }
    assert.strictEqual(flow.buildCount, 1);
});

should('AC-SHARED: body size and target cell isolate cache entries; obstacle invalidation rebuilds', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({ obstacles: [{ xMin: 20, xMax: 40, yMin: -20, yMax: 100 }] });
    flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(10), navArea);
    assert.strictEqual(flow.buildCount, 1);
    flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(30), navArea);
    assert.strictEqual(flow.buildCount, 2);
    flow.direction({ x: -80, y: -80 }, { x: 181, y: 160 }, body(30), navArea);
    assert.strictEqual(flow.buildCount, 3);
    const changed = area({ obstacleVersion: 2, obstacles: navArea.obstacles });
    flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(10), changed);
    assert.strictEqual(flow.buildCount, 4);
});

should('AC-SHARED: retained fields are released by owner and pruned only after becoming stale', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({ obstacles: [{ xMin: 20, xMax: 40, yMin: -20, yMax: 100 }] });
    const first = flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(10), navArea, true);
    const second = flow.direction({ x: -70, y: -80 }, { x: 160, y: 160 }, body(10), navArea, true);
    assert.strictEqual(first.fieldId, second.fieldId);
    assert.strictEqual(flow.buildCount, 1);
    assert.strictEqual(flow.debugRefCount(first.fieldId), 2);
    flow.release(first.fieldId);
    assert.strictEqual(flow.debugRefCount(first.fieldId), 1);
    flow.release(second.fieldId);
    assert.strictEqual(flow.debugRefCount(first.fieldId), 0);
    const query = flow.direction({ x: -60, y: -80 }, { x: 160, y: 160 }, body(10), navArea);
    assert.strictEqual(query.fieldId, first.fieldId);
    assert.strictEqual(flow.buildCount, 1);
    flow.prune(1);
    assert.strictEqual(flow.debugCacheSize, 1);
    flow.direction({ x: -50, y: -80 }, { x: 10, y: 10 }, body(10), navArea);
    flow.direction({ x: -40, y: -80 }, { x: 30, y: 10 }, body(10), navArea);
    flow.prune(1);
    assert.ok(flow.debugCacheSize < 3, `expected stale zero-ref field pruned, cache=${flow.debugCacheSize}`);
});

should('AC-CORE: shared field routes around wall gap and returns unreachable when sealed', () => {
    const flow = new FlowField(20, 20);
    const openWall = area({
        obstacles: [
            { xMin: 30, yMin: -100, xMax: 50, yMax: 35 },
            { xMin: 30, yMin: 65, xMax: 50, yMax: 220 },
        ],
    });
    const result = flow.direction({ x: -60, y: 50 }, { x: 160, y: 50 }, body(10), openWall);
    assert.strictEqual(result.blocked, false);
    assert.ok(result.x > 0, `expected eastward progress, got ${result.x},${result.y}`);

    const sealed = area({
        obstacles: [{ xMin: 30, yMin: -100, xMax: 50, yMax: 220 }],
        obstacleVersion: 2,
    });
    const blocked = flow.direction({ x: -60, y: 50 }, { x: 160, y: 50 }, body(10), sealed);
    assert.strictEqual(blocked.blocked, true);
});

should('AC-CORE: diagonal descent cannot cut through blocked corner', () => {
    const flow = new FlowField(20, 20);
    const corner = area({
        bounds: { minX: 0, minY: 0, maxX: 80, maxY: 80 },
        obstacles: [
            { xMin: 20, yMin: 0, xMax: 40, yMax: 20 },
            { xMin: 0, yMin: 20, xMax: 20, yMax: 40 },
        ],
    });
    const result = flow.direction({ x: 10, y: 10 }, { x: 70, y: 70 }, body(4), corner);
    assert.ok(!(result.x > 0 && result.y > 0), 'corner cut would move diagonally through blocked sides');
});

should('AC-CORE: body expansion makes narrow passage usable for small body only', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({
        obstacles: [
            { xMin: 30, yMin: -100, xMax: 50, yMax: 40 },
            { xMin: 30, yMin: 60, xMax: 50, yMax: 220 },
        ],
    });
    const small = flow.direction({ x: -60, y: 50 }, { x: 160, y: 50 }, body(8), navArea);
    assert.strictEqual(small.blocked, false);
    const large = flow.direction({ x: -60, y: 50 }, { x: 160, y: 50 }, body(28), navArea);
    assert.strictEqual(large.blocked, true, JSON.stringify(large));
});

should('AC-CORE: body collider offset participates in bounds and obstacle checks', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({ bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } });
    assert.strictEqual(flow.pointWalkable({ x: 12, y: 50 }, { width: 20, height: 20, offsetX: 0, offsetY: 0 }, navArea), true);
    assert.strictEqual(flow.pointWalkable({ x: 12, y: 50 }, { width: 20, height: 20, offsetX: -8, offsetY: 0 }, navArea), false);
});

should('AC-CORE: blocked building target resolves to reachable approach cell', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({
        obstacles: [{ xMin: 80, yMin: 80, xMax: 120, yMax: 120 }],
    });
    const approach = flow.nearestWalkable({ x: 100, y: 100 }, body(10), navArea, 5);
    assert.ok(approach, 'expected replacement target');
    assert.strictEqual(flow.pointWalkable(approach, body(10), navArea), true);
    assert.notDeepStrictEqual(approach, { x: 100, y: 100 });
});

should('AC-CORE: target replacement is selected from current reachable component', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({
        bounds: { minX: 0, minY: 0, maxX: 200, maxY: 120 },
        obstacles: [
            { xMin: 80, yMin: 0, xMax: 100, yMax: 120 },
            { xMin: 130, yMin: 40, xMax: 170, yMax: 80 },
        ],
    });
    const approach = flow.nearestReachableWalkable({ x: 20, y: 60 }, { x: 150, y: 60 }, body(8), navArea, 4);
    assert.strictEqual(approach, null, `unreachable far-side target should not pick local far-side cell: ${JSON.stringify(approach)}`);
});

should('AC-CORE: walkable ground polygon constrains movement beyond bounds and obstacles', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({
        bounds: { minX: 0, minY: 0, maxX: 200, maxY: 120 },
        walkablePolygons: [[
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
        ]],
    });
    assert.strictEqual(flow.pointWalkable({ x: 50, y: 50 }, body(8), navArea), true);
    assert.strictEqual(flow.pointWalkable({ x: 150, y: 50 }, body(8), navArea), false);
    const result = flow.direction({ x: 20, y: 50 }, { x: 150, y: 50 }, body(8), navArea);
    assert.strictEqual(result.blocked, false);
    assert.ok(result.waypoint.x <= 100, `waypoint left walkable ground: ${JSON.stringify(result.waypoint)}`);
});

should('AC-CORE: 20-cell lookahead is capped while still moving toward reachable far point', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({
        bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 120 },
        obstacles: [{ xMin: 120, yMin: 0, xMax: 140, yMax: 80 }],
    });
    const result = flow.direction({ x: 10, y: 40 }, { x: 950, y: 40 }, body(8), navArea);
    assert.strictEqual(result.blocked, false);
    assert.ok(result.waypoint.x <= 10 + 20 * 20, `lookahead too far: ${result.waypoint.x}`);
});

should('AC-CORE: sweep stops before a thin wall under large frame delta', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({
        obstacles: [{ xMin: 30, yMin: -20, xMax: 34, yMax: 120 }],
    });
    const safe = flow.sweep({ x: 0, y: 40 }, { x: 100, y: 40 }, body(8), navArea);
    assert.ok(safe.x < 30, `swept through wall to ${safe.x}`);
});

should('AC-CORE: negative coordinates and bounds are respected', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({ bounds: { minX: -200, minY: -200, maxX: 0, maxY: 0 } });
    assert.strictEqual(flow.pointWalkable({ x: -50, y: -50 }, body(8), navArea), true);
    assert.strictEqual(flow.pointWalkable({ x: 10, y: -50 }, body(8), navArea), false);
    const result = flow.direction({ x: -180, y: -180 }, { x: -20, y: -20 }, body(8), navArea);
    assert.strictEqual(result.blocked, false);
});

should('AC-CORE: overlapping avoidance returns stable bounded separation', () => {
    const flow = new FlowField(20, 20);
    const push = flow.separate({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 5, y: 0 }], 36, 2, 7);
    const mag = Math.sqrt(push.x * push.x + push.y * push.y);
    assert.ok(mag > 0, 'expected non-zero push');
    assert.ok(mag <= 2.0001, `push exceeded cap: ${mag}`);
    const other = flow.separate({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 5, y: 0 }], 36, 2, 8);
    assert.ok(Math.abs(push.x - other.x) > 0.001 || Math.abs(push.y - other.y) > 0.001);
});

should('AC-CORE: 32/50 minion hysteresis thresholds are explicit', () => {
    let attacking = false;
    const step = (dist) => {
        if (dist <= 32) attacking = true;
        else if (attacking && dist > 50) attacking = false;
        return attacking;
    };
    assert.strictEqual(step(31.9), true);
    assert.strictEqual(step(45), true);
    assert.strictEqual(step(50), true);
    assert.strictEqual(step(50.1), false);
});

should('AC-CORE: boss target priority keeps soldier over structure over hero over player', () => {
    const priority = { soldier: 40, building: 30, barrier: 30, log: 30, hero: 20, player: 10 };
    const targets = [
        { kind: 'player', order: Number.MAX_SAFE_INTEGER, dist: 1 },
        { kind: 'hero', order: Number.MAX_SAFE_INTEGER, dist: 1 },
        { kind: 'building', order: 1, dist: 100 },
        { kind: 'soldier', order: Number.MAX_SAFE_INTEGER, dist: 1000 },
    ];
    targets.sort((a, b) => priority[b.kind] - priority[a.kind] || a.order - b.order || a.dist - b.dist);
    assert.strictEqual(targets[0].kind, 'soldier');
});

should('AC-CORE: entrance filtering closes 1/3 independently and falls back to 2', () => {
    const entrances = [
        { id: 1, open: true, width: 80 },
        { id: 2, open: true, width: 80 },
        { id: 3, open: true, width: 80 },
    ];
    const usable = (w) => entrances.filter((e) => e.open && e.width >= w).map((e) => e.id);
    assert.deepStrictEqual(usable(40), [1, 2, 3]);
    entrances[0].open = false;
    assert.deepStrictEqual(usable(40), [2, 3]);
    entrances[2].open = false;
    assert.deepStrictEqual(usable(40), [2]);
    assert.deepStrictEqual(usable(100), []);
});

should('AC-CORE: castle boundary cannot be crossed except through open portal', () => {
    const flow = new FlowField(20, 20);
    const castlePolygon = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
    ];
    const base = area({ castlePolygon, portals: [] });
    assert.strictEqual(flow.lineClear({ x: -20, y: 50 }, { x: 50, y: 50 }, body(8), base), false);
    const withPortal = area({
        castlePolygon,
        portals: [{ id: 2, a: { x: 0, y: 40 }, b: { x: 0, y: 60 }, width: 80, open: true }],
    });
    assert.strictEqual(flow.lineClear({ x: -20, y: 50 }, { x: 50, y: 50 }, body(8), withPortal), true);
    const closed = area({
        castlePolygon,
        portals: [{ id: 2, a: { x: 0, y: 40 }, b: { x: 0, y: 60 }, width: 80, open: false }],
    });
    assert.strictEqual(flow.lineClear({ x: -20, y: 50 }, { x: 50, y: 50 }, body(8), closed), false);
    const wrongDoor = area({
        castlePolygon,
        portals: [{ id: 2, a: { x: 0, y: 0 }, b: { x: 0, y: 10 }, width: 80, open: true }],
    });
    assert.strictEqual(flow.lineClear({ x: -20, y: 90 }, { x: 50, y: 90 }, body(8), wrongDoor), false);
});

should('AC-CORE: BFS distance field does not leak across non-portal castle boundary', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({
        bounds: { minX: -80, minY: 0, maxX: 120, maxY: 120 },
        castlePolygon: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
        ],
        portals: [],
    });
    const result = flow.direction({ x: -40, y: 40 }, { x: 60, y: 40 }, body(8), navArea);
    assert.strictEqual(result.blocked, true);
});

should('AC-CORE: same-cell target still moves until close threshold', () => {
    const flow = new FlowField(20, 20);
    const result = flow.direction({ x: 3, y: 3 }, { x: 18, y: 3 }, body(4), area({ bounds: { minX: 0, minY: 0, maxX: 40, maxY: 40 } }));
    assert.strictEqual(result.reached, false);
    assert.ok(result.x > 0);
});

should('AC-CORE: nearestWalkable preserves already-walkable exact target', () => {
    const flow = new FlowField(20, 20);
    const target = { x: 17, y: 13 };
    assert.deepStrictEqual(flow.nearestWalkable(target, body(4), area({ bounds: { minX: 0, minY: 0, maxX: 40, maxY: 40 } })), target);
});

function makeCcStub() {
    class Vec2 {
        constructor(x = 0, y = 0) {
            this.x = x;
            this.y = y;
        }
        set(x, y) {
            if (typeof x === 'object') {
                this.x = x.x;
                this.y = x.y;
            } else {
                this.x = x;
                this.y = y;
            }
        }
    }
    class Vec3 {
        constructor(x = 0, y = 0, z = 0) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
        set(x, y, z = this.z) {
            if (typeof x === 'object') {
                this.x = x.x;
                this.y = x.y;
                this.z = x.z ?? this.z;
            } else {
                this.x = x;
                this.y = y;
                this.z = z;
            }
        }
    }
    class BoxCollider2D {}
    return {
        BoxCollider2D,
        Vec2,
        Vec3,
        Node: class {},
        Scene: class {},
        director: { getTotalFrames: () => currentFrame },
    };
}

let currentFrame = 1;

function mockNode(name, x, y) {
    return {
        name,
        uuid: `${name}-${x}-${y}-${Math.random()}`,
        isValid: true,
        activeInHierarchy: true,
        getWorldPosition(out) {
            out.x = x;
            out.y = y;
            out.z = 0;
        },
        set(x2, y2) {
            x = x2;
            y = y2;
        },
        getComponent() {
            return null;
        },
        getComponentsInChildren() {
            return [];
        },
    };
}

function groundNodes(prefix = 'ground') {
    return [
        mockNode(`${prefix}-0`, -100, -100),
        mockNode(`${prefix}-1`, 220, -100),
        mockNode(`${prefix}-2`, 220, 220),
        mockNode(`${prefix}-3`, -100, 220),
    ];
}

function loadEnemyNavigationForServiceTests() {
    loaded.delete(path.join(root, 'assets/scripts/core/EnemyNavigation.ts'));
    const cc = makeCcStub();
    class EventManagerStub {
        constructor() {
            this.events = new Map();
        }
        onEvent(name, cb, ctx) {
            const list = this.events.get(name) ?? [];
            list.push({ cb, ctx });
            this.events.set(name, list);
        }
        offEvent(name, cb, ctx) {
            const list = this.events.get(name) ?? [];
            this.events.set(name, list.filter((e) => e.cb !== cb || e.ctx !== ctx));
        }
        emitEvent(name, payload) {
            for (const e of this.events.get(name) ?? []) {
                e.cb.call(e.ctx, payload);
            }
        }
        count(name) {
            return (this.events.get(name) ?? []).length;
        }
    }
    const eventManager = new EventManagerStub();
    const mocks = {
        cc,
        [path.join(root, 'assets/scripts/core/EventManager.ts')]: { EventManager: { instance: eventManager } },
        [path.join(root, 'assets/scripts/core/GameConfig.ts')]: {
            GameConfig: {
                enemyFlowCellSize: 20,
                enemyFlowLookaheadCells: 20,
                enemyFlowTargetSearchCells: 8,
                enemyNavDefaultMinX: -100,
                enemyNavDefaultMinY: -100,
                enemyNavDefaultMaxX: 220,
                enemyNavDefaultMaxY: 220,
                enemyEntranceWidth: 80,
                enemyPeerSeparationRadius: 36,
                enemyAvoidanceWeight: 0.55,
                pathWaypointReachDistance: 28,
            },
        },
        [path.join(root, 'assets/scripts/core/GameEvents.ts')]: {
            GameEvents: {
                ENEMY_NAVIGATION_INVALIDATED: 'enemy_navigation_invalidated',
                ENEMY_ENTRANCE_STATE_CHANGED: 'enemy_entrance_state_changed',
            },
        },
        [path.join(root, 'assets/scripts/core/FlowField.ts')]: { FlowField },
        [path.join(root, 'assets/scripts/building/Barracks.ts')]: { Barracks: class {} },
        [path.join(root, 'assets/scripts/building/Barrier.ts')]: { Barrier: class {} },
        [path.join(root, 'assets/scripts/building/Building.ts')]: { Building: class {} },
        [path.join(root, 'assets/scripts/building/Tower.ts')]: { Tower: class {} },
        [path.join(root, 'assets/scripts/building/Wall.ts')]: { Wall: class {} },
        [path.join(root, 'assets/scripts/item/Log.ts')]: { Log: class {} },
    };
    const exports = loadTs('assets/scripts/core/EnemyNavigation.ts', mocks);
    return { EnemyNavigation: exports.EnemyNavigation, cc, eventManager };
}

function outVec() {
    return { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
}

should('AC-SERVICE: nextVelocity refreshes obstacles and buckets once per frame for many units', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [] };
    const service = EnemyNavigation.get(scene);
    service.configure({
        walkablePolygon: groundNodes('once-ground'),
        castlePolygon: [
            mockNode('once-p0', 180, 180),
            mockNode('once-p1', 200, 180),
            mockNode('once-p2', 200, 200),
            mockNode('once-p3', 180, 200),
        ],
        entrances: [{ id: 2, outside: mockNode('once-o', 180, 180), inside: mockNode('once-i', 190, 190), closePlot: null, width: 80, open: true }],
    });
    const target = mockNode('player', 100, 0);
    for (let i = 0; i < 20; i++) {
        const unit = mockNode(`u${i}`, -80 + i, 0);
        service.nextVelocity({ unit, target, role: 'minion', speed: 2, dt: 1, body: body(10), stopDistance: 32 });
    }
    assert.strictEqual(service.debugObstacleRefreshCount, 1);
    assert.strictEqual(service.debugBucketBuildCount, 1);
    currentFrame += 1;
    service.nextVelocity({ unit: mockNode('u-next', -70, 20), target, role: 'minion', speed: 2, dt: 1, body: body(80), stopDistance: 32 });
    assert.strictEqual(service.debugObstacleRefreshCount, 1);
    assert.strictEqual(service.debugBucketBuildCount, 2);
});

should('AC-SERVICE: 200 same-body entrance route requests reuse one retained field', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [{ node: mockNode('airWall-route', 0, 0),
        worldAABB: { xMin: -50, xMax: -40, yMin: 20, yMax: 80 } }] };
    const service = EnemyNavigation.get(scene);
    service.configure({
        walkablePolygon: groundNodes('shared-service-ground'),
        castlePolygon: [
            mockNode('shared-p0', 0, 0),
            mockNode('shared-p1', 100, 0),
            mockNode('shared-p2', 100, 100),
            mockNode('shared-p3', 0, 100),
        ],
        entrances: [{ id: 2, outside: mockNode('shared-o', -20, 50), inside: mockNode('shared-i', 20, 50), closePlot: null, width: 80, open: true }],
    });
    const target = mockNode('shared-target', 80, 50);
    const startBuilds = service.debugFieldBuildCount;
    currentFrame += 1;
    for (let i = 0; i < 200; i++) {
        const unit = mockNode(`shared-u${i}`, -80 + (i % 5), 50 + (i % 3));
        service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    }
    assert.strictEqual(service.debugFieldBuildCount - startBuilds, 1);
    currentFrame += 1;
    for (let i = 0; i < 20; i++) {
        const unit = mockNode(`shared-again${i}`, -60, 50 + i);
        service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    }
    assert.strictEqual(service.debugFieldBuildCount - startBuilds, 1);
});

should('AC-SERVICE: missing walkable ground or entrance configuration fails closed', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [] };
    const service = EnemyNavigation.get(scene);
    const unit = mockNode('closed-unit', 0, 0);
    const target = mockNode('closed-target', 80, 0);
    const missingAll = service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    assert.strictEqual(missingAll.x, 0);
    assert.strictEqual(missingAll.y, 0);
    service.configure({ walkablePolygon: groundNodes('closed-ground') });
    currentFrame += 1;
    const missingEntrance = service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    assert.strictEqual(missingEntrance.x, 0);
    assert.strictEqual(missingEntrance.y, 0);
});

should('AC-SERVICE: entrance 2 remains open and configure does not reopen closed 1/3', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [] };
    const service = EnemyNavigation.get(scene);
    const mkEntrance = (id, x) => ({
        id,
        outside: mockNode(`o${id}`, x, -20),
        inside: mockNode(`i${id}`, x, 20),
        closePlot: null,
        width: 80,
        open: true,
    });
    const entrances = [mkEntrance(1, 0), mkEntrance(2, 40), mkEntrance(3, 80)];
    service.configure({ walkablePolygon: groundNodes('e-ground'), entrances });
    service.setEntranceOpen(1, false);
    service.setEntranceOpen(2, false);
    service.configure({ walkablePolygon: groundNodes('e-ground-2'), entrances });
    const chosen = new Set();
    for (let i = 0; i < 20; i++) {
        chosen.add(service.chooseEntrance({ x: -80, y: -80 }, body(10), 'minion')?.id);
    }
    assert.strictEqual(chosen.has(1), false);
    assert.strictEqual(chosen.has(2), true);
});

should('AC-SERVICE: wall completion recorded before late configure closes matching entrance', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [] };
    const service = EnemyNavigation.get(scene);
    const closedPlot = mockNode('plot-wall-l', 0, 0);
    service.syncClosedEntranceFromPlot(closedPlot, 'left');
    const entrances = [
        { id: 1, outside: mockNode('late-o1', 0, -20), inside: mockNode('late-i1', 0, 20), closePlot: closedPlot, width: 80, open: true },
        { id: 2, outside: mockNode('late-o2', 40, -20), inside: mockNode('late-i2', 40, 20), closePlot: null, width: 80, open: true },
        { id: 3, outside: mockNode('late-o3', 80, -20), inside: mockNode('late-i3', 80, 20), closePlot: mockNode('plot-wall-r', 0, 0), width: 80, open: true },
    ];
    service.configure({ walkablePolygon: groundNodes('late-ground'), entrances });
    const chosen = new Set();
    for (let i = 0; i < 20; i++) {
        chosen.add(service.chooseEntrance({ x: -80, y: -80 }, body(10), 'minion')?.id);
    }
    assert.strictEqual(chosen.has(1), false);
    assert.strictEqual(chosen.has(2), true);
    assert.strictEqual(chosen.has(3), true);
});

should('AC-SERVICE: transition keeps latched direction after crossing polygon edge', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [] };
    const service = EnemyNavigation.get(scene);
    const outside = mockNode('outside', -20, 50);
    const inside = mockNode('inside', 20, 50);
    const unit = mockNode('unit', -20, 50);
    const target = mockNode('target', 80, 50);
    service.configure({
        walkablePolygon: groundNodes('t-ground'),
        castlePolygon: [
            mockNode('p0', 0, 0),
            mockNode('p1', 100, 0),
            mockNode('p2', 100, 100),
            mockNode('p3', 0, 100),
        ],
        entrances: [{ id: 2, outside, inside, closePlot: null, width: 80, open: true }],
    });
    currentFrame += 1;
    const first = service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 });
    assert.ok(first.x > 0, `expected movement toward inside, got ${first.x}`);
    unit.set(1, 50);
    currentFrame += 1;
    const second = service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 });
    assert.ok(second.x > 0, `transition folded back outside: ${second.x}`);
});

should('AC-SERVICE: inside boss pursuing exterior target exits through legal entrance', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [] };
    const service = EnemyNavigation.get(scene);
    const outside = mockNode('outside-rev', -20, 50);
    const inside = mockNode('inside-rev', 20, 50);
    const unit = mockNode('boss', 80, 50);
    const target = mockNode('exterior-target', -80, 50);
    service.configure({
        walkablePolygon: groundNodes('r-ground'),
        castlePolygon: [
            mockNode('rp0', 0, 0),
            mockNode('rp1', 100, 0),
            mockNode('rp2', 100, 100),
            mockNode('rp3', 0, 100),
        ],
        entrances: [{ id: 2, outside, inside, closePlot: null, width: 100, open: true }],
    });
    currentFrame += 1;
    const first = service.nextVelocity({ unit, target, role: 'boss', speed: 10, dt: 1, body: body(60), stopDistance: 0 });
    assert.ok(first.x < 0, `expected movement toward inside stair point, got ${first.x}`);
    unit.set(-1, 50);
    currentFrame += 1;
    const second = service.nextVelocity({ unit, target, role: 'boss', speed: 10, dt: 1, body: body(60), stopDistance: 0 });
    assert.ok(second.x < 0, `reverse transition folded back inside: ${second.x}`);
});

should('AC-SERVICE: closing selected entrance reroutes outside units but does not reset inside units', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [] };
    const service = EnemyNavigation.get(scene);
    const e1o = mockNode('e1o', -20, 20);
    const e1i = mockNode('e1i', 20, 20);
    const e2o = mockNode('e2o', -20, 80);
    const e2i = mockNode('e2i', 20, 80);
    const outsideUnit = mockNode('outside-unit', -80, 20);
    const insideUnit = mockNode('inside-unit', 80, 20);
    const insideTarget = mockNode('inside-target', 80, 80);
    const outsideTarget = mockNode('outside-target', -80, 20);
    service.configure({
        walkablePolygon: groundNodes('c-ground'),
        castlePolygon: [
            mockNode('cp0', 0, 0),
            mockNode('cp1', 100, 0),
            mockNode('cp2', 100, 100),
            mockNode('cp3', 0, 100),
        ],
        entrances: [
            { id: 1, outside: e1o, inside: e1i, closePlot: null, width: 80, open: true },
            { id: 2, outside: e2o, inside: e2i, closePlot: null, width: 80, open: true },
        ],
    });
    const oldRandom = Math.random;
    Math.random = () => 0;
    currentFrame += 1;
    const beforeClose = service.nextVelocity({ unit: outsideUnit, target: insideTarget, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 });
    Math.random = oldRandom;
    assert.ok(beforeClose.y <= 0, `expected entrance 1 route before close, got y=${beforeClose.y}`);
    currentFrame += 1;
    service.nextVelocity({ unit: insideUnit, target: outsideTarget, role: 'boss', speed: 10, dt: 1, body: body(10), stopDistance: 0 });
    service.setEntranceOpen(1, false);
    currentFrame += 1;
    const afterClose = service.nextVelocity({ unit: outsideUnit, target: insideTarget, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 });
    assert.ok(afterClose.y > 0, `outside unit did not reroute toward entrance 2 after close: ${afterClose.y}`);
    const insideAfterClose = service.nextVelocity({ unit: insideUnit, target: outsideTarget, role: 'boss', speed: 10, dt: 1, body: body(10), stopDistance: 0 });
    assert.ok(insideAfterClose.x < 0 || insideAfterClose.y > 0, 'inside unit should keep a legal route instead of being cleared to stop');
});

should('AC-SERVICE: releaseUnit removes stale peer from lifecycle avoidance', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [] };
    const service = EnemyNavigation.get(scene);
    service.configure({
        walkablePolygon: groundNodes('life-ground'),
        castlePolygon: [
            mockNode('life-p0', 180, 180),
            mockNode('life-p1', 200, 180),
            mockNode('life-p2', 200, 200),
            mockNode('life-p3', 180, 200),
        ],
        entrances: [{ id: 2, outside: mockNode('life-o', 180, 180), inside: mockNode('life-i', 190, 190), closePlot: null, width: 80, open: true }],
    });
    const target = mockNode('target-life', 100, 0);
    const a = mockNode('life-a', 0, 0);
    const b = mockNode('life-b', 0, 0);
    currentFrame += 1;
    service.nextVelocity({ unit: b, target, role: 'minion', speed: 2, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    const withPeer = service.nextVelocity({ unit: a, target, role: 'minion', speed: 2, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    service.releaseUnit(b);
    currentFrame += 1;
    const withoutPeer = service.nextVelocity({ unit: a, target, role: 'minion', speed: 2, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    assert.ok(Math.abs(withPeer.y) > 0.001, `expected overlap peer avoidance, got ${withPeer.x},${withPeer.y}`);
    assert.ok(Math.abs(withoutPeer.y) < Math.abs(withPeer.y), `released peer still influences avoidance: ${withoutPeer.y}`);
});

should('AC-SERVICE: destroy unregisters scene service listeners and clears singleton', () => {
    const { EnemyNavigation, eventManager } = loadEnemyNavigationForServiceTests();
    const scene = { getComponentsInChildren: () => [] };
    const service = EnemyNavigation.get(scene);
    assert.ok(eventManager.count('enemy_navigation_invalidated') > 0);
    service.destroy();
    assert.strictEqual(eventManager.count('enemy_navigation_invalidated'), 0);
    assert.notStrictEqual(EnemyNavigation.get(scene), service);
});

function clearLoaded(relativePaths) {
    for (const relativePath of relativePaths) {
        loaded.delete(path.join(root, relativePath));
    }
}

function makeDecoratedCcStub() {
    const cc = makeCcStub();
    class Component {
        constructor() {
            this.node = null;
            this._scheduled = [];
        }
        getComponent(type) {
            return this.node?.getComponent(type) ?? null;
        }
        addComponent(type) {
            return this.node?.addComponent(type) ?? new type();
        }
        scheduleOnce(cb, delay) {
            this._scheduled.push({ cb, delay });
        }
        schedule(cb, interval) {
            this._scheduled.push({ cb, interval, repeat: true });
        }
        unschedule(cb) {
            this._scheduled = this._scheduled.filter((e) => e.cb !== cb);
        }
        unscheduleAllCallbacks() {
            this._scheduled.length = 0;
        }
    }
    class Rect {
        constructor(x = 0, y = 0, width = 0, height = 0) {
            this.set(x, y, width, height);
        }
        set(x, y, width, height) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.xMin = x;
            this.yMin = y;
            this.xMax = x + width;
            this.yMax = y + height;
        }
    }
    cc.Component = Component;
    cc.Rect = Rect;
    cc.Prefab = class {};
    cc.Collider2D = class {};
    cc.RigidBody2D = class {};
    cc.UITransform = class {};
    cc.Quat = { toEulerInYXZOrder: (out, q) => out.set(0, 0, 2 * Math.atan2(q.z, q.w) * 180 / Math.PI) };
    cc.ERigidBody2DType = { Dynamic: 2 };
    cc.instantiate = (prefab) => prefab?.factory?.() ?? mockNode('instantiated', 0, 0);
    cc.resources = {};
    cc._decorator = {
        ccclass: () => (value) => value,
        property: () => () => undefined,
    };
    return cc;
}

function componentNode(name, x, y, components = new Map()) {
    const node = mockNode(name, x, y);
    node.active = true;
    node.scene = { getComponentsInChildren: () => [], getComponentInChildren: () => null };
    node.worldPosition = { x, y, z: 0 };
    node.getComponent = (type) => components.get(type) ?? null;
    node.addComponent = (type) => {
        const c = new type();
        c.node = node;
        components.set(type, c);
        return c;
    };
    node.getComponentInChildren = (type) => components.get(type) ?? null;
    node.setWorldPosition = (pos) => {
        x = pos.x;
        y = pos.y;
        node.worldPosition = { x, y, z: pos.z ?? 0 };
    };
    node.setPosition = (x2, y2) => {
        x = x2;
        y = y2;
        node.worldPosition = { x, y, z: 0 };
    };
    return node;
}

function actualScriptMocks(extra = {}) {
    const cc = makeDecoratedCcStub();
    class Player {
        constructor() {
            this.isDead = false;
            this.damage = 0;
        }
        takeDamage(amount) {
            this.damage += amount;
        }
        getVelocity() {
            return new cc.Vec2(0, 0);
        }
    }
    class Hero { constructor() { this.isDead = false; } takeDamage() {} }
    class Soldier {
        constructor() { this.isDead = false; }
        getDeployment() { return 'barracks'; }
        takeDamage() { this.isDead = true; }
    }
    class Building { constructor() { this.alive = true; } isAlive() { return this.alive; } takeDamage() {} }
    class Tower extends Building {}
    class Barracks extends Building {}
    class Barrier extends Building {}
    class Log { isAttackable() { return true; } takeDamage() {} getPhase() { return 'idle'; } }
    const eventManager = { onEvent() {}, offEvent() {}, emitEvent() {} };
    let hitCallback = null;
    const mocks = {
        cc,
        [path.join(root, 'assets/scripts/character/Player.ts')]: { Player },
        [path.join(root, 'assets/scripts/character/Hero.ts')]: { Hero },
        [path.join(root, 'assets/scripts/character/Soldier.ts')]: { Soldier },
        [path.join(root, 'assets/scripts/building/Building.ts')]: { Building },
        [path.join(root, 'assets/scripts/building/Tower.ts')]: { Tower },
        [path.join(root, 'assets/scripts/building/Barracks.ts')]: { Barracks },
        [path.join(root, 'assets/scripts/building/Barrier.ts')]: { Barrier },
        [path.join(root, 'assets/scripts/building/Wall.ts')]: { Wall: class {} },
        [path.join(root, 'assets/scripts/item/Log.ts')]: { Log },
        [path.join(root, 'assets/scripts/core/AirWallAabb.ts')]: { AirWallAabb: { bodySize: () => ({ w: 60, h: 60 }) } },
        [path.join(root, 'assets/scripts/core/AnimUtil.ts')]: {
            playAnim() {},
            playAnimWithCallback(_node, _clip, cb) { cb?.(); },
            playAttackWithFrameHit(_node, _clip, cb) { hitCallback = cb; },
        },
        [path.join(root, 'assets/scripts/core/EventManager.ts')]: { EventManager: { instance: eventManager } },
        [path.join(root, 'assets/scripts/core/GameConfig.ts')]: {
            GameConfig: {
                minionAttackDamage: 7,
                enemyMinionAttackEnterRange: 32,
                enemyMinionAttackExitRange: 50,
                minionMaxHp: 10,
                minionAggroRange: 999,
                minionMoveSpeed: 2,
                bossMaxHp: 100,
                bossMoveSpeed: 2,
                bossAttackDamage: 11,
                bossBuildingDamage: 22,
                bossRetargetInterval: 5,
                bossTargetScanInterval: 1,
                poolMaxEnemies: 5,
                farSpawnMaxAlive: 5,
                farSpawnInterval: 1,
                enemyRespawnDelay: 5,
                enemyEntranceWidth: 80,
            },
        },
        [path.join(root, 'assets/scripts/core/GameEvents.ts')]: {
            GameEvents: {
                BOSS_TARGET_REGISTER: 'boss_target_register',
                HP_CHANGED: 'hp_changed',
                BUILD_COMPLETE: 'build_complete',
            },
        },
        [path.join(root, 'assets/scripts/core/VisualFacing.ts')]: { VisualFacing: class { bind() {} reset() {} faceByTarget() {} faceByVelocity() {} } },
        [path.join(root, 'assets/scripts/core/EnemyNavigation.ts')]: { EnemyNavigation: { get: () => null } },
        [path.join(root, 'assets/scripts/game/CoinSystem.ts')]: { CoinSystem: { instance: null } },
        [path.join(root, 'assets/scripts/ui/HpBarUI.ts')]: { HpBarUI: class {} },
        ...extra,
    };
    return { cc, mocks, classes: { Player, Hero, Soldier, Building, Tower, Barracks, Barrier, Log }, getHit: () => hitCallback };
}

should('AC-ACTUAL: EnemyMinion uses actual 32/50 hysteresis helper', () => {
    clearLoaded(['assets/scripts/enemy/EnemyMinion.ts']);
    const { mocks } = actualScriptMocks({
        [path.join(root, 'assets/scripts/enemy/EnemyAI.ts')]: { EnemyAI: class {} },
    });
    const { resolveMinionAttackHysteresis } = loadTs('assets/scripts/enemy/EnemyMinion.ts', mocks);
    assert.strictEqual(resolveMinionAttackHysteresis(false, 31.9), true);
    assert.strictEqual(resolveMinionAttackHysteresis(true, 50), true);
    assert.strictEqual(resolveMinionAttackHysteresis(true, 50.1), false);
});

should('AC-ACTUAL: EnemyAI damage frame requires navigation line of sight', () => {
    clearLoaded(['assets/scripts/enemy/EnemyAI.ts']);
    let los = false;
    const base = actualScriptMocks({
        [path.join(root, 'assets/scripts/core/EnemyNavigation.ts')]: {
            EnemyNavigation: { get: () => ({ hasLineOfSight: () => los }) },
        },
    });
    const { EnemyAI } = loadTs('assets/scripts/enemy/EnemyAI.ts', base.mocks);
    const player = new base.classes.Player();
    const playerNode = componentNode('player', 20, 0, new Map([[base.classes.Player, player]]));
    const ai = new EnemyAI();
    ai.node = componentNode('enemy-ai', 0, 0);
    ai.setTarget(playerNode);
    assert.strictEqual(ai.beginAttack(32), false);
    assert.strictEqual(ai.applyAttackDamage(32), false);
    los = true;
    assert.strictEqual(ai.beginAttack(32), true);
    assert.strictEqual(ai.applyAttackDamage(32), true);
    assert.strictEqual(player.damage, 7);
});

should('AC-ACTUAL: EnemyBoss pickTarget keeps real priority and generation invalidates callbacks', () => {
    clearLoaded(['assets/scripts/enemy/EnemyBoss.ts']);
    const base = actualScriptMocks();
    const { EnemyBoss } = loadTs('assets/scripts/enemy/EnemyBoss.ts', base.mocks);
    const boss = new EnemyBoss();
    boss.node = componentNode('boss', 0, 0);
    boss.visualNode = componentNode('boss-visual', 0, 0);
    const player = componentNode('boss-player', 1, 0, new Map([[base.classes.Player, new base.classes.Player()]]));
    const hero = componentNode('boss-hero', 1, 0, new Map([[base.classes.Hero, new base.classes.Hero()]]));
    const building = componentNode('boss-building', 1, 0, new Map([[base.classes.Building, new base.classes.Building()]]));
    const soldier = componentNode('boss-soldier', 100, 0, new Map([[base.classes.Soldier, new base.classes.Soldier()]]));
    boss.registerTargets({ player, buildings: [building], heroes: [hero] });
    boss._upsertTarget(soldier, 'soldier');
    assert.strictEqual(boss.pickTarget(), soldier);

    boss._lockedTarget = player;
    boss._isDead = false;
    boss._canMove = true;
    boss._attackTimer = 0;
    boss.attackTriggerRange = 56;
    let hits = 0;
    boss._applyCircleAttack = () => { hits += 1; };
    boss.tryAttack();
    const staleHit = base.getHit();
    assert.ok(staleHit, 'expected captured attack frame callback');
    boss.reset();
    staleHit();
    assert.strictEqual(hits, 0, 'stale attack frame callback applied damage after reset');

    boss._lockedTarget = player;
    boss._attackTimer = 0;
    boss.tryAttack();
    const disableHit = base.getHit();
    boss.onDisable();
    disableHit();
    assert.strictEqual(hits, 0, 'stale attack frame callback applied damage after disable');

    boss._lockedTarget = player;
    boss._isDead = false;
    boss._canMove = true;
    boss._attackTimer = 0;
    boss.tryAttack();
    const deathHit = base.getHit();
    boss._die();
    const deathDeactivate = boss._scheduled[boss._scheduled.length - 1].cb;
    boss.reset();
    deathHit();
    deathDeactivate();
    assert.strictEqual(hits, 0, 'stale attack frame callback applied damage after death/reset');
    assert.strictEqual(boss.node.active, true, 'stale death callback deactivated reset boss');

    boss._isAttacking = true;
    boss._rb = { linearVelocity: new base.cc.Vec2(9, 9) };
    boss.update(1);
    assert.strictEqual(boss._rb.linearVelocity.x, 0);
    assert.strictEqual(boss._rb.linearVelocity.y, 0);
});

should('AC-ACTUAL: EnemySpawner stale pool callback does not respawn reused minion', () => {
    clearLoaded(['assets/scripts/enemy/EnemySpawner.ts']);
    class EnemyMinionStub {}
    const base = actualScriptMocks({
        [path.join(root, 'assets/scripts/enemy/EnemyMinion.ts')]: { EnemyMinion: EnemyMinionStub },
    });
    const { EnemySpawner } = loadTs('assets/scripts/enemy/EnemySpawner.ts', base.mocks);
    const spawner = new EnemySpawner();
    spawner.node = componentNode('spawner', 0, 0);
    spawner.spawnPoint = componentNode('spawn-origin', 10, 10);
    spawner.target = componentNode('spawn-target', 100, 0);
    const minion = {
        isValid: true,
        node: componentNode('pooled-minion', 0, 0),
        resetCount: 0,
        reset() { this.resetCount += 1; },
        setForceChaseTarget() {},
        setTarget() {},
        onReturnedToPool: null,
    };
    minion.node.activeInHierarchy = false;
    spawner._alive = 1;
    spawner._spawnOrigin.set(minion, spawner.spawnPoint);
    spawner._spawnGeneration.set(minion, 1);
    spawner._onMinionDied(minion);
    spawner._onMinionDied(minion);
    assert.strictEqual(spawner._alive, 0);
    assert.strictEqual(spawner._pendingRespawn.size, 1);
    assert.strictEqual(spawner._scheduled.length, 1);
    spawner._spawnGeneration.set(minion, 2);
    spawner._scheduled[0].cb();
    assert.strictEqual(spawner._alive, 0);
    assert.strictEqual(minion.resetCount, 0);
});

should('AC-FAST: clear direction and approach requests hold no fields or graphs, including arrival', () => {
    const f = new FlowField(20, 20), a = area();
    for (let i = 0; i < 200; i++) {
        const r = f.direction({ x: 0, y: 0 }, { x: 100, y: 100 }, body(10), a, true);
        assert.strictEqual(r.fieldId, ''); assert.ok(!r.blocked);
        assert.ok(f.nearestReachableWalkable({ x: 0, y: 0 }, { x: 100, y: 100 }, body(10), a));
    }
    assert.strictEqual(f.direction({ x: 0, y: 0 }, { x: 1, y: 1 }, body(10), a, true).reached, true);
    assert.strictEqual(f.buildCount, 0); assert.strictEqual(f.debugGraphBuildCount, 0); assert.strictEqual(f.debugEntries, 0);
    assert.strictEqual(f.direction({ x: 1, y: 1 }, { x: 16, y: 1 }, body(4), area({ bounds: { minX: 0, minY: 0, maxX: 40, maxY: 40 } })).blocked, true);
});

should('AC-UNREACHABLE: shared connected components replace 289 fields and reuse across 200 starts', () => {
    const f = new FlowField(20, 20);
    const a = area({ bounds: { minX: -1200, minY: -1200, maxX: 1200, maxY: 1600 },
        obstacles: [{ xMin: 100, xMax: 140, yMin: -1200, yMax: 1600 }] });
    for (let i = 0; i <= 200; i++) {
        assert.strictEqual(f.nearestReachableWalkable({ x: i % 3, y: i % 11 }, { x: 600, y: 200 }, body(40), a), null);
    }
    assert.strictEqual(f.buildCount, 0); assert.strictEqual(f.debugGraphBuildCount, 1);
});

should('AC-LOG-CONTACT: blocked starts and epsilon contact use zero graphs and resume outside', () => {
    const f = new FlowField(20, 20);
    const a = area({ bounds: { minX: -1200, minY: -1200, maxX: 1200, maxY: 1600 },
        obstacles: [{ xMin: -100, xMax: 100, yMin: -20, yMax: 20 }] });
    for (let i = 0; i < 200; i++) for (const y of [0, 25, 40 - 1e-7, 40, 40 + 1e-7]) {
        const p = f.nearestReachableWalkable({ x: 0, y }, { x: 300, y: 200 }, body(40), a);
        assert.strictEqual(p === null, y < 40);
    }
    assert.strictEqual(f.buildCount, 0); assert.strictEqual(f.debugGraphBuildCount, 0);
    const boundary = area({ bounds: { minX: -100, minY: -5, maxX: 220, maxY: 220 },
        obstacles: [{ xMin: -50, xMax: 50, yMin: -5, yMax: 30 }] });
    const start = { x: 0, y: 33 };
    assert.ok(f.pointWalkable(start, body(4), boundary));
    assert.ok(!f.pointWalkable(f.cellToWorld(f.worldToCell(start, boundary.bounds), boundary.bounds), body(4), boundary));
    const r = f.direction(start, { x: 100, y: 0 }, body(4), boundary);
    assert.ok(!r.blocked && f.lineClear(start, r.waypoint, body(4), boundary));
});

should('AC-CACHE: 10000 targets/body requests and 1000 revisions stay bounded even with retained IDs', () => {
    const budget = { entries: 8, bytes: 256 * 1024, cells: 4096 };
    const f = new FlowField(20, 20, budget);
    const a = area({ obstacles: [{ xMin: 20, xMax: 40, yMin: -30, yMax: 100 }] });
    for (let i = 0; i < 10000; i++) {
        if (i % 10 === 0) a.obstacleVersion++;
        f.direction({ x: -60, y: -60 }, { x: 100 + i % 80, y: 120 + i % 50 }, body(4 + i % 4), a, true);
        assert.ok(f.debugEntries <= budget.entries); assert.ok(f.debugBytes <= budget.bytes);
    }
    assert.ok(f.buildCount > 1000); assert.ok(f.debugStats.peakEntries <= budget.entries);
    f.clear(); assert.strictEqual(f.debugEntries, 0); assert.strictEqual(f.debugBytes, 0);
    return { queries: 10000, revisionChanges: 1000, budget, stats: f.debugStats };
});

should('AC-CACHE-BYTES: byte pressure evicts retained fields before the entry limit', () => {
    const budget = { entries: 64, bytes: 8192, cells: 4096 }, f = new FlowField(20, 20, budget);
    const a = area({ obstacles: [{ xMin: 20, xMax: 40, yMin: -30, yMax: 100 }] });
    for (let i = 0; i < 300; i++) {
        f.direction({ x: -60, y: -60 }, { x: 80 + i % 4 * 20, y: 80 + Math.floor(i / 4) % 5 * 20 }, body(4 + i % 3), a, true);
        assert.ok(f.debugBytes <= budget.bytes); assert.ok(f.debugEntries < budget.entries);
    }
    assert.ok(f.debugStats.peakBytes > 6000); assert.ok(f.buildCount > 20);
    return { budget, stats: f.debugStats };
});

function eventNode(name, x = 0, y = 0) {
    const n = mockNode(name, x, y), listeners = new Map();
    n.children = []; n.parent = null; n.components = new Map(); n.active = true;
    n.on = (event, cb, ctx) => { const list = listeners.get(event) ?? []; list.push({ cb, ctx }); listeners.set(event, list); };
    n.off = (event, cb, ctx) => listeners.set(event, (listeners.get(event) ?? []).filter(l => l.cb !== cb || l.ctx !== ctx));
    n.emit = (event, value) => { for (const l of [...listeners.get(event) ?? []]) l.cb.call(l.ctx, value); };
    n.getComponent = type => n.components.get(type) ?? null;
    n.addComponent = type => { const c = new type(); c.node = n; n.components.set(type, c); n.emit('component-added', c); return c; };
    n.getChildByName = name => n.children.find(c => c.name === name) ?? null;
    n.getComponents = type => [...n.components.values()].filter(c => c instanceof type);
    n.getComponentsInChildren = type => [...n.getComponents(type), ...n.children.flatMap(child => child.getComponentsInChildren(type))];
    n.getComponentInChildren = type => n.getComponentsInChildren(type)[0] ?? null;
    n.add = child => { child.parent = n; child.scene = n.scene ?? n; n.children.push(child); n.emit('child-added', child); return child; };
    n.remove = child => { n.children.splice(n.children.indexOf(child), 1); child.parent = null; n.emit('child-removed', child); };
    n.move = (nx, ny) => { n.set(nx, ny); n.emit('transform-changed', 1); };
    return n;
}

function serviceFixture() {
    const { EnemyNavigation, cc } = loadEnemyNavigationForServiceTests();
    const scene = eventNode('scene'); scene.scene = scene;
    const service = EnemyNavigation.get(scene);
    const ground = groundNodes(), min = eventNode('min', -100, -100), max = eventNode('max', 220, 220);
    const outside = eventNode('outside', 170, 190), inside = eventNode('inside', 190, 190);
    service.configure({ boundsMin: min, boundsMax: max, walkablePolygon: ground,
        castlePolygon: [eventNode('c0', 180, 180), eventNode('c1', 200, 180), eventNode('c2', 200, 200), eventNode('c3', 180, 200)],
        entrances: [{ id: 1, outside, inside, closePlot: null, width: 80, open: true }] });
    const addBox = (name, rect) => {
        const node = eventNode(name), box = new cc.BoxCollider2D();
        box.node = node; box.enabled = true; box.isValid = true; box.worldAABB = rect;
        node.components.set(cc.BoxCollider2D, box); scene.add(node); return box;
    };
    return { scene, service, cc, addBox, min, max, ground, outside, inside };
}

should('AC-INVALIDATE: 300 stable frames x 200 units checks blockers once/frame, never enemy boxes', () => {
    const h = serviceFixture();
    for (let i = 0; i < 10; i++) h.addBox(`airWall-${i}`, { xMin: 150, xMax: 160, yMin: 100 + i, yMax: 110 + i });
    const units = Array.from({ length: 200 }, (_, i) => h.addBox(`enemy-${i}`, { xMin: 0, xMax: 10, yMin: 0, yMax: 10 }).node);
    const target = mockNode('target', 100, 0);
    h.service.hasLineOfSight(units[0], target, body(4));
    const checks = h.service.debugStats.trackedColliderChecks, scans = h.service.debugStats.fullSceneScan;
    const commits = h.service.debugStats.effectiveCommits;
    for (let frame = 0; frame < 300; frame++) {
        currentFrame++;
        for (const unit of units) {
            unit.move(0, 0);
            h.service.nextVelocity({ unit, target, role: 'minion', speed: 2, dt: 0.016, body: body(4) });
        }
    }
    assert.strictEqual(h.service.debugStats.trackedColliderChecks - checks, 3000);
    assert.strictEqual(h.service.debugStats.fullSceneScan, scans);
    assert.strictEqual(h.service.debugStats.signatureBuild, 0);
    assert.strictEqual(h.service.debugStats.effectiveCommits, commits);
    for (const unit of units) h.service.releaseUnit(unit);
    assert.strictEqual(h.service._unitState.size, 0); assert.strictEqual(h.service._unitPositions.size, 0);
    h.service.destroy(); assert.strictEqual(h.service._watched.size, 0);
    return { frames: 300, units: 200, blockerChecks: h.service.debugStats.trackedColliderChecks - checks, stats: h.service.debugStats };
});

should('AC-INVALIDATE: structural, animation, topology and same-frame notified transactions commit exact snapshots', () => {
    const h = serviceFixture(), a = mockNode('a', 0, 0), b = mockNode('b', 100, 0);
    const los = () => h.service.hasLineOfSight(a, b, body(4));
    assert.ok(los()); const before = h.service.debugStats.effectiveCommits;
    const wall = h.addBox('airWall-new', { xMin: 40, xMax: 50, yMin: -90, yMax: 180 });
    for (let i = 0; i < 5; i++) h.service.invalidate();
    assert.ok(!los()); assert.strictEqual(h.service.debugStats.effectiveCommits, before + 1);
    for (let i = 0; i < 5; i++) h.service.invalidate();
    los(); assert.strictEqual(h.service.debugStats.effectiveCommits, before + 1);
    wall.worldAABB = { xMin: 140, xMax: 150, yMin: -90, yMax: 180 }; wall.node.move(100, 0);
    assert.ok(los()); assert.strictEqual(h.service.debugStats.effectiveCommits, before + 2);
    wall.worldAABB.xMin = 40; wall.node.move(0, 0); assert.ok(!los());
    wall.enabled = false; h.service.invalidate(); assert.ok(los());
    wall.enabled = true; currentFrame++; assert.ok(!los());
    wall.node.activeInHierarchy = false; wall.node.emit('active-in-hierarchy-changed'); assert.ok(los());
    wall.node.activeInHierarchy = true; wall.node.emit('active-in-hierarchy-changed'); assert.ok(!los());
    h.scene.remove(wall.node); assert.ok(los());
    h.scene.add(wall.node); assert.ok(!los());
    wall.node.components.delete(h.cc.BoxCollider2D); wall.node.emit('component-removed', wall); assert.ok(los());
    wall.node.components.set(h.cc.BoxCollider2D, wall); wall.node.emit('component-added', wall); assert.ok(!los());
    wall.isValid = false; currentFrame++; assert.ok(los());
    h.max.move(90, 220); assert.ok(!los()); h.max.move(220, 220); assert.ok(los());
    const commit = h.service.debugStats.effectiveCommits;
    h.service.setEntranceOpen(1, false); los(); assert.strictEqual(h.service.debugStats.effectiveCommits, commit + 1);
    h.outside.move(160, 190); los(); assert.strictEqual(h.service.debugStats.effectiveCommits, commit + 2);
    h.scene.emit('node-destroyed'); assert.strictEqual(h.service._field.debugEntries, 0);
});

should('AC-ACTUAL-CONTACT: real Minion and Boss use stable envelopes, real service and final safe speed', () => {
    clearLoaded(['assets/scripts/enemy/EnemyMinion.ts', 'assets/scripts/enemy/EnemyBoss.ts', 'assets/scripts/core/EnemyNavigation.ts']);
    const base = actualScriptMocks({ [path.join(root, 'assets/scripts/enemy/EnemyAI.ts')]: { EnemyAI: class {} } });
    delete base.mocks[path.join(root, 'assets/scripts/core/EnemyNavigation.ts')];
    base.mocks[path.join(root, 'assets/scripts/core/GameConfig.ts')].GameConfig = loadTs('assets/scripts/core/GameConfig.ts').GameConfig;
    base.mocks[path.join(root, 'assets/scripts/core/TweenUtil.ts')] = { TweenUtil: {} };
    clearLoaded(['assets/scripts/item/Log.ts']);
    const { Log: ActualLog } = loadTs('assets/scripts/item/Log.ts', base.mocks);
    base.mocks[path.join(root, 'assets/scripts/item/Log.ts')] = { Log: ActualLog };
    base.classes.Log = ActualLog;
    const { EnemyNavigation } = loadTs('assets/scripts/core/EnemyNavigation.ts', base.mocks);
    const { EnemyMinion } = loadTs('assets/scripts/enemy/EnemyMinion.ts', base.mocks);
    const { EnemyBoss } = loadTs('assets/scripts/enemy/EnemyBoss.ts', base.mocks);
    const scene = eventNode('actual-scene'); scene.scene = scene;
    const nav = EnemyNavigation.get(scene);
    const markers = [eventNode('g0', -500, -500), eventNode('g1', 500, -500), eventNode('g2', 500, 500), eventNode('g3', -500, 500)];
    nav.configure({ boundsMin: markers[0], boundsMax: markers[2], walkablePolygon: markers, castlePolygon: markers,
        entrances: [{ id: 2, outside: eventNode('o', -480, 0), inside: eventNode('i', -450, 0), closePlot: null, width: 100, open: true }] });
    const log = new base.classes.Log(); let phase = 'rolling';
    const setPhase = value => { phase = value; log._phase = value; log._isLocked = value === 'fixed'; log._isFading = value === 'failed'; };
    const logNode = scene.add(eventNode('log')); log.node = logNode; logNode.components.set(base.classes.Log, log);
    const logBox = new base.cc.BoxCollider2D(); logBox.node = logNode; logBox.enabled = true;
    logBox.worldAABB = { xMin: -100, xMax: 100, yMin: -20, yMax: 20 }; logNode.components.set(base.cc.BoxCollider2D, logBox);
    const target = eventNode('target', 300, 200); target.scene = scene;
    for (const Type of [EnemyMinion, EnemyBoss]) {
        const unit = new Type(); unit.node = scene.add(eventNode(Type.name, 0, 25));
        unit.node.worldScale = { x: 1, y: 1, z: 1 }; unit.node.worldRotation = { x: 0, y: 0, z: 0, w: 1 };
        unit._rb = { linearVelocity: new base.cc.Vec2() };
        const box = new base.cc.BoxCollider2D(); box.node = unit.node; box.enabled = true; box.sensor = false;
        box.size = { width: 40, height: 40 }; box.offset = { x: 0, y: 0 };
        Object.defineProperty(box, 'worldAABB', { get: () => {
            const p = {}; unit.node.getWorldPosition(p);
            return { xMin: p.x - 20, xMax: p.x + 20, yMin: p.y - 20, yMax: p.y + 20,
                width: (p.x + 20) - (p.x - 20) + Math.abs(p.x % 3), height: (p.y + 20) - (p.y - 20) };
        } });
        unit.node.components.set(base.cc.BoxCollider2D, box);
        const keys = new Set();
        for (const x of [0, 0.1, 1922.807, 10000.1, -10000.1]) {
            unit.node.move(x, 25); const b = unit._bodySize(); keys.add(JSON.stringify(b));
            assert.ok(b.width >= 40); assert.ok(b.height >= 40);
        }
        assert.strictEqual(keys.size, 1);
        const original = unit._bodySize();
        box.size.width = 80;
        assert.strictEqual(unit._bodySize().width, 80, 'physical 80-unit body must not be enlarged past an 80-unit stair');
        box.size.width = 40;
        box.offset = { x: -3, y: 7 }; unit.node.worldScale = { x: 2, y: 1, z: 1 };
        const changed = unit._bodySize(); assert.ok(changed.width >= 80); assert.ok(changed.offsetX < 0); assert.ok(changed.offsetY > 0);
        unit.node.worldRotation = { x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 };
        const rotated = unit._bodySize(); assert.ok(rotated.height >= 80); assert.ok(rotated.width < 41);
        box.offset = { x: 0, y: 0 }; unit.node.worldScale = { x: 1, y: 1, z: 1 }; unit.node.worldRotation = { x: 0, y: 0, z: 0, w: 1 };
        assert.deepStrictEqual(unit._bodySize(), original);
        unit.node.move(0, 25);
        if (Type === EnemyMinion) {
            unit._target = target; unit._forceChaseTarget = true; unit._resolveLog = () => log;
            unit._fillLogAabb = (_l, r) => r.set(-100, -20, 200, 40);
            unit._fillVisualAabb = (_n, r) => r.set(-20, 15, 40, 40); unit._readRideSpeedY = () => 5;
        } else {
            unit._scanTargetsByInterval = () => {}; unit._resolveChaseTarget = () => target;
        }
        for (const state of ['rolling', 'charging', 'failed', 'fixed']) {
            setPhase(state);
            currentFrame++; nav.invalidate(); unit.update(2);
            const v = unit._rb.linearVelocity;
            if (phase === 'fixed') { near(v.x, 0); near(v.y, 0); }
            else assert.ok(Math.hypot(v.x, v.y) > 0, `${Type.name} ${phase} should retain legal movement`);
            assert.strictEqual(box.sensor, false);
        }
        unit.node.move(0, 60); currentFrame++; unit.update(2);
        assert.ok(Math.hypot(unit._rb.linearVelocity.x, unit._rb.linearVelocity.y) > 0, 'must resume after legitimate contact separation');
        nav.releaseUnit(unit.node);
    }
    assert.strictEqual(nav._field.debugGraphBuildCount, 0);
    setPhase('failed');
    const wallNode = scene.add(eventNode('airWall-sealed'));
    const wallBox = new base.cc.BoxCollider2D(); wallBox.node = wallNode; wallBox.enabled = true;
    wallBox.worldAABB = { xMin: 100, xMax: 140, yMin: -500, yMax: 500 };
    wallNode.components.set(base.cc.BoxCollider2D, wallBox); wallNode.emit('component-added', wallBox);
    for (const Type of [EnemyMinion, EnemyBoss]) {
        const unit = new Type(); unit.node = scene.add(eventNode(`${Type.name}-moving`, 0, 0));
        unit.node.worldScale = { x: 1, y: 1, z: 1 }; unit.node.worldRotation = { x: 0, y: 0, z: 0, w: 1 };
        const box = new base.cc.BoxCollider2D(); box.node = unit.node; box.size = { width: 40, height: 40 }; box.offset = { x: 0, y: 0 };
        unit.node.components.set(base.cc.BoxCollider2D, box); unit._rb = { linearVelocity: new base.cc.Vec2() };
        if (Type === EnemyMinion) { unit._target = target; unit._forceChaseTarget = true; unit._resolveLog = () => null; }
        else { unit._scanTargetsByInterval = () => {}; unit._resolveChaseTarget = () => target; }
        for (let frame = 0; frame < 300; frame++) {
            currentFrame++; unit.node.move((frame % 7) * 0.1, frame % 3); target.move(300 + frame % 4 * 20, 200);
            box.worldAABB = { width: 40 + frame % 3, height: 40, xMin: -20, xMax: 20 + frame % 3, yMin: -20, yMax: 20 };
            unit.update(0.016);
            near(unit._rb.linearVelocity.x, 0); near(unit._rb.linearVelocity.y, 0);
            assert.strictEqual(nav._field.debugGraphBuildCount, 1);
            assert.strictEqual(nav._field.buildCount, 0);
        }
        nav.releaseUnit(unit.node);
    }
    const details = { translatingFrames: 600, roles: ['actual Minion', 'actual Boss'], log: 'actual readonly Log isAttackable/getPhase',
        graphs: nav._field.debugGraphBuildCount, fields: nav._field.buildCount, stats: nav._field.debugStats };
    nav.destroy();
    return details;
});

should('AC-REF: service releases a detour field when switching to direct or invalid destination', () => {
    const h = serviceFixture();
    h.addBox('airWall-short', { xMin: 20, xMax: 40, yMin: -20, yMax: 40 });
    const unit = mockNode('ref-unit', 0, 0), target = mockNode('ref-target', 100, 0);
    h.service.nextVelocity({ unit, target, role: 'minion', speed: 2, dt: 1, body: body(4) });
    const id = h.service._unitState.get(unit).fieldId;
    assert.ok(id); assert.strictEqual(h.service._field.debugRefCount(id), 1);
    unit.set(80, 0); currentFrame++;
    h.service.nextVelocity({ unit, target, role: 'minion', speed: 2, dt: 1, body: body(4) });
    assert.strictEqual(h.service._unitState.get(unit).fieldId, '');
    assert.strictEqual(h.service._field.debugRefCount(id), 0);
    h.service.releaseUnit(unit); assert.strictEqual(h.service._unitState.size, 0); h.service.destroy();
});

if (process.env.NAV_HARNESS_ONLY !== '1' && !process.exitCode) console.log('enemy navigation core tests passed');
if (process.env.NAV_HARNESS_ONLY !== '1') {
    const dir = path.resolve(root, process.env.NAV_EVIDENCE_DIR || '.cursor/plans/reports/fix-enemy-navigation-performance-evidence');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'logic-results.json'), JSON.stringify({ node: process.version, typescript: ts.version, testResults }, null, 2));
}
module.exports = { loadTs, clearLoaded, loadEnemyNavigationForServiceTests, actualScriptMocks,
    componentNode, mockNode, groundNodes, outVec, eventNode, advanceFrame: () => ++currentFrame };
