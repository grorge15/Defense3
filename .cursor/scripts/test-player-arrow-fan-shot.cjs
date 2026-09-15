const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const config = read('assets/scripts/core/GameConfig.ts');
const arrow = read('assets/scripts/projectile/Arrow.ts');
const combat = read('assets/scripts/game/CombatSystem.ts');

assert.match(config, /playerArrowFanCount\s*=\s*3/, 'fan count 3');
assert.match(config, /playerArrowFanTotalAngleDeg\s*=\s*45/, 'fan total 45deg');
assert.match(arrow, /initWithDirection\s*\(/, 'Arrow initWithDirection');
assert.match(combat, /_spawnArrowFan\s*\(/, 'CombatSystem fan spawn');
assert.match(combat, /playerArrowFanCount/, 'CombatSystem reads fan count');
assert.match(combat, /_rotateDirZ/, 'CombatSystem rotates fan dirs');
assert.match(combat, /centerIndex/, 'center arrow reservation');

console.log('ok - test-player-arrow-fan-shot');
