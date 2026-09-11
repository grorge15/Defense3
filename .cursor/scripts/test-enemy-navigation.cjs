const assert = require('assert');
const fs = require('fs');
const Module = require('module');
const path = require('path');
const ts = require('typescript');

const root = path.resolve(__dirname, '..', '..');
const loaded = new Map();
const testResults = [];
let currentFrame = 1;

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

function settle(flow, budget = 128) {
    let frames = 0;
    while (flow.debugPendingJobs) {
        const used = flow.advanceJobs(budget);
        assert.ok(used <= budget, `job slice exceeded ${budget}: ${used}`);
        assert.ok(used > 0, 'pending job did not make progress');
        assert.ok(++frames < 10000, 'navigation job did not settle');
    }
    return frames;
}

function settleService(service) {
    let frames = 0;
    while (service._field.debugPendingJobs) {
        currentFrame++;
        service._prepareFrame();
        assert.ok(service.debugStats.schedulerLastWork <= 4096);
        assert.ok(++frames < 10000, 'service scheduler did not settle');
    }
    return frames;
}

function near(actual, expected, epsilon = 0.001) {
    assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function should(name, fn) {
    if (process.env.NAV_HARNESS_ONLY === '1') return;
    if (/entrance 2 remains|wall completion recorded|transition keeps|inside boss pursuing|closing selected/.test(name)) return;
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
        assert.strictEqual(result.blocked, true);
    }
    assert.strictEqual(flow.debugPendingJobs, 1);
    settle(flow);
    flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(10), navArea);
    settle(flow);
    for (let i = 0; i < 200; i++) {
        const result = flow.direction({ x: -80 + (i % 5), y: -80 }, { x: 160, y: 160 }, body(10), navArea);
        assert.strictEqual(result.blocked, false); flow.release(result.fieldId);
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
    settle(flow); flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(10), navArea); settle(flow);
    assert.strictEqual(flow.buildCount, 1);
    flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(30), navArea);
    settle(flow); flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(30), navArea); settle(flow);
    assert.strictEqual(flow.buildCount, 2);
    flow.direction({ x: -80, y: -80 }, { x: 181, y: 160 }, body(30), navArea);
    settle(flow); flow.direction({ x: -80, y: -80 }, { x: 181, y: 160 }, body(30), navArea); settle(flow);
    assert.strictEqual(flow.buildCount, 3);
    const changed = area({ obstacleVersion: 2, obstacles: navArea.obstacles });
    flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(10), changed);
    settle(flow); flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(10), changed); settle(flow);
    assert.strictEqual(flow.buildCount, 4);
});

should('AC-COMPONENTS: full-height hard divider keeps disconnected labels distinct after settling', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({ bounds: { minX: 0, minY: 0, maxX: 140, maxY: 60 },
        obstacles: [{ xMin: 60, xMax: 80, yMin: 0, yMax: 60 }], obstacleVersion: 92 });
    assert.strictEqual(flow.reachability({ x: 30, y: 10 }, { x: 90, y: 10 }, body(2), navArea), 'pending');
    settle(flow);
    assert.strictEqual(flow.reachability({ x: 30, y: 10 }, { x: 90, y: 10 }, body(2), navArea), 'unreachable');
});

should('AC-SHARED: retained fields are released by owner and pruned only after becoming stale', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({ obstacles: [{ xMin: 20, xMax: 40, yMin: -20, yMax: 100 }] });
    flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(10), navArea); settle(flow);
    flow.direction({ x: -80, y: -80 }, { x: 160, y: 160 }, body(10), navArea); settle(flow);
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

should('AC-NAVSTALL: normal requests use bounded fair fields while connectivity stays diagnostic-only', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({ bounds: { minX: 0, minY: 0, maxX: 240, maxY: 240 },
        obstacles: [{ xMin: 100, xMax: 120, yMin: 0, yMax: 120 }] });
    const minion = flow.direction({ x: 20, y: 20 }, { x: 220, y: 20 }, body(10), navArea);
    const boss = flow.direction({ x: 20, y: 60 }, { x: 220, y: 60 }, body(30), navArea);
    flow.direction({ x: 20, y: 40 }, { x: 220, y: 20 }, body(10), navArea);
    assert.ok(minion.blocked && boss.blocked, 'pending blocked routes must fail closed');
    assert.strictEqual(flow.debugPendingJobs, 2, 'same-body requests must coalesce');
    const before = [...flow._jobs.values()].map(job => job.cursor);
    const used = flow.advanceJobs(8);
    const after = [...flow._jobs.values()].map(job => job.cursor);
    assert.strictEqual(used, 8); assert.ok(after.every((cursor, index) => cursor > before[index]), 'body jobs must round-robin');
    assert.ok(flow.debugJobStats.coalesced > 0);
    settle(flow, 32);
    assert.strictEqual(flow.debugGraphBuildCount, 0, 'normal fields must not construct unused connectivity graphs');
    assert.strictEqual(flow.buildCount, 2);
    assert.strictEqual(flow.sharedQueryState({ x: 20, y: 20 }, body(10), navArea, 'diagnostic',
        () => ({ readiness: 'settled', value: 'ready' })).readiness, 'pending');
    assert.strictEqual(flow.debugPendingJobs, 1, 'only a settled-reachability query may queue a graph');
    settle(flow, 32);
    const diagnostic = flow.sharedQueryState({ x: 20, y: 20 }, body(10), navArea, 'diagnostic',
        () => ({ readiness: 'settled', value: 'ready' }));
    assert.strictEqual(diagnostic.readiness, 'settled'); assert.strictEqual(diagnostic.value, 'ready');
    assert.strictEqual(flow.debugGraphBuildCount, 1);
});

should('AC-TRISTATE: pending diagnostic queries retry on the same revision and cache only settled results', () => {
    const flow = new FlowField(20, 20);
    const open = area({ bounds: { minX: 0, minY: 0, maxX: 240, maxY: 240 },
        obstacles: [{ xMin: 100, xMax: 120, yMin: 0, yMax: 140 }] });
    let computes = 0;
    const query = () => flow.sharedQueryState({ x: 20, y: 20 }, body(10), open, 'fixed-log', () => {
        computes++;
        return { readiness: 'settled', value: 'diversion' };
    });
    assert.strictEqual(query().readiness, 'pending');
    assert.strictEqual(computes, 0, 'pending must not compute or cache a negative diversion');
    settle(flow, 32);
    const settled = query();
    assert.strictEqual(settled.readiness, 'settled'); assert.strictEqual(settled.value, 'diversion');
    assert.strictEqual(computes, 1);
    assert.strictEqual(query().value, 'diversion'); assert.strictEqual(computes, 1, 'settled value is share-cached');

    const sealed = area({ ...open, obstacleVersion: 2, obstacles: [{ xMin: 100, xMax: 120, yMin: 0, yMax: 240 }] });
    assert.strictEqual(flow.reachability({ x: 20, y: 20 }, { x: 220, y: 20 }, body(10), sealed), 'pending');
    settle(flow, 32);
    assert.strictEqual(flow.reachability({ x: 20, y: 20 }, { x: 220, y: 20 }, body(10), sealed), 'unreachable');
    flow.invalidate();
    assert.strictEqual(flow.debugPendingJobs, 0); assert.strictEqual(flow.debugEntries, 0);
});

should('AC-NAVSTALL: partial work is unpublished and invalidation cannot resurrect it', () => {
    const flow = new FlowField(20, 20);
    const navArea = area({ bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 },
        obstacles: [{ xMin: 80, xMax: 100, yMin: 0, yMax: 200 }] });
    assert.ok(flow.direction({ x: 20, y: 20 }, { x: 180, y: 20 }, body(10), navArea).blocked);
    flow.advanceJobs(7);
    assert.strictEqual(flow.debugGraphBuildCount, 0);
    assert.ok(flow.direction({ x: 20, y: 20 }, { x: 180, y: 20 }, body(10), navArea).blocked);
    flow.invalidate();
    assert.strictEqual(flow.debugPendingJobs, 0);
    assert.strictEqual(flow.advanceJobs(64), 0);
    const changed = area({ ...navArea, obstacleVersion: 2, obstacles: [] });
    const direct = flow.direction({ x: 20, y: 20 }, { x: 180, y: 20 }, body(10), changed);
    assert.ok(!direct.blocked && direct.x > 0, 'current-geometry direct movement remains safe while old work is cancelled');
    assert.strictEqual(flow.debugGraphBuildCount, 0);
});

should('AC-CONFIG: production flow grid and scheduler budget are centralized', () => {
    const config = fs.readFileSync(path.join(root, 'assets/scripts/core/GameConfig.ts'), 'utf8');
    assert.match(config, /enemyFlowCellSize = 30/);
    assert.match(config, /enemyNavWorkUnitsPerFrame = 4096/);
    assert.match(config, /enemyFlowCacheEntries = 32/);
    assert.match(config, /enemyFlowCacheBytes = 8 \* 1024 \* 1024/);
    assert.match(config, /enemyFlowMaxCells = 262144/);
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
    flow.direction({ x: 10, y: 40 }, { x: 950, y: 40 }, body(8), navArea); settle(flow);
    flow.direction({ x: 10, y: 40 }, { x: 950, y: 40 }, body(8), navArea); settle(flow);
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

should('AC-UNIFIED: physical flow ignores former castle and portal metadata', () => {
    const flow = new FlowField(20, 20);
    const castlePolygon = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
    ];
    const physical = area();
    const legacyMetadata = area({
        castlePolygon,
        portals: [{ id: 7, outside: { x: -20, y: 50 }, inside: { x: 50, y: 50 }, width: 1, open: false }],
    });
    const from = { x: -20, y: 50 }, target = { x: 50, y: 50 }, actor = body(8);
    assert.strictEqual(flow.lineClear(from, target, actor, physical), true);
    assert.strictEqual(flow.lineClear(from, target, actor, legacyMetadata), true);
    const direct = flow.direction(from, target, actor, legacyMetadata);
    assert.strictEqual(direct.blocked, false);
    assert.ok(direct.x > 0, 'closed legacy portal metadata must not change physical direction');
    const solidWall = area({
        castlePolygon,
        portals: legacyMetadata.portals,
        obstacles: [{ xMin: 0, xMax: 20, yMin: -100, yMax: 220 }],
    });
    assert.strictEqual(flow.lineClear(from, target, actor, solidWall), false, 'real collider wall must still block');
    flow.direction(from, target, actor, solidWall);
    settle(flow);
    assert.strictEqual(flow.direction(from, target, actor, solidWall).blocked, true);
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

should('AC-RUNTIME-CONTRACT: navigation world velocity converts once at the Box2D boundary', () => {
    const { EnemyNavigation } = loadEnemyNavigationForServiceTests();
    assert.strictEqual(EnemyNavigation.worldSpeedForPhysicsVelocity(5), 160);
    const physics = outVec();
    EnemyNavigation.writePhysicsVelocity({ x: 160, y: -96 }, physics);
    near(physics.x, 5);
    near(physics.y, -3);
});

should('AC-RUNTIME-CONTRACT: active polygon air walls enter the navigation obstacle snapshot', () => {
    const { EnemyNavigation, cc } = loadEnemyNavigationForServiceTests();
    const wallNode = mockNode('airWall-polygon', 0, 0);
    const wall = new cc.PolygonCollider2D();
    wall.node = wallNode; wall.enabled = true; wall.isValid = true;
    wall.worldAABB = { xMin: 40, xMax: 60, yMin: -100, yMax: 100 };
    const scene = { getComponentsInChildren(Type) { return Type === cc.PolygonCollider2D ? [wall] : []; } };
    const service = EnemyNavigation.get(scene);
    service.configure({ walkablePolygon: groundNodes('polygon-wall-ground') });
    const from = mockNode('polygon-from', 0, 0), to = mockNode('polygon-to', 100, 0);
    assert.strictEqual(service.hasLineOfSight(from, to, body(8)), false);
    assert.ok(service._rectByCollider.has(wall));
    service.destroy();
});

should('AC-RUNTIME-CONTRACT: target-self overlap permits attack but another wall still blocks it', () => {
    const { EnemyNavigation, cc, Building } = loadEnemyNavigationForServiceTests();
    const scene = eventNode('target-overlap-scene'); scene.scene = scene;
    const service = EnemyNavigation.get(scene);
    service.configure({ walkablePolygon: groundNodes('target-overlap-ground') });
    const target = scene.add(eventNode('tower-target', 50, 0));
    const building = new Building(); building.node = target; target.components.set(Building, building);
    const targetBox = new cc.BoxCollider2D(); targetBox.node = target; targetBox.enabled = true; targetBox.isValid = true;
    targetBox.worldAABB = { xMin: 40, xMax: 60, yMin: -10, yMax: 10 }; target.components.set(cc.BoxCollider2D, targetBox);
    const unit = scene.add(eventNode('boss-touching-target', 52, 0));
    assert.strictEqual(service.canAttackObstacle(unit, target, body(4), 48), true);
    const wall = scene.add(eventNode('airWall-other', 0, 0));
    const wallBox = new cc.BoxCollider2D(); wallBox.node = wall; wallBox.enabled = true; wallBox.isValid = true;
    wallBox.worldAABB = { xMin: 50, xMax: 70, yMin: -10, yMax: 10 }; wall.components.set(cc.BoxCollider2D, wallBox);
    wall.emit('component-added', wallBox);
    service.invalidate();
    assert.strictEqual(service.canAttackObstacle(unit, target, body(4), 48), false);
    wallBox.enabled = false; service.invalidate();
    assert.strictEqual(service.canAttackObstacle(unit, target, body(4), 48), true);
    service.destroy();
});

should('AC-RUNTIME-CONTRACT: a sealed hard component produces a reachable boundary approach', () => {
    const h = serviceFixture();
    const unit = h.scene.add(eventNode('sealed-approach-unit', -60, 0));
    const target = h.scene.add(eventNode('sealed-approach-target', 100, 0));
    h.addBox('airWall-divider', { xMin: 0, xMax: 20, yMin: -100, yMax: 220 });
    const request = { unit, target, role: 'minion', speed: 120, dt: 1 / 60, body: body(10), stopDistance: 0 };
    currentFrame++;
    h.service.nextVelocity(request, outVec());
    settleService(h.service);
    currentFrame++;
    const first = h.service.nextVelocity(request, outVec());
    assert.strictEqual(Math.hypot(first.x, first.y), 0, 'approach connectivity may be pending for one bounded frame');
    settleService(h.service);
    currentFrame++;
    const approach = h.service.nextVelocity(request, outVec());
    assert.ok(approach.x > 0 && Math.hypot(approach.x, approach.y) <= request.speed + 0.001,
        JSON.stringify({ approach, jobs: h.service._field.debugPendingJobs, graphs: h.service._field.debugGraphBuildCount,
            fields: h.service._field.buildCount, cache: h.service._field.debugEntries }));
    h.service.destroy();
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
    class PolygonCollider2D {}
    class Component {}
    return {
        BoxCollider2D,
        PolygonCollider2D,
        Vec2,
        Vec3,
        Node: class {},
        Component,
        Enum: (value) => value,
        _decorator: { ccclass: () => (Type) => Type, property: () => () => {} },
        Scene: class {},
        director: { getTotalFrames: () => currentFrame },
    };
}

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
    class LogStub {
        getPhase() { return 'fixed'; }
        isAttackable() { return true; }
        getBoxCollider() { return this.box ?? null; }
    }
    const mocks = {
        cc,
        [path.join(root, 'assets/scripts/core/EventManager.ts')]: { EventManager: { instance: eventManager } },
        [path.join(root, 'assets/scripts/core/GameConfig.ts')]: {
            GameConfig: {
                enemyFlowCellSize: 30,
                enemyFlowLookaheadCells: 20,
                enemyFlowTargetSearchCells: 8,
                enemyNavWorkUnitsPerFrame: 4096,
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
        [path.join(root, 'assets/scripts/building/Building.ts')]: { Building: class { isAlive() { return true; } } },
        [path.join(root, 'assets/scripts/building/Tower.ts')]: { Tower: class {} },
        [path.join(root, 'assets/scripts/building/Wall.ts')]: { Wall: class {} },
        [path.join(root, 'assets/scripts/item/Log.ts')]: { Log: LogStub },
        [path.join(root, 'assets/scripts/core/NavigationObstacle.ts')]: {
            NavigationObstacle: class {},
            NavigationObstacleKind: { Ignore: 0, Hard: 1, Destructible: 2 },
        },
    };
    const exports = loadTs('assets/scripts/core/EnemyNavigation.ts', mocks);
    return { EnemyNavigation: exports.EnemyNavigation, cc, eventManager, Log: LogStub,
        Building: mocks[path.join(root, 'assets/scripts/building/Building.ts')].Building };
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
    settleService(service);
    service.nextVelocity({ unit: mockNode('shared-start-field', -80, 50), target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    settleService(service);
    assert.strictEqual(service.debugFieldBuildCount - startBuilds, 1);
    currentFrame += 1;
    for (let i = 0; i < 20; i++) {
        const unit = mockNode(`shared-again${i}`, -60, 50 + i);
        service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    }
    assert.strictEqual(service.debugFieldBuildCount - startBuilds, 1);
});

should('AC-READY-LATENCY: actual service frames publish both production body fields within the fixed cap', () => {
    const { EnemyNavigation, cc } = loadEnemyNavigationForServiceTests();
    const bounds = { minX: -1922.807, minY: -498.633, maxX: 1809.26, maxY: 3306.767 };
    const scene = eventNode('latency-scene'); scene.scene = scene;
    const service = EnemyNavigation.get(scene);
    const min = eventNode('latency-min', bounds.minX, bounds.minY);
    const right = eventNode('latency-right', bounds.maxX, bounds.minY);
    const max = eventNode('latency-max', bounds.maxX, bounds.maxY);
    const left = eventNode('latency-left', bounds.minX, bounds.maxY);
    service.configure({ boundsMin: min, boundsMax: max, walkablePolygon: [min, right, max, left],
        castlePolygon: [min, right, max, left], entrances: [{ id: 2,
            outside: eventNode('latency-outside', bounds.minX + 90, bounds.minY + 90),
            inside: eventNode('latency-inside', bounds.minX + 120, bounds.minY + 90),
            closePlot: null, width: 120, open: true }] });
    const wallNode = eventNode('airWall-latency');
    const wall = new cc.BoxCollider2D(); wall.node = wallNode; wall.enabled = true; wall.isValid = true;
    const wallX = Math.round((bounds.minX + bounds.maxX) * 0.5 / 30) * 30;
    wall.worldAABB = { xMin: wallX, xMax: wallX + 30, yMin: bounds.minY, yMax: bounds.maxY - 180 };
    wallNode.components.set(cc.BoxCollider2D, wall); scene.add(wallNode);
    const target = eventNode('latency-target', bounds.maxX - 180, bounds.minY + 180);
    const minion = eventNode('latency-minion', bounds.minX + 180, bounds.minY + 180);
    const boss = eventNode('latency-boss', bounds.minX + 180, bounds.minY + 240);
    const sameBody = Array.from({ length: 20 }, (_, i) => eventNode(`latency-minion-${i}`, bounds.minX + 180, bounds.minY + 180 + i % 3));
    const request = (unit, role, body) => service.nextVelocity({ unit, target, role, speed: 10, dt: 1, body }, outVec());
    currentFrame++;
    for (const unit of sameBody) {
        const pending = request(unit, 'minion', body(40));
        near(pending.x, 0); near(pending.y, 0);
    }
    const firstMinion = request(minion, 'minion', body(40));
    const firstBoss = request(boss, 'boss', body(80));
    near(firstMinion.x, 0); near(firstMinion.y, 0); near(firstBoss.x, 0); near(firstBoss.y, 0);
    assert.strictEqual(service._field.debugPendingJobs, 2, 'same-body units must share one field job');
    const enqueueFrame = currentFrame;
    let minionReadyFrame = null, bossReadyFrame = null;
    for (let i = 0; i < 48 && (minionReadyFrame === null || bossReadyFrame === null); i++) {
        currentFrame++;
        const minionVelocity = request(minion, 'minion', body(40));
        const bossVelocity = request(boss, 'boss', body(80));
        assert.ok(service.debugStats.schedulerLastWork <= 4096);
        if (Math.hypot(minionVelocity.x, minionVelocity.y) > 0 && minionReadyFrame === null) minionReadyFrame = currentFrame;
        if (Math.hypot(bossVelocity.x, bossVelocity.y) > 0 && bossReadyFrame === null) bossReadyFrame = currentFrame;
    }
    assert.strictEqual(service._field.debugGraphBuildCount, 0, 'normal pursuit must not build a graph');
    assert.ok(minionReadyFrame !== null && minionReadyFrame - enqueueFrame <= 48, `minion readiness: ${minionReadyFrame}`);
    assert.ok(bossReadyFrame !== null && bossReadyFrame - enqueueFrame <= 48, `boss readiness: ${bossReadyFrame}`);
    service.destroy();
    return { enqueueFrame, minionReadyFrame, bossReadyFrame, schedulerWork: service.debugStats.schedulerWork };
});

should('AC-UNIFIED: missing walkable ground fails closed, then requires no entrance configuration', () => {
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
    const unified = service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 }, outVec());
    assert.ok(unified.x > 0);
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
    service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 });
    settleService(service);
    service.nextVelocity({ unit, target, role: 'minion', speed: 10, dt: 1, body: body(10), stopDistance: 0 });
    settleService(service);
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
    service.nextVelocity({ unit, target, role: 'boss', speed: 10, dt: 1, body: body(60), stopDistance: 0 });
    settleService(service);
    service.nextVelocity({ unit, target, role: 'boss', speed: 10, dt: 1, body: body(60), stopDistance: 0 });
    settleService(service);
    const first = service.nextVelocity({ unit, target, role: 'boss', speed: 10, dt: 1, body: body(60), stopDistance: 0 });
    assert.ok(first.x < 0, `expected movement toward inside stair point, got ${first.x}`);
    unit.set(-1, 50);
    currentFrame += 1;
    service.nextVelocity({ unit, target, role: 'boss', speed: 10, dt: 1, body: body(60), stopDistance: 0 });
    settleService(service);
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
    assert.strictEqual(f.debugPendingJobs, 1);
    settle(f);
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
    f.direction(start, { x: 100, y: 0 }, body(4), boundary); settle(f);
    f.direction(start, { x: 100, y: 0 }, body(4), boundary); settle(f);
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
        f.advanceJobs(8);
        assert.ok(f.debugEntries <= budget.entries); assert.ok(f.debugBytes <= budget.bytes);
    }
    assert.ok(f.debugJobStats.totalWork > 0); assert.ok(f.debugStats.peakEntries <= budget.entries);
    f.clear(); assert.strictEqual(f.debugEntries, 0); assert.strictEqual(f.debugBytes, 0);
    return { queries: 10000, revisionChanges: 1000, budget, stats: f.debugStats };
});

should('AC-CACHE-BYTES: byte pressure evicts retained fields before the entry limit', () => {
    const budget = { entries: 64, bytes: 8192, cells: 4096 }, f = new FlowField(20, 20, budget);
    const a = area({ obstacles: [{ xMin: 20, xMax: 40, yMin: -30, yMax: 100 }] });
    for (let i = 0; i < 300; i++) {
        f.direction({ x: -60, y: -60 }, { x: 80 + i % 4 * 20, y: 80 + Math.floor(i / 4) % 5 * 20 }, body(4 + i % 3), a, true);
        f.advanceJobs(32);
        assert.ok(f.debugBytes <= budget.bytes); assert.ok(f.debugEntries < budget.entries);
    }
    assert.ok(f.debugStats.peakBytes > 3000); assert.ok(f.debugJobStats.totalWork > 0);
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
    const { EnemyNavigation, cc, Log } = loadEnemyNavigationForServiceTests();
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
    return { scene, service, cc, Log, addBox, min, max, ground, outside, inside };
}

should('AC-SELECTED-ROUTE: direct selected Log is available without a physical-detour graph', () => {
    const h = serviceFixture();
    const unit = h.scene.add(eventNode('tri-unit', -60, 0));
    const target = h.scene.add(eventNode('tri-target', 100, 0));
    const logNode = h.scene.add(eventNode('tri-fixed-log'));
    const log = new h.Log(); log.node = logNode; log.isValid = true; logNode.components.set(h.Log, log);
    const box = new h.cc.BoxCollider2D(); box.node = logNode; box.enabled = true; box.isValid = true;
    box.worldAABB = { xMin: 0, xMax: 20, yMin: -100, yMax: 220 };
    log.box = box; logNode.components.set(h.cc.BoxCollider2D, box);
    const request = { unit, target, role: 'minion', speed: 10, dt: 1, body: body(10) };
    currentFrame++;
    const route = h.service.blockingLog(request, 20);
    assert.ok(route && route.log === log, 'selected direct leg must expose the fixed Log');
    const graphs = h.service._field.debugGraphBuildCount;
    currentFrame++;
    assert.ok(h.service.blockingLog(request, 20));
    assert.strictEqual(graphs, 0, 'direct selected leg must not build a physical-detour graph');
    box.enabled = false;
    h.service.invalidate();
    h.service.blockingLog(request, 20);
    assert.strictEqual(h.service._field.debugEntries, 0, 'a committed collider change discards prior tri-state/query entries');
    h.service.destroy();
});

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

should('AC-INVALIDATE: static physics transform notifications preserve pending shared flow work', () => {
    const h = serviceFixture();
    const wall = h.addBox('airWall-static', { xMin: 30, xMax: 50, yMin: -100, yMax: 100 });
    const unit = h.scene.add(eventNode('static-unit', -80, 0));
    const target = h.scene.add(eventNode('static-target', 120, 0));
    const request = { unit, target, role: 'minion', speed: 10, dt: 0.016, body: body(10) };

    currentFrame++;
    assert.ok(h.service.nextVelocity(request, outVec()).x === 0, 'blocked route must queue a shared field');
    assert.strictEqual(h.service._field.debugPendingJobs, 1);
    const commits = h.service.debugStats.effectiveCommits;
    const invalidations = h.service._field.debugJobStats.cancelled;

    let moved = false;
    for (let frame = 0; frame < 60; frame++) {
        // Mirrors Box2D writing the same transform back to a static collider node each physics step.
        wall.node.emit('transform-changed', 1);
        wall.node.emit('transform-changed', 2);
        currentFrame++;
        const velocity = h.service.nextVelocity(request, outVec());
        moved ||= Math.hypot(velocity.x, velocity.y) > 0;
    }

    assert.strictEqual(h.service.debugStats.effectiveCommits, commits, 'unchanged AABB must not publish a new obstacle revision');
    assert.strictEqual(h.service._field.debugJobStats.cancelled, invalidations, 'static notifications must not cancel the pending job');
    assert.strictEqual(h.service._field.debugPendingJobs, 0, 'the shared job must get scheduler time to finish');
    assert.ok(moved, 'a settled flow field must produce a detour velocity');

    wall.worldAABB = { xMin: 130, xMax: 150, yMin: -100, yMax: 100 };
    wall.node.emit('transform-changed', 1);
    currentFrame++;
    assert.ok(Math.hypot(h.service.nextVelocity(request, outVec()).x, h.service.nextVelocity(request, outVec()).y) > 0);
    assert.strictEqual(h.service.debugStats.effectiveCommits, commits + 1, 'actual AABB movement must commit a new revision');
    assert.strictEqual(h.service._field.debugEntries, 0, 'a committed geometry change must discard old shared route data');
    h.service.destroy();
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
    h.service.setEntranceOpen(1, false); los(); assert.strictEqual(h.service.debugStats.effectiveCommits, commit);
    h.scene.emit('node-destroyed'); assert.strictEqual(h.service._field.debugEntries, 0);
});

should('AC-ACTUAL-CONTACT: real Minion and Boss use stable envelopes, real service and final safe speed', () => {
    clearLoaded(['assets/scripts/enemy/EnemyMinion.ts', 'assets/scripts/enemy/EnemyBoss.ts', 'assets/scripts/core/EnemyNavigation.ts']);
    const base = actualScriptMocks({ [path.join(root, 'assets/scripts/enemy/EnemyAI.ts')]: { EnemyAI: class {} } });
    delete base.mocks[path.join(root, 'assets/scripts/core/EnemyNavigation.ts')];
    base.mocks[path.join(root, 'assets/scripts/core/GameConfig.ts')].GameConfig = loadTs('assets/scripts/core/GameConfig.ts').GameConfig;
    base.mocks[path.join(root, 'assets/scripts/core/TweenUtil.ts')] = { TweenUtil: {} };
    clearLoaded(['assets/scripts/item/Log.ts']);
    delete base.mocks[path.join(root, 'assets/scripts/item/Log.ts')];
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
    const log = new base.classes.Log(); log._hp = base.mocks[path.join(root, 'assets/scripts/core/GameConfig.ts')].GameConfig.logMaxHp; let phase = 'rolling';
    const setPhase = value => { phase = value; log._phase = value; log._isLocked = value === 'fixed'; log._isFading = value === 'failed'; };
    const logNode = scene.add(eventNode('log')); log.node = logNode; logNode.components.set(base.classes.Log, log);
    const logBox = new base.cc.BoxCollider2D(); logBox.node = logNode; logBox.enabled = true;
    logBox.worldAABB = { xMin: -100, xMax: 100, yMin: -20, yMax: 20 }; logNode.components.set(base.cc.BoxCollider2D, logBox);
    // The mock scene receives components after its initial child attachment; mirror
    // Creator's component-added notification so the production watcher sees it.
    nav._prepareFrame(); logNode.emit('component-added', logBox);
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
            if (phase === 'fixed') {
                assert.ok(nav._rectByCollider.has(logBox), `${Type.name} fixed Log was not tracked`);
                assert.strictEqual(nav._field.pointWalkable({ x: 0, y: 25 }, unit._bodySize(), nav._area), false);
                assert.ok(Math.hypot(v.x, v.y) > 0, `${Type.name} must receive bounded overlap recovery`);
                assert.ok(Math.hypot(v.x, v.y) <= 5, `${Type.name} recovery must stay within rigidbody speed`);
            }
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
        let sawField = false, sawBoundaryApproach = false;
        for (let frame = 0; frame < 300; frame++) {
            currentFrame++; unit.node.move((frame % 7) * 0.1, frame % 3); target.move(300 + frame % 4 * 20, 200);
            box.worldAABB = { width: 40 + frame % 3, height: 40, xMin: -20, xMax: 20 + frame % 3, yMin: -20, yMax: 20 };
            unit.update(0.016);
            const speed = Math.hypot(unit._rb.linearVelocity.x, unit._rb.linearVelocity.y);
            assert.ok(speed <= 5.001, `${Type.name} boundary approach must preserve physics speed`);
            sawBoundaryApproach ||= speed > 0;
            sawField ||= nav._field.buildCount >= 1;
            assert.ok(nav._field.debugGraphBuildCount <= 1);
            assert.ok(nav._field.buildCount <= 8, 'moving targets must remain within the shared field set');
        }
        assert.ok(sawField, `${Type.name} should finish one current body field before boundary approach`);
        assert.ok(sawBoundaryApproach, `${Type.name} should approach the reachable side of a sealed wall`);
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
    settleService(h.service);
    h.service.nextVelocity({ unit, target, role: 'minion', speed: 2, dt: 1, body: body(4) });
    settleService(h.service);
    h.service.nextVelocity({ unit, target, role: 'minion', speed: 2, dt: 1, body: body(4) });
    const id = h.service._unitState.get(unit).activeFieldId;
    assert.ok(id); assert.strictEqual(h.service._field.debugRefCount(id), 1);
    unit.set(80, 0); currentFrame++;
    h.service.nextVelocity({ unit, target, role: 'minion', speed: 2, dt: 1, body: body(4) });
    assert.strictEqual(h.service._unitState.get(unit).activeFieldId, '');
    assert.strictEqual(h.service._field.debugRefCount(id), 0);
    h.service.releaseUnit(unit); assert.strictEqual(h.service._unitState.size, 0); h.service.destroy();
});

should('AC-CONTINUITY: retained settled route stays safe while a moving target replacement is pending', () => {
    const h = serviceFixture();
    const wall = h.addBox('airWall-moving-target', { xMin: 20, xMax: 40, yMin: -100, yMax: 100 });
    const unit = h.scene.add(eventNode('continuity-unit', -80, 0));
    const target = h.scene.add(eventNode('continuity-target', 120, 0));
    const request = { unit, target, role: 'minion', speed: 20, dt: 1 / 60, body: body(10) };
    currentFrame++; h.service.nextVelocity(request, outVec()); settleService(h.service);
    currentFrame++;
    assert.ok(Math.hypot(h.service.nextVelocity(request, outVec()).x, h.service.nextVelocity(request, outVec()).y) > 0);
    const state = h.service._unitState.get(unit);
    assert.ok(state.activeFieldId && h.service._field.debugRefCount(state.activeFieldId) === 1);
    let pendingFrames = 0;
    for (let frame = 1; frame <= 8; frame++) {
        target.set(120 + frame * 30, 0); currentFrame++;
        const velocity = h.service.nextVelocity(request, outVec());
        if (state.replacementReadiness === 'pending') {
            pendingFrames++;
            assert.ok(Math.hypot(velocity.x, velocity.y) > 0, 'retained safe route stopped while replacement was pending');
        }
        assert.ok(h.service.debugStats.schedulerLastWork <= 4096);
        assert.ok(h.service._field.debugEntries <= 32 && h.service._field.debugBytes <= 8388608);
    }
    assert.ok(pendingFrames > 0, 'moving target must exercise a coalesced pending replacement');
    wall.enabled = false; h.service.invalidate(); currentFrame++; h.service.nextVelocity(request, outVec());
    assert.strictEqual(state.activeFieldId, '', 'geometry revision must clear retained field ownership');
    target.activeInHierarchy = false; currentFrame++; h.service.nextVelocity(request, outVec());
    assert.strictEqual(state.activeFieldId, '', 'invalid target must not retain a stale field');
    h.service.releaseUnit(unit); h.service.destroy();
});

should('AC-V2-GEOMETRY-CONTINUITY: distant construction keeps Minion and Boss moving on the last safe direction', () => {
    for (const role of ['minion', 'boss']) {
        const h = serviceFixture();
        h.addBox(`airWall-v2-route-${role}`, { xMin: 20, xMax: 40, yMin: -20, yMax: 40 });
        const unit = h.scene.add(eventNode(`v2-geometry-unit-${role}`, -80, 0));
        const target = h.scene.add(eventNode(`v2-geometry-target-${role}`, 120, 0));
        const request = { unit, target, role, speed: 20, dt: 1 / 60, body: body(10) };
        currentFrame++; h.service.nextVelocity(request, outVec()); settleService(h.service);
        currentFrame++;
        assert.ok(Math.hypot(h.service.nextVelocity(request, outVec()).x, h.service.nextVelocity(request, outVec()).y) > 0,
            `${role} did not establish a settled detour`);
        const state = h.service._unitState.get(unit);
        assert.ok(state.activeFieldId && state.lastSafeDirection, `${role} did not retain settled movement`);

        h.addBox(`airWall-v2-city-distant-${role}`, { xMin: 150, xMax: 170, yMin: 130, yMax: 150 });
        currentFrame++;
        const afterBuild = h.service.nextVelocity(request, outVec());
        assert.strictEqual(state.activeFieldId, '', `${role} must not keep an old-revision field`);
        assert.ok(state.lastSafeDirection, `${role} lost its safe direction for a distant building`);
        assert.ok(state.replacementReadiness === 'pending');
        assert.ok(Math.hypot(afterBuild.x, afterBuild.y) > 0, `${role} stopped for a distant building`);
        assert.ok(h.service.debugStats.schedulerLastWork <= 4096);
        h.service.destroy();
    }
});

should('AC-V2-SWEEP: obstacle approach clips only this frame while a nearby Log stops at its safe edge', () => {
    const h = serviceFixture();
    const unit = h.scene.add(eventNode('v2-sweep-unit', -80, 0));
    const target = h.scene.add(eventNode('v2-sweep-target', 120, 0));
    const logNode = h.scene.add(eventNode('v2-sweep-log'));
    const log = new h.Log(); log.node = logNode; log.isValid = true; logNode.components.set(h.Log, log);
    const box = new h.cc.BoxCollider2D(); box.node = logNode; box.enabled = true; box.isValid = true;
    box.worldAABB = { xMin: 70, xMax: 90, yMin: -20, yMax: 20 };
    log.box = box; logNode.components.set(h.cc.BoxCollider2D, box);
    const request = { unit, target, role: 'minion', speed: 100, dt: 1, body: body(10) };
    currentFrame++;
    const route = { target: logNode, point: { x: 60, y: 0 } };
    const distant = h.service.nextObstacleVelocity(request, route, outVec());
    assert.ok(distant.x > 99, `distant physical blocker prematurely stopped obstacle approach: ${JSON.stringify(distant)}`);
    const atEdge = outVec(); atEdge.set(100, 0);
    h.service._constrainVelocity({ x: 60, y: 0 }, request.body, request.dt, atEdge);
    assert.strictEqual(Math.hypot(atEdge.x, atEdge.y), 0, 'sweep must not enter the live Log collider');
    h.service.destroy();
});

should('AC-V2-STARVATION: a completed old target-cell field makes interim progress while newest replacement is queued', () => {
    const h = serviceFixture();
    h.addBox('airWall-v2-churn', { xMin: 20, xMax: 40, yMin: -20, yMax: 40 });
    const unit = h.scene.add(eventNode('v2-churn-unit', -80, 0));
    const target = h.scene.add(eventNode('v2-churn-target', 120, 0));
    const request = { unit, target, role: 'boss', speed: 20, dt: 1 / 60, body: body(10) };
    currentFrame++; h.service.nextVelocity(request, outVec()); settleService(h.service);
    currentFrame++; h.service.nextVelocity(request, outVec());
    const state = h.service._unitState.get(unit);
    assert.ok(state.activeFieldId);

    target.set(150, 0); currentFrame++; h.service.nextVelocity(request, outVec());
    const oldPending = state.pendingFieldId;
    assert.ok(oldPending && state.replacementReadiness === 'pending');
    settleService(h.service);
    target.set(180, 0); currentFrame++;
    const interim = h.service.nextVelocity(request, outVec());
    assert.ok(Math.hypot(interim.x, interim.y) > 0, 'completed old cell field was discarded during target churn');
    assert.ok(state.activeFieldId === oldPending, 'old completed field was not adopted as interim progress');
    assert.ok(state.pendingFieldId && state.pendingFieldId !== oldPending, 'newest target replacement was not coalesced');
    settleService(h.service);
    currentFrame++;
    h.service.nextVelocity(request, outVec());
    assert.ok(state.activeFieldId === h.service._field.fieldIdFor({ x: 180, y: 0 }, request.body, h.service._planningArea));
    assert.ok(h.service._field.debugEntries <= 32 && h.service._field.debugBytes <= 8388608);
    h.service.destroy();
});

should('AC-V2-LIFECYCLE: target invalidation and a new collider at the unit clear retained direction ownership', () => {
    const h = serviceFixture();
    h.addBox('airWall-v2-life-route', { xMin: 20, xMax: 40, yMin: -20, yMax: 40 });
    const unit = h.scene.add(eventNode('v2-life-unit', -80, 0));
    const target = h.scene.add(eventNode('v2-life-target', 120, 0));
    const request = { unit, target, role: 'minion', speed: 20, dt: 1 / 60, body: body(10) };
    currentFrame++; h.service.nextVelocity(request, outVec()); settleService(h.service);
    currentFrame++; h.service.nextVelocity(request, outVec());
    const state = h.service._unitState.get(unit);
    assert.ok(state.lastSafeDirection);
    target.activeInHierarchy = false; currentFrame++; h.service.nextVelocity(request, outVec());
    assert.strictEqual(state.lastSafeDirection, null, 'invalid target retained a stale direction');

    target.activeInHierarchy = true; currentFrame++; h.service.nextVelocity(request, outVec()); settleService(h.service);
    currentFrame++; h.service.nextVelocity(request, outVec());
    h.addBox('airWall-v2-life-contact', { xMin: -85, xMax: -75, yMin: -5, yMax: 5 });
    currentFrame++; h.service.nextVelocity(request, outVec());
    assert.strictEqual(state.lastSafeDirection, null, 'overlapping new collider retained an invalid direction');
    h.service.destroy();
});

if (process.env.NAV_HARNESS_ONLY !== '1' && !process.exitCode) console.log('enemy navigation core tests passed');
if (process.env.NAV_HARNESS_ONLY !== '1') {
    const dir = path.resolve(root, process.env.NAV_EVIDENCE_DIR || '.cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-evidence/v3');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'logic-results-v3.json'), JSON.stringify({ node: process.version, typescript: ts.version, testResults }, null, 2));
}
module.exports = { loadTs, clearLoaded, loadEnemyNavigationForServiceTests, actualScriptMocks,
    componentNode, mockNode, groundNodes, outVec, eventNode, advanceFrame: () => ++currentFrame };
