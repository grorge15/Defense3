const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '../..');
let now = 0;
let phase = 'defense';

class Events {
    constructor() { this.listeners = new Map(); }
    on(name, fn, ctx) {
        const entries = this.listeners.get(name) || [];
        entries.push({ fn, ctx });
        this.listeners.set(name, entries);
    }
    off(name, fn, ctx) {
        if (!fn) { this.listeners.delete(name); return; }
        this.listeners.set(name, (this.listeners.get(name) || []).filter(e => e.fn !== fn || (ctx && e.ctx !== ctx)));
    }
    emit(name, ...args) { for (const e of [...(this.listeners.get(name) || [])]) e.fn.apply(e.ctx, args); }
    onEvent(...args) { this.on(...args); }
    offEvent(...args) { this.off(...args); }
    emitEvent(...args) { this.emit(...args); }
    count() { return [...this.listeners.values()].reduce((n, a) => n + a.length, 0); }
}
class Vec3 {
    constructor(x = 0, y = 0, z = 0) { this.set(x, y, z); }
    set(x, y, z = 0) { if (typeof x === 'object') ({ x, y, z = 0 } = x); Object.assign(this, { x, y, z }); return this; }
    clone() { return new this.constructor(this.x, this.y, this.z); }
}
class Vec2 extends Vec3 {}
class Color { constructor(...args) { this.set(...args); } set(r = 0, g = 0, b = 0, a = 255) { Object.assign(this, { r, g, b, a }); } }
class Component {
    constructor() { this.enabled = true; this.isValid = true; }
    getComponent(type) { return this.node.getComponent(type); }
    addComponent(type) { return this.node.addComponent(type); }
}
class Node extends Events {
    static EventType = { TOUCH_END: 'touch-end' };
    constructor(name = '') {
        super();
        this.name = name;
        this.children = [];
        this.components = [];
        this.position = new Vec3();
        this.scale = new Vec3(1, 1, 1);
        this._active = true;
        this.isValid = true;
    }
    get active() { return this._active; }
    set active(value) {
        if (value === this._active) return;
        this._active = value;
        for (const component of [...this.components]) {
            if (component.enabled) component[value ? 'onEnable' : 'onDisable']?.();
        }
    }
    get activeInHierarchy() { return this.active && (!this.parent || this.parent.activeInHierarchy); }
    get worldPosition() { return this.position; }
    addChild(node) { node.parent = this; this.children.push(node); return node; }
    getChildByName(name) { return this.children.find(child => child.name === name) || null; }
    getComponent(type) { return this.components.find(component => component instanceof type) || null; }
    addComponent(type) { const component = new type(); component.node = this; this.components.push(component); return component; }
    setPosition(...args) { this.position.set(...args); }
    setScale(...args) { this.scale.set(...args); }
}
class Sprite extends Component {}
class UIOpacity extends Component { constructor() { super(); this.opacity = 255; } }
class UITransform extends Component {
    constructor() { super(); this.contentSize = { width: 1280, height: 720 }; }
    setContentSize(width, height) { this.contentSize = { width, height }; }
}
class Size { constructor(width, height) { Object.assign(this, { width, height }); } }
class BoxCollider2D extends Component {
    constructor() { super(); this.size = new Size(100, 76); this.offset = new Vec2(3, 4); }
    apply() { this.applied = (this.applied || 0) + 1; }
}
class RigidBody2D extends Component {}
class Animation extends Component {}
class BlockInputEvents extends Component {}
const director = new Events();
director.paused = false;
director.pause = () => { director.paused = true; };
director.resume = () => { director.paused = false; };
director.isPaused = () => director.paused;
const Director = {
    EVENT_BEFORE_DRAW: 'before-draw',
    EVENT_BEFORE_SCENE_LAUNCH: 'before-scene-launch',
};
Object.assign(director, Director);
const events = new Events();
const cc = {
    _decorator: { ccclass: () => cls => cls, property: () => () => undefined },
    Component, Node, Sprite, SpriteFrame: class {}, UIOpacity, UITransform,
    Vec2, Vec3, Color, Size, BoxCollider2D, RigidBody2D, Animation, BlockInputEvents,
    ERigidBody2DType: { Static: 0, Dynamic: 2 },
    director, Director, game: { get totalTime() { return now; } },
    isValid: value => !!value?.isValid,
    tween: () => { throw new Error('Hero selection must not enqueue a globally paused tween'); },
};
const mocks = {
    cc,
    '../building/HeroShrine': { HeroShrine: class {} },
    '../character/Player': { Player: class {} },
    '../core/AirWallAabb': { AirWallAabb: {} },
    '../core/AnimUtil': { playAnim() {} },
    '../core/EventManager': { EventManager: { instance: events } },
    '../core/TweenUtil': { TweenUtil: {} },
    '../ui/HpBarUI': { HpBarUI: class {} },
    '../game/GameManager': { GameManager: { instance: { getPhase: () => phase } } },
};
class ClockDate extends Date { static now() { return now; } }
const cache = new Map();
function load(relative) {
    const filename = path.resolve(root, relative);
    if (cache.has(filename)) return cache.get(filename);
    const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true },
    }).outputText;
    const module = { exports: {} };
    const factory = vm.runInNewContext(`(function(require,module,exports){${js}\n})`, {
        console, performance: { now: () => now }, Date: ClockDate,
    }, { filename });
    factory(request => {
        if (Object.hasOwn(mocks, request)) return mocks[request];
        if (request.startsWith('.')) return load(path.resolve(path.dirname(filename), `${request}.ts`));
        throw new Error(`Unmocked import ${request}`);
    }, module, module.exports);
    cache.set(filename, module.exports);
    return module.exports;
}
const { GameConfig } = load('assets/scripts/core/GameConfig.ts');
const { GamePhase } = load('assets/scripts/game/GamePhase.ts');
const { Log } = load('assets/scripts/item/Log.ts');
const { HeroSelectUI } = load('assets/scripts/ui/HeroSelectUI.ts');
function near(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} != ${expected}`); }
function test(name, fn) {
    try { fn(); console.log(`ok - ${name}`); }
    catch (error) { console.error(`not ok - ${name}`); console.error(error); process.exitCode = 1; }
}
function frames(seconds) {
    for (let i = 0; i < Math.ceil(seconds * 60); i++) {
        now += 1000 / 60;
        director.emit(Director.EVENT_BEFORE_DRAW);
    }
}
function panel() {
    now = 0;
    phase = GamePhase.DefensePhase;
    director.listeners.clear();
    events.listeners.clear();
    director.paused = false;
    const node = new Node('HeroSelect');
    node.active = false;
    node.addComponent(UITransform);
    node.addChild(new Node('Mask')).addComponent(Sprite);
    for (let i = 0; i < 2; i++) {
        const card = node.addChild(new Node(`Card${i}`));
        card.addComponent(Sprite);
        card.addChild(new Node(`HeroSlot${i}`)).addComponent(Sprite);
    }
    node.addChild(new Node('Finger'));
    const ui = node.addComponent(HeroSelectUI);
    ui.ensureReady();
    const picks = [];
    const shrine = { isValid: true, onHeroSelected(index) { picks.push({ index, paused: director.isPaused() }); } };
    return { ui, node, shrine, picks };
}

test('log initializes and restarts at length 3 with authored scale preserved', () => {
    const node = new Node('Log');
    const visual = node.addChild(new Node('Visual'));
    visual.setScale(2, 3, 4);
    const collider = node.addComponent(BoxCollider2D);
    const log = node.addComponent(Log);
    log.onLoad();
    assert.equal(log.getCurrentLength(), 3);
    near(visual.scale.x, 2);
    near(collider.size.width, 100);
    log.extend();
    near(visual.scale.x, 2.4);
    near(collider.size.width, 120);
    for (let i = 0; i < 20; i++) log.shrink();
    assert.equal(log.getCurrentLength(), 1);
    near(visual.scale.x, 1.2);
    near(collider.size.width, 60);
    for (let i = 0; i < 20; i++) log.extend();
    assert.equal(log.getCurrentLength(), 10);
    near(visual.scale.x, 4.8);
    near(collider.size.width, 240);
    log.beginParkour();
    assert.equal(log.getCurrentLength(), 3);
    near(visual.scale.x, 2);
    assert.equal(visual.scale.y, 3);
    assert.equal(visual.scale.z, 4);
    log._phase = 'fixed';
    log._refreshLengthVisual();
    assert.equal(collider.size.width, GameConfig.logFixedColliderWidth);
    assert.equal(collider.size.height, GameConfig.logFixedColliderHeight);
    assert.equal(collider.offset.x, GameConfig.logFixedColliderOffsetX);
});

test('paused modal animates, accepts one click, and releases pause only after closing', () => {
    const { ui, node, shrine, picks } = panel();
    ui._onSelectRequested(shrine);
    assert.equal(director.isPaused(), true);
    assert.equal(node.active, true);
    node.children[1].emit(Node.EventType.TOUCH_END, {});
    assert.equal(picks.length, 0, 'no click before fade-in completes');
    frames(0.4);
    assert.equal(ui._canClick, true);
    near(node.getComponent(UIOpacity).opacity, 255);
    const initialY = node.children[1].position.y;
    frames(0.3);
    assert.notEqual(node.children[1].position.y, initialY, 'card bob continues while paused');
    node.children[1].emit(Node.EventType.TOUCH_END, {});
    node.children[1].emit(Node.EventType.TOUCH_END, {});
    assert.equal(picks.length, 1);
    assert.equal(picks[0].paused, true, 'hero is selected while world remains paused');
    assert.equal(director.isPaused(), true);
    frames(0.4);
    assert.equal(node.active, false);
    assert.equal(director.isPaused(), false);
    assert.equal(director.count(), 0);
    ui.onDestroy();
});

test('external hide and destroy release modal-owned pause without stale frame listeners', () => {
    const { ui, node, shrine } = panel();
    ui._onSelectRequested(shrine);
    node.active = false;
    assert.equal(director.isPaused(), false);
    assert.equal(director.count(), 0);
    frames(1);
    assert.equal(ui._canClick, false);
    ui._onSelectRequested(shrine);
    assert.equal(director.isPaused(), true);
    frames(0.4);
    assert.equal(ui._canClick, true);
    ui.onDestroy();
    assert.equal(director.isPaused(), false);
    assert.equal(director.count(), 0);
    assert.equal(events.count(), 0);
});

test('pre-existing pause survives selecting and closing', () => {
    const { ui, node, shrine } = panel();
    director.pause();
    ui._onSelectRequested(shrine);
    frames(0.4);
    node.children[2].emit(Node.EventType.TOUCH_END, {});
    frames(0.4);
    assert.equal(node.active, false);
    assert.equal(director.isPaused(), true);
    assert.equal(director.count(), 0);
    ui.onDestroy();
});

test('game over during selection is never resumed by modal cleanup', () => {
    const { ui, node, shrine } = panel();
    ui._onSelectRequested(shrine);
    phase = GamePhase.GameOver;
    director.pause();
    node.active = false;
    assert.equal(director.isPaused(), true);
    ui.onDestroy();
    assert.equal(director.isPaused(), true);
    assert.equal(director.count(), 0);
});

test('last remaining hero auto-selects without pausing or opening modal', () => {
    const { ui, node, shrine, picks } = panel();
    ui._remaining = [1];
    ui._onSelectRequested(shrine);
    assert.equal(picks.length, 1);
    assert.equal(picks[0].index, 1);
    assert.equal(node.active, false);
    assert.equal(director.isPaused(), false);
    assert.equal(director.count(), 0);
    ui.onDestroy();
});

test('scene switch closes modal and cleans owned pause before launching next scene', () => {
    const { ui, node, shrine } = panel();
    ui._onSelectRequested(shrine);
    frames(0.1);
    director.emit(Director.EVENT_BEFORE_SCENE_LAUNCH);
    assert.equal(node.active, false);
    assert.equal(director.isPaused(), false);
    assert.equal(director.count(), 0);
    frames(1);
    assert.equal(ui._canClick, false);
    ui.onDestroy();
});

test('game over during fade-in closes automatically without unlocking the world', () => {
    const { ui, node, shrine, picks } = panel();
    ui._onSelectRequested(shrine);
    phase = GamePhase.GameOver;
    frames(0.4);
    assert.equal(node.active, false);
    assert.equal(director.isPaused(), true);
    assert.equal(director.count(), 0);
    assert.equal(picks.length, 0);
    ui.onDestroy();
});

test('synchronous shrine callback may hide the modal without resurrecting a closing animation', () => {
    const { ui, node, shrine } = panel();
    shrine.onHeroSelected = () => { node.active = false; };
    ui._onSelectRequested(shrine);
    frames(0.4);
    node.children[1].emit(Node.EventType.TOUCH_END, {});
    assert.equal(director.isPaused(), false);
    assert.equal(director.count(), 0);
    frames(0.4);
    assert.equal(node.active, false);
    assert.equal(ui._canClick, false);
    ui.onDestroy();
});
