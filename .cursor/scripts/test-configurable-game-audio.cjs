const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
let assertions = 0;
let scenarios = 0;
function equal(actual, expected, message) { assertions += 1; assert.equal(actual, expected, message); }
function ok(value, message) { assertions += 1; assert.ok(value, message); }
function test(name, fn) {
    scenarios += 1;
    try { fn(); console.log(`ok - ${name}`); }
    catch (error) { console.error(`not ok - ${name}`); console.error(error); process.exitCode = 1; }
}

class Emitter {
    constructor() { this.listeners = new Map(); }
    on(event, callback, target) { const list = this.listeners.get(event) ?? []; list.push({ callback, target }); this.listeners.set(event, list); }
    off(event, callback, target) { this.listeners.set(event, (this.listeners.get(event) ?? []).filter((item) => item.callback !== callback || item.target !== target)); }
    emit(event, ...args) { for (const item of [...(this.listeners.get(event) ?? [])]) item.callback.apply(item.target, args); }
}
class Component {
    constructor() { this.enabled = true; this.scheduled = []; }
    scheduleOnce(callback, delay) { this.scheduled.push({ callback, delay }); }
    unscheduleAllCallbacks() { this.scheduled = []; }
}
class AudioClip {
    constructor(duration = 0.2) { this.duration = duration; }
    getDuration() { return this.duration; }
}
class AudioSource extends Component {
    constructor() { super(); this.clip = null; this.loop = false; this.volume = 1; this.playing = false; this.playCount = 0; this.stopCount = 0; this.pauseCount = 0; }
    play() { this.playing = true; this.playCount += 1; }
    stop() { this.playing = false; this.stopCount += 1; }
    pause() { this.playing = false; this.pauseCount += 1; }
}
class Node {
    constructor() { this.components = []; }
    addComponent(Type) { const component = new Type(); component.node = this; this.components.push(component); return component; }
}

const input = new Emitter();
const game = new Emitter();
const events = new Emitter();
events.onEvent = events.on.bind(events);
events.offEvent = events.off.bind(events);
events.emitEvent = events.emit.bind(events);
const config = {
    audioBgmVolume: 0.35,
    audioSfxVolume: 0.8,
    audioCueVolumeMultiplier: 1,
    audioSfxConcurrencyLimit: 8,
    audioBgmMinInterval: 0,
    audioAttackMinInterval: 0.1,
    audioDeathMinInterval: 0.1,
    audioCoinMinInterval: 0.1,
    audioBuildMinInterval: 0,
    audioHeroSpawnMinInterval: 0,
};
const cc = {
    _decorator: { ccclass: () => (cls) => cls, property: () => () => undefined },
    AudioClip,
    AudioSource,
    Component,
    Game: { EVENT_HIDE: 'hide', EVENT_SHOW: 'show' },
    game,
    Input: { EventType: { TOUCH_START: 'touch', MOUSE_DOWN: 'mouse', KEY_DOWN: 'key' } },
    input,
};
const mocks = {
    cc,
    './EventManager': { EventManager: { instance: events } },
    './GameConfig': { GameConfig: config },
    './GameEvents': { GameEvents: { PHASE_CHANGED: 'phase_changed' } },
    '../game/GamePhase': { GamePhase: { GameOver: 'game_over' } },
};
function load(relative) {
    const filename = path.join(root, relative);
    const source = fs.readFileSync(filename, 'utf8');
    const js = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true },
        fileName: filename,
    }).outputText;
    const module = { exports: {} };
    const factory = vm.runInNewContext(`(function(require,module,exports){${js}\n})`, { console, Date, Map, Set, Math, Number }, { filename });
    factory((request) => {
        if (Object.hasOwn(mocks, request)) return mocks[request];
        throw new Error(`Unmocked import ${request}`);
    }, module, module.exports);
    return module.exports;
}
function runScheduled(component) {
    const callbacks = component.scheduled.splice(0);
    for (const item of callbacks) item.callback();
}
function sourceFiles() {
    return {
        audio: fs.readFileSync(path.join(root, 'assets/scripts/core/AudioManager.ts'), 'utf8'),
        combat: fs.readFileSync(path.join(root, 'assets/scripts/game/CombatSystem.ts'), 'utf8'),
        hero: fs.readFileSync(path.join(root, 'assets/scripts/character/Hero.ts'), 'utf8'),
        soldier: fs.readFileSync(path.join(root, 'assets/scripts/character/Soldier.ts'), 'utf8'),
        coin: fs.readFileSync(path.join(root, 'assets/scripts/game/CoinSystem.ts'), 'utf8'),
        shrine: fs.readFileSync(path.join(root, 'assets/scripts/building/HeroShrine.ts'), 'utf8'),
        minion: fs.readFileSync(path.join(root, 'assets/scripts/enemy/EnemyMinion.ts'), 'utf8'),
        boss: fs.readFileSync(path.join(root, 'assets/scripts/enemy/EnemyBoss.ts'), 'utf8'),
        scene: fs.readFileSync(path.join(root, 'assets/scripts/game/SceneSetup.ts'), 'utf8'),
    };
}

const realNow = Date.now;
let now = 1000;
Date.now = () => now;
const { AudioManager } = load('assets/scripts/core/AudioManager.ts');

test('Inspector defaults expose all configured cues and audio limits', () => {
    const manager = new AudioManager();
    equal(manager.bgmVolume, 0.35, 'BGM default comes from GameConfig');
    equal(manager.sfxVolume, 0.8, 'SFX default comes from GameConfig');
    equal(manager.sfxConcurrencyLimit, 8, 'concurrency default comes from GameConfig');
    equal(manager.hero1AttackCue.clip, null, 'Hero 1 starts silent');
    equal(manager.playerAttackCue.minInterval, 0.1, 'attack cue is rate limited');
    equal(manager.enemyDeathCue.minInterval, 0.1, 'death cue is rate limited');
    equal(manager.coinCollectCue.minInterval, 0.1, 'coin cue is rate limited');
    equal(manager.buildCompleteCue.minInterval, 0, 'build cue is not rate limited');
    equal(manager.heroSpawnCue.minInterval, 0, 'spawn cue is not rate limited');
});

test('BGM starts after first input, does not duplicate, pauses hidden, and stops on GameOver', () => {
    const manager = new AudioManager();
    manager.node = new Node();
    manager.bgmCue.clip = new AudioClip(5);
    manager.onLoad();
    const bgm = manager._bgmSource;
    equal(bgm.playCount, 0, 'BGM remains silent before input');
    input.emit('touch');
    equal(bgm.playCount, 1, 'first input starts BGM');
    equal(bgm.loop, true, 'BGM source loops');
    equal(bgm.volume, 0.35, 'BGM uses configured volume');
    input.emit('mouse');
    equal(bgm.playCount, 1, 'later input cannot duplicate BGM');
    game.emit('hide');
    equal(bgm.pauseCount, 1, 'hide pauses BGM');
    game.emit('show');
    equal(bgm.playCount, 2, 'show resumes the existing BGM source');
    events.emit('phase_changed', 'game_over');
    ok(bgm.stopCount >= 1, 'GameOver stops BGM');
    manager.onDestroy();
});

test('SFX skips missing clips, enforces interval and cap, and drops active effects on hide', () => {
    const manager = new AudioManager();
    manager.node = new Node();
    manager.onLoad();
    manager.playerAttackCue.clip = new AudioClip(0.2);
    manager.sfxConcurrencyLimit = 1;
    manager.playSfx('hero1Attack');
    equal(manager._sfxSources.length, 0, 'empty Hero 1 clip is silent');
    manager.playSfx('playerAttack');
    equal(manager._sfxSources.length, 1, 'first SFX acquires a source');
    equal(manager._sfxSources[0].playCount, 1, 'first SFX plays');
    now += 50;
    manager.playSfx('playerAttack');
    equal(manager._sfxSources[0].playCount, 1, 'rate-limited SFX is skipped');
    manager.enemyDeathCue.clip = new AudioClip(0.2);
    now += 100;
    manager.playSfx('enemyDeath');
    equal(manager._sfxSources.length, 1, 'concurrency cap skips later SFX');
    game.emit('hide');
    equal(manager._activeSfx.size, 0, 'hide discards active short effects');
    manager.onDestroy();
});

test('Gameplay calls are placed only after success and finale paths remain silent', () => {
    const files = sourceFiles();
    ok(files.combat.includes("arrow.init(target, GameConfig.playerAttackDamage, GameConfig.arrowSpeed, reservation);\n            AudioManager.playSfx('playerAttack');"), 'player cue follows Arrow.init');
    ok(files.hero.includes("bolt.init(target, this.attackDamage, GameConfig.arrowSpeed);\n        AudioManager.playSfx"), 'hero cue follows projectile init');
    ok(files.soldier.includes("if (launchedProjectile) {\n                AudioManager.playSfx('towerVolley');"), 'tower volley cue is grouped after projectile launch');
    ok(files.coin.includes("this.addCoins(amount);\n            AudioManager.playSfx('coinCollect');"), 'coin cue follows collection callback, not spending');
    ok(files.shrine.includes("heroNode.active = true;") && files.shrine.includes("AudioManager.playSfx('heroSpawn');"), 'hero spawn cue follows activation');
    ok(files.scene.includes("GameEvents.BUILD_COMPLETE, this._onBuildComplete") && files.scene.includes("AudioManager.playSfx('buildComplete')"), 'build cue follows the completion event');
    for (const [name, source] of [['EnemyMinion', files.minion], ['EnemyBoss', files.boss]]) {
        const finalStart = source.indexOf('playFinalDeath(');
        const finalEnd = source.indexOf('takeDamage(', finalStart);
        const normalStart = source.indexOf('private _die(): void');
        ok(!source.slice(finalStart, finalEnd).includes("AudioManager.playSfx('enemyDeath')"), `${name} finale path remains silent`);
        ok(source.slice(normalStart).includes("AudioManager.playSfx('enemyDeath')"), `${name} normal death requests the cue`);
    }
});

Date.now = realNow;
if (!process.exitCode) console.log(`configurable game audio harness passed: ${assertions} assertions across ${scenarios} scenarios`);
