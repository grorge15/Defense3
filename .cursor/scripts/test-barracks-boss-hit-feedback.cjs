const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const build = read('assets/scripts/building/BuildSystem.ts');
const hero = read('assets/scripts/character/Hero.ts');
const soldier = read('assets/scripts/character/Soldier.ts');
const log = read('assets/scripts/item/Log.ts');
const boss = read('assets/scripts/enemy/EnemyBoss.ts');
const minion = read('assets/scripts/enemy/EnemyMinion.ts');
const barracks = read('assets/scripts/building/Barracks.ts');
const player = read('assets/scripts/character/Player.ts');
const config = read('assets/scripts/core/GameConfig.ts');
const hitShake = read('assets/scripts/core/HitShake.ts');

assert.match(build, /_trySpawnBossAfterBarracks/, 'Boss spawn after barracks');
assert.match(build, /buildType === 'barracks'[\s\S]*_trySpawnBossAfterBarracks/, 'barracks branch calls spawn');
assert.doesNotMatch(build, /_trySpawnBossAfterBasicTowers/, 'old tower-boss spawn helper removed');
const basicFn = build.match(/private _onBasicTowerBuilt[\s\S]*?\n    \/\*\* 首座兵营/);
assert.ok(basicFn, 'locate _onBasicTowerBuilt');
assert.doesNotMatch(basicFn[0], /_trySpawnBoss/, '_onBasicTowerBuilt must not spawn boss');

assert.match(hero, /Animation\.EventType\.FINISHED/, 'Hero waits for die FINISHED');
assert.match(hero, /this\.node\.active = false/, 'Hero hides node');

assert.match(soldier, /HitFlash\.flash/, 'Soldier hit flash');
assert.match(log, /takeDamage[\s\S]*HitFlash\.flash/, 'Log takeDamage hit flash');
assert.match(boss, /HitFlash\.flash/, 'Boss hit flash');
assert.match(minion, /HitFlash\.flash/, 'Minion hit flash');

assert.match(config, /soldierRangedTargetCount\s*=\s*1/, 'archer single shot');
assert.match(config, /playerParkourChargeDecelDuration\s*=\s*0\.5/, 'yellow decel duration');

assert.match(barracks, /HitFlash\.flash/, 'Barracks flash');
assert.match(barracks, /HitShake\.shake/, 'Barracks shake');
assert.match(hitShake, /class HitShake/, 'HitShake helper exists');

assert.match(player, /startParkourChargeDecel/, 'Player charge decel API');
assert.match(player, /_chargeDecelActive/, 'Player decel state');
assert.match(log, /startParkourChargeDecel/, 'Log yellow starts decel');
assert.match(log, /tryLockAtFinish[\s\S]*HitFlash\.flash/, 'Log lock flashes');

console.log('ok - test-barracks-boss-hit-feedback');
