'use strict';
// Read-only acceptance checks against the captured working-tree baseline.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const arg = (name) => args[args.indexOf(name) + 1];
const baseline = arg('--baseline');
assert(baseline && args.includes('--baseline'), '--baseline is required');
const manifest = JSON.parse(fs.readFileSync(path.join(baseline, 'manifest.json')));
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const targets = new Set(manifest.targets.map((item) => item.path));
assert.equal(targets.size, 36);
let changed = 0;
for (const item of manifest.targets) {
    const current = JSON.parse(fs.readFileSync(item.path));
    const expected = structuredClone(item.meta);
    for (const [key, sub] of Object.entries(expected.subMetas)) {
        if (sub.importer !== 'sprite-frame') continue;
        assert.equal(current.subMetas[key].userData.packable, true, `${item.path}: packable`);
        sub.userData.packable = true;
    }
    assert.deepEqual(current, expected, `${item.path}: unexpected metadata change`);
    assert.equal(hash(item.path.slice(0, -5)), item.pngHash, `${item.path}: PNG changed`);
    if (hash(item.path) !== item.hash) changed++;
}
for (const [file, expected] of Object.entries(manifest.hashes)) {
    if (!targets.has(file)) assert.equal(hash(file), expected, `Protected file changed: ${file}`);
}
console.log(`AC-SCOPE PASS: ${targets.size} target metas, ${changed} changed, protected files unchanged`);
// Build association validation is added after inspecting actual native build output.
assert(args.includes('--scope-only'), 'AC-BUILD/AC-REF verification is not implemented yet; cannot claim full AC');
