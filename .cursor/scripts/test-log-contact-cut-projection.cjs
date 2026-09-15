const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const logSrc = fs.readFileSync(path.join(root, 'assets/scripts/item/Log.ts'), 'utf8');
const sawSrc = fs.readFileSync(path.join(root, 'assets/scripts/trap/SawTrap.ts'), 'utf8');
const configSrc = fs.readFileSync(path.join(root, 'assets/scripts/core/GameConfig.ts'), 'utf8');
const zoneSrc = fs.readFileSync(path.join(root, 'assets/scripts/game/ParkourLineZone.ts'), 'utf8');

assert.match(logSrc, /cutAtLocalX\(/, 'Log must expose cutAtLocalX');
assert.match(logSrc, /import \{ HitFlash \} from '\.\.\/core\/HitFlash';/, 'Log must reuse the shared hit-flash helper');
assert.match(logSrc, /meetsFixedWidthRequirement/, 'Log must expose world-width lock gate');
assert.match(logSrc, /logShadowWidthSlack|木杆投影/, 'Log must sync shadow node');
assert.match(logSrc, /_syncShadowContentWidth/, 'Log must refresh shadow contentSize from log width');
assert.match(logSrc, /setContentSize\(shadowWidth/, 'Shadow contentSize.width must track log content width − slack');
assert.doesNotMatch(logSrc, /_baseShadowScale|_syncShadowToVisualLengthScale/, 'Shadow must not use scale for length');
assert.match(sawSrc, /cutAtLocalX\(/, 'SawTrap must call cutAtLocalX');
assert.match(sawSrc, /getWorldManifold|_fillCutWorld/, 'SawTrap must use contact or saw center');
assert.match(sawSrc, /_resolveKeepSide/, 'SawTrap must keep player-side segment');
assert.doesNotMatch(sawSrc, /cutFromSide\(/, 'SawTrap must not use discrete cutFromSide');
assert.match(configSrc, /logFixedMinWidthFactor/, 'GameConfig must define fixed min width factor');
const shadowSlackMatch = configSrc.match(/logShadowWidthSlack\s*=\s*([\d.]+)/);
assert.ok(shadowSlackMatch, 'GameConfig must configure shadow slack');
const shadowSlack = Number(shadowSlackMatch[1]);
assert.match(zoneSrc, /meetsFixedWidthRequirement/, 'ParkourLineZone must use world-width gate');
assert.doesNotMatch(zoneSrc, /blueLineMinLogLength/, 'ParkourLineZone must not gate on logical length');

const cutMethodStart = logSrc.indexOf('    cutAtLocalX(cutX: number, keep: LogCutSide): boolean {');
const cutMethodEnd = logSrc.indexOf('    /** @deprecated Prefer cutAtLocalX', cutMethodStart);
assert.ok(cutMethodStart >= 0 && cutMethodEnd > cutMethodStart, 'Log must retain a bounded cutAtLocalX implementation');
const cutMethod = logSrc.slice(cutMethodStart, cutMethodEnd);
const flashCalls = cutMethod.match(/HitFlash\.flash\(this\.visualNode\);/g) ?? [];
assert.strictEqual(flashCalls.length, 1, 'An accepted cut must trigger exactly one Visual hit flash');
assert.ok(
    cutMethod.indexOf('this._refreshLengthVisual();') < cutMethod.indexOf('HitFlash.flash(this.visualNode);')
        && cutMethod.indexOf('HitFlash.flash(this.visualNode);') < cutMethod.lastIndexOf('return true;'),
    'The Visual hit flash must run only after accepted cut geometry refreshes',
);
assert.match(cutMethod, /if \(!this\.canBeCutBySaw\(\)\) \{\s*return false;/, 'Rejected cut states must exit before the flash');
assert.match(cutMethod, /if \(width <= minW \+ 0\.01\) \{\s*return false;/, 'Minimum-length cuts must exit before the flash');

// Pure geometry helpers mirroring Log edge math
function cutAtLocalX(left, right, cutX, keep, minW) {
    const width = right - left;
    if (width <= minW + 0.01) return null;
    const clamped = Math.min(right, Math.max(left, cutX));
    if (keep === 'left') {
        const nextRight = Math.max(left + minW, Math.min(right, clamped));
        if (nextRight >= right - 0.01) return null;
        return { left, right: nextRight };
    }
    const nextLeft = Math.min(right - minW, Math.max(left, clamped));
    if (nextLeft <= left + 0.01) return null;
    return { left: nextLeft, right };
}

const base = 100;
const minW = base * (0.4 + 1 * 0.15);
let left = -85;
let right = 85;
const mid = cutAtLocalX(left, right, 10, 'left', minW);
assert.ok(mid);
assert.strictEqual(mid.left, left);
assert.ok(mid.right <= 10 + 1e-6);
assert.ok(mid.right - mid.left >= minW - 1e-6);

const visualScale = (mid.right - mid.left) / base;
const logContentWidth = 200 * visualScale;
const shadow = Math.max(0.01, logContentWidth - shadowSlack);
assert.ok(Math.abs(shadow - (logContentWidth - shadowSlack)) < 1e-6);
assert.ok(shadow <= logContentWidth, 'Shadow width must not exceed the log Visual width');

const factor = 0.4 + 6 * 0.15;
assert.ok(Math.abs(factor - 1.3) < 1e-9);
assert.ok(base * factor > mid.right - mid.left, 'mid cut should be below fixed gate for this fixture');

console.log('ok - test-log-contact-cut-projection');
