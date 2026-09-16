const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const config = read('assets/scripts/core/GameConfig.ts');
const barracks = read('assets/scripts/building/Barracks.ts');
const shrine = read('assets/scripts/building/HeroShrine.ts');
const ai = read('assets/scripts/enemy/EnemyAI.ts');
const minion = read('assets/scripts/enemy/EnemyMinion.ts');
const ultimate = read('assets/scripts/game/UltimateSystem.ts');
const combat = read('assets/scripts/game/CombatSystem.ts');
const soldier = read('assets/scripts/character/Soldier.ts');

assert.match(config, /barracksSpawnInterval\s*=\s*3/, 'barracks interval 3');
assert.match(config, /barracksRefillPerWave\s*=\s*4/, 'barracks refill 4');
assert.match(config, /ultimateInterWaveDelay\s*=\s*0\.8/, 'inter-wave delay');

assert.match(barracks, /barracksRefillPerWave/, 'Barracks uses refill cap');
assert.match(barracks, /_initialWaveDone/, 'Barracks first vs later wave');

assert.match(shrine, /HitFlash\.flash/, 'HeroShrine flash');
assert.match(shrine, /HitShake\.shake/, 'HeroShrine shake');

assert.match(ai, /findNearestMeleeSoldier/, 'EnemyAI finds shield soldiers');
assert.match(ai, /soldier\.takeDamage/, 'EnemyAI damages soldiers');
assert.match(minion, /_isChaseTargetDead/, 'Minion accepts soldier chase validity');

assert.match(ultimate, /ultimateInterWaveDelay/, 'Ultimate waits inter-wave delay');
assert.match(ultimate, /scheduleOnce\(\(\) => this\._startSecondWaveAndZoom/, 'delay before wave 2');

assert.match(combat, /只比距离|最近的敌人/, 'CombatSystem nearest comment or logic');
assert.doesNotMatch(
  combat,
  /优先 Boss[\s\S]{0,80}bestBoss/,
  'no Boss-first target selection',
);
assert.match(combat, /kind: 'boss' \| 'minion'|kind: 'boss'/, 'boss and minion same candidate list');

assert.match(soldier, /if \(this\._deployment === 'barracks'\) \{\s*return this\._findPreferredTarget\(range\);/, 'barracks attacks rescan nearest enemy in melee range');
assert.match(soldier, /private _findNearestMeleeEnemy[\s\S]*getComponentsInChildren\(EnemyMinion\)[\s\S]*getComponentsInChildren\('EnemyBoss'\)/, 'barracks scans minions and Bosses together');
assert.doesNotMatch(soldier, /private _findPreferredTarget[\s\S]{0,220}_findNearestBoss/, 'barracks has no Boss-first target branch');
assert.match(soldier, /_resolveMeleeChaseTarget[\s\S]{0,500}_findPreferredTarget\(Number\.POSITIVE_INFINITY\)/, 'locked melee target uses the unified nearest scan');
assert.match(soldier, /_resolveAttackTarget\(\) \?\? this\._resolveMeleeChaseTarget\(dt\)/, 'an in-range minion interrupts a farther locked chase target');

console.log('ok - test-barracks-minion-ultimate-timing');
