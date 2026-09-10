const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const cp = require('child_process');
const ts = require('typescript');
const assert = require('assert');
const { performance: perf } = require('perf_hooks');
const root = path.resolve(__dirname, '../..');
const evidenceArg = process.argv.indexOf('--evidence-dir');
const evidence = evidenceArg >= 0
    ? path.resolve(root, process.argv[evidenceArg + 1])
    : path.join(root, '.cursor/plans/reports/fix-enemy-navigation-performance-evidence');
const baseline = process.argv.includes('--baseline');
const serviceOnly = process.argv.includes('--service');
const extended = process.argv.includes('--extended');
const beforeSource = process.argv.includes('--before-source');
const constructionJobs = process.argv.includes('--construction-jobs');
const fullRun = !baseline && !beforeSource && !serviceOnly && !extended && !constructionJobs;
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
fs.mkdirSync(evidence, { recursive: true });
const sourceFiles = ['assets/scripts/core/FlowField.ts', 'assets/scripts/core/EnemyNavigation.ts',
    'assets/scripts/core/GameConfig.ts', 'assets/scripts/building/BuildSystem.ts',
    'assets/scripts/enemy/EnemySpawner.ts', 'assets/scripts/enemy/EnemyMinion.ts',
    'assets/scripts/enemy/EnemyBoss.ts', '.cursor/scripts/test-enemy-navigation.cjs'];
if (baseline && !serviceOnly) {
    const dest = path.join(evidence, 'baseline');
    if (fs.existsSync(dest)) throw new Error('Baseline already exists; never overwrite original snapshots');
    fs.mkdirSync(dest);
    const status = cp.execFileSync('git', ['status', '--porcelain=v1', '-uall'], { cwd: root, encoding: 'utf8' });
    const files = new Set([...sourceFiles, 'assets/scenes/Main.scene', 'assets/scripts/item/Log.ts',
        ...status.trimEnd().split('\n').filter(Boolean).map(line => line.slice(3).replace(/^"|"$/g, ''))]);
    const hashes = {};
    for (const file of files) {
        if (!fs.existsSync(path.join(root, file)) || !fs.statSync(path.join(root, file)).isFile()) continue;
        const data = fs.readFileSync(path.join(root, file));
        hashes[file] = hash(data);
    }
    for (const file of sourceFiles) fs.copyFileSync(path.join(root, file), path.join(dest, path.basename(file)));
    fs.writeFileSync(path.join(dest, 'manifest.json'), JSON.stringify({
        head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), status, hashes,
    }, null, 2));
    fs.writeFileSync(path.join(dest, 'dirty.diff'), cp.execFileSync('git', ['diff', '--binary'], { cwd: root }));
}
const source = fs.readFileSync(beforeSource ? path.join(evidence, 'baseline/FlowField.ts') : path.join(root, 'assets/scripts/core/FlowField.ts'), 'utf8');
const sandbox = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, sandbox);
const { FlowField } = sandbox.exports;
function instrument(object, name, metrics, key) {
    const original = object[name];
    if (typeof original !== 'function') return;
    object[name] = function (...args) {
        const start = perf.now();
        try { return original.apply(this, args); }
        finally { metrics[key] = (metrics[key] ?? 0) + perf.now() - start; }
    };
}
function measuredFlow() {
    const flow = new FlowField(20, 20), cpu = {};
    instrument(flow, '_bfs', cpu, 'bfsMs');
    instrument(flow, '_graphFor', cpu, 'graphLookupAndBuildMs');
    instrument(flow, 'nearestReachableWalkable', cpu, 'approachMs');
    return { flow, cpu };
}
function memory(flow) {
    return flow.debugBytes ?? [...flow._cache.values()].reduce((sum, field) => sum + field.distances.byteLength + field.id.length * 2 + 128, 0);
}
const scene = JSON.parse(fs.readFileSync(path.join(root, 'assets/scenes/Main.scene'), 'utf8'));
function worldPoint(id) {
    const obj = scene[id];
    let p = { x: obj._lpos.x, y: obj._lpos.y };
    for (let parent = obj._parent; parent; parent = scene[parent.__id__]._parent) {
        const n = scene[parent.__id__];
        if (n._lscale && (n._lscale.x !== 1 || n._lscale.y !== 1)) throw new Error('Unexpected parent scale');
        if (n._lrot && (n._lrot.x || n._lrot.y || n._lrot.z)) throw new Error('Unexpected parent rotation');
        p.x += n._lpos?.x ?? 0; p.y += n._lpos?.y ?? 0;
    }
    return p;
}
const bindings = scene.filter(n => n.navBoundsMin?.__id__ !== undefined && n.navBoundsMax?.__id__ !== undefined);
if (bindings.length !== 1) throw new Error(`Expected one navigation bounds binding, found ${bindings.length}`);
const min = worldPoint(bindings[0].navBoundsMin.__id__), max = worldPoint(bindings[0].navBoundsMax.__id__);
const boundsSets = {
    default: { minX: -1200, minY: -1200, maxX: 1200, maxY: 1600 },
    scene: { minX: min.x, minY: min.y, maxX: max.x, maxY: max.y },
};
const rows = [];
for (const [boundsName, bounds] of constructionJobs || serviceOnly || extended ? [] : Object.entries(boundsSets)) {
    for (const name of ['CLEAR-200', 'UNREACHABLE-COLD', 'INVALIDATE-5', 'LOG-OVERLAP-COLD']) {
        for (let round = 0; round < 5; round++) {
            const { flow, cpu } = measuredFlow();
            const area = { bounds, obstacleVersion: 1, obstacles: [], walkablePolygons: [[
                { x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
                { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY },
            ]] };
            const from = { x: 0, y: name.startsWith('LOG') ? 25 : 0 };
            const target = { x: name.startsWith('UNREACHABLE') ? 600 : name.startsWith('LOG') ? 300 : 200, y: 200 };
            if (name.startsWith('UNREACHABLE')) area.obstacles = [{ xMin: 100, xMax: 140, yMin: bounds.minY, yMax: bounds.maxY }];
            if (name.startsWith('LOG')) { area.obstacles = [{ xMin: -100, xMax: 100, yMin: -20, yMax: 20 }]; delete area.walkablePolygons; }
            const iterations = name === 'CLEAR-200' ? 200 : name === 'INVALIDATE-5' ? 5 : 1;
            const start = perf.now();
            let result;
            for (let i = 0; i < iterations; i++) {
                if (name === 'INVALIDATE-5') flow.invalidate();
                result = flow.nearestReachableWalkable(from, target, { width: 40, height: 40 }, area);
            }
            const row = { bounds: boundsName, name, round, ms: perf.now() - start, builds: flow.buildCount,
                cache: flow.debugCacheSize, graphs: flow.debugGraphBuildCount ?? null, entries: flow.debugEntries ?? flow.debugCacheSize,
                bytes: memory(flow), stats: flow.debugStats ?? null, cpu, result };
            if (!baseline && !beforeSource) {
                assert.strictEqual(flow.buildCount, 0, name);
                assert.strictEqual(flow.debugGraphBuildCount, name === 'UNREACHABLE-COLD' ? 1 : 0, name);
                if (name === 'LOG-OVERLAP-COLD' || name === 'UNREACHABLE-COLD') assert.strictEqual(result, null);
            }
            rows.push(row);
            console.log(JSON.stringify(row));
        }
    }
}
if (extended || fullRun) {
    for (const [boundsName, bounds] of Object.entries(boundsSets)) {
        for (const name of ['WARM-UNREACHABLE-200', 'MOVING-BODY-TARGET-200']) {
            for (let round = 0; round < 5; round++) {
                const { flow, cpu } = measuredFlow();
                const area = { bounds, obstacleVersion: 1, obstacles: [{ xMin: 100, xMax: 140, yMin: bounds.minY, yMax: bounds.maxY }] };
                const makeBody = i => {
                    const b = { width: 40 + (i % 2 ? 1e-12 : -1e-12), height: 40, offsetX: i % 2 ? 1e-12 : -1e-12, offsetY: 0 };
                    return sandbox.exports.stableFlowBody ? sandbox.exports.stableFlowBody(b) : b;
                };
                const coldStart = perf.now();
                const b = name.startsWith('WARM') ? { width: 40, height: 40 } : makeBody(0);
                flow.nearestReachableWalkable({ x: 0, y: 0 }, { x: 600, y: 200 }, b, area);
                const coldMs = perf.now() - coldStart;
                const builds = flow.buildCount, graphs = flow.debugGraphBuildCount ?? null;
                const start = perf.now();
                for (let i = 0; i < 200; i++) {
                    const moving = name.startsWith('MOVING');
                    const result = flow.nearestReachableWalkable({ x: (i % 7) * 0.1, y: i % 3 },
                        { x: 600 + (moving ? (i % 4) * 20 : 0), y: 200 }, moving ? makeBody(i) : b, area);
                    if (result !== null) throw new Error(`${name}: unexpected reachable result`);
                }
                const row = { bounds: boundsName, name, round, coldMs, ms: perf.now() - start,
                    builds: flow.buildCount, additionalBuilds: flow.buildCount - builds,
                    graphs: flow.debugGraphBuildCount ?? null, additionalGraphs: graphs === null ? null : flow.debugGraphBuildCount - graphs,
                    entries: flow.debugEntries ?? flow.debugCacheSize, bytes: memory(flow), stats: flow.debugStats ?? null, cpu };
                if (!beforeSource) {
                    assert.strictEqual(row.additionalBuilds, 0); assert.strictEqual(row.additionalGraphs, 0);
                    assert.strictEqual(row.graphs, 1); assert.ok(row.bytes <= 8388608); assert.ok(row.entries <= 32);
                }
                rows.push(row); console.log(JSON.stringify(row));
            }
        }
    }
}
if (serviceOnly || fullRun) {
    process.env.NAV_HARNESS_ONLY = '1';
    const h = require('./test-enemy-navigation.cjs');
    for (let round = 0; round < 5; round++) {
        const { EnemyNavigation } = h.loadEnemyNavigationForServiceTests();
        const boxes = Array.from({ length: 100 }, (_, i) => ({ node: h.mockNode(`airWall-${i}`, 0, 0),
            enabled: true, isValid: true, worldAABB: { xMin: 150 + i, xMax: 155 + i, yMin: 100, yMax: 110 } }));
        const scene = { getComponentsInChildren: () => boxes };
        const service = EnemyNavigation.get(scene);
        const cpu = {};
        instrument(service, '_prepareFrame', cpu, 'prepareFrameMs');
        service.configure({ walkablePolygon: h.groundNodes() });
        const a = h.mockNode('a', 0, 0), b = h.mockNode('b', 100, 0);
        const start = perf.now();
        for (let frame = 0; frame < 300; frame++) {
            h.advanceFrame();
            service.hasLineOfSight(a, b, { width: 10, height: 10 });
        }
        const stableMs = perf.now() - start;
        const stableScans = service.debugObstacleRefreshCount;
        const oldVersion = service._obstacles.version;
        for (let i = 0; i < 5; i++) service.invalidate();
        service.hasLineOfSight(a, b, { width: 10, height: 10 });
        const row = { bounds: 'service', name: 'STABLE-300-INVALIDATE-5', round, ms: stableMs, stableMs, stableScans, duplicateVersionDelta: service._obstacles.version - oldVersion,
            diagnostics: service.debugStats ?? null, cpu };
        if (!baseline) { assert.strictEqual(stableScans, 1); assert.strictEqual(row.duplicateVersionDelta, 0); }
        rows.push(row); console.log(JSON.stringify(row)); service.destroy();
    }
}
const constructionRows = [];
if (constructionJobs) {
    const budget = 4096;
    const bounds = boundsSets.scene;
    const width = Math.ceil((bounds.maxX - bounds.minX) / 30);
    const height = Math.ceil((bounds.maxY - bounds.minY) / 30);
    for (let round = 0; round < 5; round++) {
        const flow = new FlowField(30, 20);
        const wallX = Math.round((bounds.minX + bounds.maxX) * 0.5 / 30) * 30;
        const ground = [{ x: bounds.minX, y: bounds.minY }, { x: bounds.maxX, y: bounds.minY },
            { x: bounds.maxX, y: bounds.maxY }, { x: bounds.minX, y: bounds.maxY }];
        const navArea = { bounds, obstacleVersion: round + 1, obstacles: [{ xMin: wallX, xMax: wallX + 30,
            yMin: bounds.minY, yMax: bounds.maxY - 180 }], walkablePolygons: [ground] };
        const minion = { width: 40, height: 40 };
        const boss = { width: 80, height: 80 };
        const from = { x: bounds.minX + 180, y: bounds.minY + 180 };
        const target = { x: bounds.maxX - 180, y: bounds.minY + 180 };
        const started = perf.now();
        const requests = [
            { name: 'minion', body: minion, from, target, diagnostic: true },
            { name: 'boss', body: boss, from: { x: from.x, y: from.y + 60 }, target, diagnostic: false },
        ];
        const readiness = Object.fromEntries(requests.map(request => [request.name, {
            enqueueFrame: 0, graphReadyFrame: null, fieldReadyFrame: null, diagnostic: request.diagnostic ? 'pending' : 'not-requested',
        }]));
        const slices = [];
        let schedulerFrame = 0;
        const updateReadiness = () => {
            for (const request of requests) {
                const key = `${request.body.width}x${request.body.height}@0,0:`;
                if (readiness[request.name].graphReadyFrame === null &&
                    [...flow._graphs.keys()].some(id => id.startsWith(key))) {
                    readiness[request.name].graphReadyFrame = schedulerFrame;
                }
                if (request.diagnostic) {
                    const diagnostic = flow.sharedQueryState(request.from, request.body, navArea,
                        `construction-connectivity:${request.name}`, () => ({ readiness: 'settled', value: request.name }));
                    readiness[request.name].diagnostic = diagnostic.readiness;
                }
                const route = flow.direction(request.from, request.target, request.body, navArea);
                if (!route.blocked && readiness[request.name].fieldReadyFrame === null) {
                    readiness[request.name].fieldReadyFrame = schedulerFrame;
                }
            }
        };
        const advanceSlice = () => {
            schedulerFrame++;
            const sliceStart = perf.now();
            const used = flow.advanceJobs(budget);
            const elapsedMs = perf.now() - sliceStart;
            slices.push({ frame: schedulerFrame, workUnits: used, elapsedMs, pendingJobs: flow.debugPendingJobs,
                jobs: [...flow._jobs.values()].map(job => ({ kind: job.kind, phase: job.phase, cursor: job.cursor, id: job.id })),
                readiness: JSON.parse(JSON.stringify(readiness)) });
            updateReadiness();
        };
        for (const request of requests.filter(request => request.diagnostic)) {
            assert.strictEqual(flow.sharedQueryState(request.from, request.body, navArea,
                `construction-connectivity:${request.name}`, () => ({ readiness: 'settled', value: request.name })).readiness, 'pending');
        }
        for (let i = 0; i < 100; i++) {
            assert.ok(flow.direction({ x: from.x, y: from.y + i % 3 }, target, minion, navArea).blocked);
        }
        assert.ok(flow.direction(requests[1].from, target, boss, navArea).blocked);
        assert.strictEqual(flow.debugPendingJobs, 3, 'one diagnostic graph and one normal field per production body');
        assert.ok([...flow._jobs.values()].some(job => job.kind === 'field'), 'normal field construction must not wait for graph completion');
        let graphFrames = 0, fieldFrames = 0;
        while (flow.debugPendingJobs) {
            advanceSlice();
            graphFrames = Math.max(graphFrames, ...Object.values(readiness).map(value => value.graphReadyFrame ?? 0));
            fieldFrames = Math.max(fieldFrames, ...Object.values(readiness).map(value => value.fieldReadyFrame ?? 0));
            assert.ok(schedulerFrame < 2000, 'construction jobs failed to settle');
        }
        const readyMinion = flow.direction(from, target, minion, navArea);
        const readyBoss = flow.direction(requests[1].from, target, boss, navArea);
        assert.ok(!readyMinion.blocked && !readyBoss.blocked, 'completed flow fields must publish atomically');
        for (const request of requests) {
            const latency = readiness[request.name];
            if (request.diagnostic) assert.strictEqual(latency.diagnostic, 'settled', `${request.name} diagnostic did not settle`);
        }
        const invalidated = new FlowField(30, 20);
        invalidated.direction(from, target, minion, navArea);
        invalidated.advanceJobs(budget);
        invalidated.invalidate();
        assert.strictEqual(invalidated.debugPendingJobs, 0, 'mid-job geometry invalidation must cancel old work');
        const elapsedMs = perf.now() - started;
        constructionRows.push({ round, cellSize: 30, width, height, workBudget: budget, graphFrames, fieldFrames,
            totalFrames: graphFrames + fieldFrames, elapsedMs, completedJobs: flow.debugJobStats.completed,
            cancelledJobs: flow.debugJobStats.cancelled + invalidated.debugJobStats.cancelled,
            coalescedJobs: flow.debugJobStats.coalesced, bodyKeys: [...flow._graphs.keys()], cacheEntries: flow.debugEntries,
            cacheBytes: flow.debugBytes, graphBuilds: flow.debugGraphBuildCount, fieldBuilds: flow.buildCount,
            jobStats: { ...flow.debugJobStats }, readiness, slices,
            minionReady: !readyMinion.blocked, bossReady: !readyBoss.blocked });
    }
}
const summary = [];
for (const bounds of [...new Set(rows.map(r => r.bounds))]) for (const name of [...new Set(rows.filter(r => r.bounds === bounds).map(r => r.name))]) {
    const values = rows.filter(r => r.bounds === bounds && r.name === name).map(r => r.ms).sort((a,b) => a-b);
    summary.push({ bounds, name, medianMs: values[2], p95Ms: values[4] });
}
if (constructionJobs) {
    const values = constructionRows.map(row => row.elapsedMs).sort((a, b) => a - b);
    const sliceValues = constructionRows.flatMap(row => row.slices.map(slice => slice.elapsedMs)).sort((a, b) => a - b);
    const sliceP95 = sliceValues[Math.ceil(sliceValues.length * 0.95) - 1];
    const sliceMax = sliceValues[sliceValues.length - 1];
    const output = { phase: 'construction-jobs', node: process.version, typescript: ts.version, platform: process.platform,
        arch: process.arch, sourceHash: hash(source), harnessHash: hash(fs.readFileSync(__filename)),
        sceneHash: hash(fs.readFileSync(path.join(root, 'assets/scenes/Main.scene'))), rows: constructionRows,
        summary: { runs: constructionRows.length, medianMs: values[2], p95Ms: values[4], cellSize: 30,
            grid: { width: constructionRows[0].width, height: constructionRows[0].height }, workBudget: constructionRows[0].workBudget,
            sliceP95Ms: sliceP95, sliceMaxMs: sliceMax } };
    // Persist every raw slice before evaluating any timing limit, including a failing run.
    fs.writeFileSync(path.join(evidence, 'construction-jobs-v3.json'), JSON.stringify(output, null, 2));
    for (const row of constructionRows) {
        assert.ok(row.slices.every(slice => slice.workUnits <= row.workBudget), `round ${row.round} exceeded ${row.workBudget} work units`);
        for (const [name, latency] of Object.entries(row.readiness)) {
            if (latency.graphReadyFrame !== null) assert.ok(latency.graphReadyFrame <= 48,
                `${name} graph readiness exceeded 48 frames: ${latency.graphReadyFrame}`);
            assert.ok(latency.fieldReadyFrame !== null && latency.fieldReadyFrame - latency.enqueueFrame <= 48,
                `${name} field readiness exceeded 48 frames: ${latency.fieldReadyFrame}`);
        }
    }
    assert.ok(sliceP95 <= 8, `slice p95 exceeded 8ms: ${sliceP95}`);
    assert.ok(sliceMax <= 12, `slice max exceeded 12ms: ${sliceMax}`);
    console.log(JSON.stringify(output.summary, null, 2));
} else {
    const output = { phase: baseline || beforeSource ? 'before' : 'after', node: process.version, typescript: ts.version,
        platform: process.platform, arch: process.arch, sourceHash: hash(source), harnessHash: hash(fs.readFileSync(__filename)),
        sceneHash: hash(fs.readFileSync(path.join(root, 'assets/scenes/Main.scene'))), boundsSets, rows, summary };
    fs.writeFileSync(path.join(evidence, `${baseline || beforeSource ? 'before' : 'after'}${serviceOnly ? '-service' : extended ? '-extended' : beforeSource ? '-replay' : ''}.json`), JSON.stringify(output, null, 2));
    console.log(JSON.stringify(summary, null, 2));
}
