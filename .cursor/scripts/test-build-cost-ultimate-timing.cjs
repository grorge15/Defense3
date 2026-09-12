const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
let assertions = 0;
let scenarios = 0;

function check(value, message) {
    assertions += 1;
    assert.ok(value, message);
}

function equal(actual, expected, message) {
    assertions += 1;
    assert.equal(actual, expected, message);
}

function test(name, fn) {
    scenarios += 1;
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        console.error(error);
        process.exitCode = 1;
    }
}

class Vec3 {
    constructor(x = 0, y = 0, z = 0) {
        this.set(x, y, z);
    }

    set(x, y, z = 0) {
        if (typeof x === 'object') {
            ({ x, y, z = 0 } = x);
        }
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
    }
}

class Component {
    constructor() {
        this.enabled = true;
        this.isValid = true;
        this.scheduled = [];
    }

    scheduleOnce(callback, delay) {
        this.scheduled.push({ callback, delay });
    }

    unscheduleAllCallbacks() {}

    destroy() {
        this.isValid = false;
    }
}

class Node {
    constructor(name = '') {
        this.name = name;
        this.children = [];
        this.components = [];
        this.position = new Vec3();
        this.active = true;
        this.isValid = true;
        this.parent = null;
        this._scene = null;
    }

    get scene() {
        return this._scene ?? this.parent?.scene ?? null;
    }

    set scene(value) {
        this._setScene(value);
    }

    get activeInHierarchy() {
        return this.active && (!this.parent || this.parent.activeInHierarchy);
    }

    get worldPosition() {
        return this.getWorldPosition(new Vec3());
    }

    _setScene(scene) {
        this._scene = scene;
        for (const child of this.children) {
            child._setScene(scene);
        }
    }

    addChild(child) {
        child.parent = this;
        child._setScene(this.scene);
        this.children.push(child);
        return child;
    }

    addComponent(Type) {
        const component = new Type();
        component.node = this;
        this.components.push(component);
        return component;
    }

    getComponent(Type) {
        return this.components.find((component) => component instanceof Type) ?? null;
    }

    getComponentInChildren(Type) {
        return this.getComponentsInChildren(Type)[0] ?? null;
    }

    getComponentsInChildren(Type) {
        return [
            ...this.components.filter((component) => component instanceof Type),
            ...this.children.flatMap((child) => child.getComponentsInChildren(Type)),
        ];
    }

    getWorldPosition(out) {
        const parentPosition = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3();
        return out.set(
            parentPosition.x + this.position.x,
            parentPosition.y + this.position.y,
            parentPosition.z + this.position.z,
        );
    }

    setWorldPosition(value) {
        const parentPosition = this.parent ? this.parent.getWorldPosition(new Vec3()) : new Vec3();
        this.position.set(
            value.x - parentPosition.x,
            value.y - parentPosition.y,
            value.z - parentPosition.z,
        );
    }

    destroy() {
        this.isValid = false;
        this.active = false;
    }
}

class Sprite {
    constructor() {
        this.fillRange = 0;
        this.color = null;
    }
}
Sprite.Type = { FILLED: 'filled' };
Sprite.FillType = { VERTICAL: 'vertical' };

class Collider2D extends Component {}
class BoxCollider2D extends Collider2D {}
class RigidBody2D extends Component {}
class UITransform extends Component {}
class SpriteFrame {}
class Color {}
class Size {}
class Prefab {
    constructor(factory) {
        this.factory = factory;
    }
}

class Animation extends Component {
    constructor() {
        super();
        this.finished = [];
        this.played = [];
        this.state = { speed: 1, clip: { duration: 0.2 }, duration: 0.2 };
    }

    getState() {
        return this.state;
    }

    once(_event, callback) {
        this.finished.push(callback);
    }

    play(name) {
        this.played.push(name);
    }
}
Animation.EventType = { FINISHED: 'finished' };

class Player extends Component {
    constructor() {
        super();
        this.isDead = false;
        this.canMoveCalls = [];
        this.onUltimateCast = null;
    }

    setCanMove(value) {
        this.canMoveCalls.push(value);
    }
}

class CoinSystem extends Component {
    constructor() {
        super();
        this.calls = [];
    }

    addCoins(value) {
        this.calls.push(value);
    }
}
CoinSystem.instance = null;

class CoinUI extends Component {
    constructor() {
        super();
        this.flights = [];
    }

    playDeliverFly(to, from) {
        this.flights.push({ to: new Vec3(to), from: new Vec3(from) });
    }
}
CoinUI.instance = null;

class EnemyMinion extends Component {}
class EnemyBoss extends Component {}
class EnemySpawner extends Component {}

const eventManager = { onEvent() {}, offEvent() {}, emitEvent() {} };
const gameManager = { phases: [], wins: [], setPhase(phase) { this.phases.push(phase); }, setGameOver(result) { this.wins.push(result); } };
const resourceLoads = [];
const gameConfig = {
    wallBuildCost: 10,
    towerBasicBuildCost: 25,
    towerAdvancedBuildCost: 40,
    barracksBuildCost: 30,
    heroShrineBuildCost: 50,
    expandAreaBuildCost: 60,
    cameraFollowOffsetX: 0,
    cameraFollowOffsetY: 0,
    cameraFollowOffsetZ: 10,
    cameraFollowSmooth: 100,
    ultimateZoomDistance: 400,
    ultimateZoomDuration: 1.5,
    ultimateGameOverDelay: 1,
    ultimateOnce: true,
};

function instantiate(prefab) {
    return prefab.factory();
}

const cc = {
    _decorator: { ccclass: () => (cls) => cls, property: () => () => undefined },
    Animation,
    BoxCollider2D,
    Collider2D,
    Color,
    Component,
    Contact2DType: { BEGIN_CONTACT: 'begin', END_CONTACT: 'end' },
    ERigidBody2DType: { Kinematic: 'kinematic' },
    EventKeyboard: class {},
    IPhysics2DContact: class {},
    Input: { EventType: { KEY_DOWN: 'key-down' } },
    KeyCode: { SPACE: 32 },
    Label: class {},
    Node,
    Prefab,
    resources: { load(...args) { resourceLoads.push(args); } },
    RigidBody2D,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec3,
    input: { on() {}, off() {} },
    instantiate,
};

const mocks = {
    cc,
    '../character/Player': { Player },
    '../core/EventManager': { EventManager: { instance: eventManager } },
    '../core/GameConfig': { GameConfig: gameConfig },
    '../core/GameEvents': { GameEvents: { COIN_CHANGED: 'coin', BUILD_COMPLETE: 'build', BOTH_ADVANCED_TOWERS_COMPLETE: 'advanced' } },
    '../game/CoinSystem': { CoinSystem },
    '../ui/CoinUI': { CoinUI },
    '../enemy/EnemyBoss': { EnemyBoss },
    '../enemy/EnemyMinion': { EnemyMinion },
    '../enemy/EnemySpawner': { EnemySpawner },
    './GameManager': { GameManager: { instance: gameManager } },
    './GamePhase': { GamePhase: { Ultimate: 'ultimate' } },
};

const loaded = new Map();
function load(relativePath) {
    const filename = path.resolve(root, relativePath);
    if (loaded.has(filename)) {
        return loaded.get(filename);
    }
    const source = fs.readFileSync(filename, 'utf8');
    const js = ts.transpileModule(source, {
        compilerOptions: {
            module: ts.ModuleKind.CommonJS,
            target: ts.ScriptTarget.ES2020,
            experimentalDecorators: true,
        },
        fileName: filename,
    }).outputText;
    const module = { exports: {} };
    const factory = vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { console, Math, Number, Set }, { filename });
    factory((request) => {
        if (request === './CameraFollow') {
            return { CameraFollow: load('assets/scripts/game/CameraFollow.ts').CameraFollow };
        }
        if (Object.hasOwn(mocks, request)) {
            return mocks[request];
        }
        throw new Error(`Unmocked import ${request} from ${filename}`);
    }, module, module.exports);
    loaded.set(filename, module.exports);
    return module.exports;
}

const { BuildPlot } = load('assets/scripts/building/BuildPlot.ts');
const { CameraFollow } = load('assets/scripts/game/CameraFollow.ts');
const { UltimateSystem } = load('assets/scripts/game/UltimateSystem.ts');

function attach(node, Type) {
    const component = new Type();
    component.node = node;
    node.components.push(component);
    return component;
}

function sceneWithHost() {
    const scene = new Node('Main');
    scene._setScene(scene);
    return { scene, host: scene.addChild(new Node('Host')) };
}

test('BuildPlot shows rounded nonnegative remaining cost through partial payment and completion', () => {
    const { scene } = sceneWithHost();
    const plotNode = scene.addChild(new Node('Plot'));
    const plot = attach(plotNode, BuildPlot);
    const label = { string: '' };
    const fill = new Sprite();
    const coins = new CoinSystem();
    const coinUi = new CoinUI();
    CoinSystem.instance = coins;
    CoinUI.instance = coinUi;
    plot.costLabel = label;
    plot.fillBar = fill;
    plot._fillSprite = fill;
    plot.fillSpeedPerSecond = 2.5;
    plot._pollPlayerInside = () => {};
    plot._playerInside = true;
    plot._coinGetter = () => 10;

    plot._refreshCostDisplay();
    equal(label.string, '10', 'initial cost must show the full remaining total');
    plot.update(1);
    equal(label.string, '8', '2.5 paid from 10 must display ceil(7.5)');
    equal(fill.fillRange, 0.25, 'partial payment keeps the existing fill ratio');
    equal(coins.calls[0], -2.5, 'partial payment preserves CoinSystem spend');
    equal(coinUi.flights.length, 1, 'partial payment preserves fly-coin feedback');
    plot.update(3);
    equal(label.string, '0', 'completion must show zero before completion handling');
    equal(plot.isComplete, true, 'completion behavior still marks the plot complete');
    equal(coins.calls[1], -7.5, 'final payment preserves the remaining spend amount');
});

test('BuildPlot cost refresh follows type changes and a new lifecycle', () => {
    const { scene } = sceneWithHost();
    const plot = attach(scene.addChild(new Node('Plot')), BuildPlot);
    const label = { string: '' };
    plot.costLabel = label;
    plot._paidAmount = 2.5;
    plot.setBuildType('towerBasic');
    equal(label.string, '23', 'type changes use the current type cost and accepted payment');

    const fresh = attach(scene.addChild(new Node('FreshPlot')), BuildPlot);
    const freshLabel = { string: '' };
    fresh.costLabel = freshLabel;
    fresh.setBuildType('towerAdvanced');
    equal(freshLabel.string, '40', 'a new plot lifecycle starts from its selected full cost');
});

test('CameraFollow completion runs after final zoom state and supports zero duration', () => {
    const camera = attach(new Node('Camera'), CameraFollow);
    camera.target = new Node('Target');
    const completed = [];
    camera.zoomOut(100, 1, () => completed.push({ extra: camera._zoomExtraZ, zooming: camera._zooming }));
    camera.lateUpdate(0.5);
    equal(completed.length, 0, 'nonzero zoom must not complete early');
    equal(camera._zoomExtraZ, 50, 'smoothstep midpoint is retained');
    camera.lateUpdate(0.5);
    equal(completed.length, 1, 'zoom completes once at the duration boundary');
    equal(completed[0].extra, 100, 'completion observes the final extra zoom value');
    equal(completed[0].zooming, false, 'completion observes zooming cleared');

    const instant = attach(new Node('InstantCamera'), CameraFollow);
    let instantState = null;
    instant.zoomOut(25, 0, () => { instantState = { extra: instant._zoomExtraZ, zooming: instant._zooming }; });
    equal(instantState.extra, 25, 'zero duration writes final zoom before synchronous completion');
    equal(instantState.zooming, false, 'zero duration completion observes no active zoom');
});

test('CameraFollow replaces and destroys pending completion callbacks', () => {
    const camera = attach(new Node('Camera'), CameraFollow);
    camera.target = new Node('Target');
    let oldCalls = 0;
    let newCalls = 0;
    camera.zoomOut(100, 1, () => { oldCalls += 1; });
    camera.zoomOut(20, 0, () => { newCalls += 1; });
    camera.lateUpdate(2);
    equal(oldCalls, 0, 'a newer zoom invalidates the prior completion callback');
    equal(newCalls, 1, 'the replacement completion runs once');

    camera.zoomOut(10, 1, () => { oldCalls += 1; });
    camera.onDestroy();
    camera.lateUpdate(2);
    equal(oldCalls, 0, 'destroying the camera invalidates the pending callback');
});

class DeferredCamera {
    constructor() {
        this.isValid = true;
        this.calls = [];
    }

    zoomOut(distance, duration, callback) {
        this.calls.push({ distance, duration, callback });
    }
}

function makePoint(scene, name) {
    return scene.addChild(new Node(name));
}

function playablePrefab(playLog, finishers) {
    return new Prefab(() => {
        const node = new Node('BigMove');
        const animation = attach(node, Animation);
        const play = animation.play.bind(animation);
        animation.play = (name) => {
            playLog.push(name);
            play(name);
        };
        const once = animation.once.bind(animation);
        animation.once = (event, callback) => {
            finishers.push(callback);
            once(event, callback);
        };
        return node;
    });
}

function makeFinale({ camera = new DeferredCamera(), points = [], prefab = null } = {}) {
    const { scene, host } = sceneWithHost();
    const ultimate = attach(host, UltimateSystem);
    const player = new Player();
    ultimate._unlocked = true;
    ultimate.player = player;
    ultimate.cameraFollow = camera;
    ultimate.bigMovePoints = points.map((name) => makePoint(scene, name));
    ultimate.bigMoveVfxPrefab = prefab;
    let clears = 0;
    ultimate.clearAllEnemies = () => { clears += 1; };
    return { scene, ultimate, player, camera, get clears() { return clears; } };
}

test('UltimateSystem waits for camera completion then starts every valid BigMove together', () => {
    const plays = [];
    const finishers = [];
    const world = makeFinale({ points: ['Left', 'Right'], prefab: playablePrefab(plays, finishers) });
    world.ultimate._runFinale();
    equal(world.camera.calls.length, 1, 'finale requests one camera pullback');
    equal(plays.length, 0, 'BigMove does not start before camera completion');
    equal(world.clears, 0, 'enemy clearing does not start before camera completion');
    world.camera.calls[0].callback();
    equal(plays.length, 2, 'all valid BigMove points start in the completion callback');
    equal(finishers.length, 2, 'all started effects retain their completion handlers');
    world.camera.calls[0].callback();
    equal(plays.length, 2, 'a repeated camera callback cannot create a second VFX wave');
    finishers.forEach((finish) => finish());
    equal(world.clears, 1, 'all effects settle into one enemy-clear operation');
    finishers.forEach((finish) => finish());
    equal(world.clears, 1, 'duplicate animation completion cannot settle twice');
});

test('UltimateSystem uses immediate no-camera fallback and delays empty-point fallback', () => {
    const noCamera = makeFinale({ camera: null });
    noCamera.ultimate._runFinale();
    equal(noCamera.clears, 1, 'missing camera starts the existing fallback immediately');

    const emptyPoints = makeFinale();
    emptyPoints.ultimate._runFinale();
    equal(emptyPoints.clears, 0, 'empty points still wait when a camera is valid');
    emptyPoints.camera.calls[0].callback();
    equal(emptyPoints.clears, 1, 'empty points settle after the camera completion');
});

test('UltimateSystem preserves resource and animation fallbacks after camera completion', () => {
    resourceLoads.length = 0;
    const resourceFailure = makeFinale({ points: ['Only'] });
    resourceFailure.ultimate._runFinale();
    resourceFailure.camera.calls[0].callback();
    equal(resourceLoads.length, 1, 'VFX loading begins only after camera completion');
    equal(resourceFailure.clears, 0, 'resource fallback cannot clear before its callback');
    resourceLoads[0][2](new Error('missing'), null);
    equal(resourceFailure.clears, 1, 'resource failure keeps the existing clear-and-victory fallback');

    const missingAnimation = makeFinale({ points: ['Only'], prefab: new Prefab(() => new Node('NoAnimation')) });
    missingAnimation.ultimate._runFinale();
    missingAnimation.camera.calls[0].callback();
    equal(missingAnimation.clears, 1, 'missing animation keeps the existing completion fallback');
});

test('UltimateSystem ignores camera callbacks after destruction or disablement', () => {
    const destroyed = makeFinale({ points: ['Only'], prefab: playablePrefab([], []) });
    destroyed.ultimate._runFinale();
    destroyed.ultimate.isValid = false;
    destroyed.camera.calls[0].callback();
    equal(destroyed.clears, 0, 'destroyed finale does not continue from a delayed callback');

    const disabled = makeFinale({ points: ['Only'], prefab: playablePrefab([], []) });
    disabled.ultimate._runFinale();
    disabled.ultimate.enabled = false;
    disabled.camera.calls[0].callback();
    equal(disabled.clears, 0, 'disabled finale does not continue from a delayed callback');
});

if (!process.exitCode) {
    console.log(`build cost / ultimate timing harness passed: ${assertions} assertions across ${scenarios} scenarios`);
}
