/**
 * zod-to-json-schema 的递归告警只提示一次，避免 tools/list 每次把日志刷满。
 * 用法: node .cursor/scripts/patch-zod-warn-once.mjs
 */
import fs from 'fs';
import path from 'path';

const targets = [
  'C:/Users/Admin/cocos-cli/node_modules/zod-to-json-schema/dist/cjs/parseDef.js',
  'C:/Users/Admin/cocos-cli/node_modules/zod-to-json-schema/dist/esm/parseDef.js',
];

const search =
  'console.warn(`Recursive reference detected at ${refs.currentPath.join("/")}! Defaulting to any`);';
const replace =
  'if (!globalThis.__zts_recursion_warned__) { globalThis.__zts_recursion_warned__ = true; console.warn(`Recursive reference detected at ${refs.currentPath.join("/")}! Defaulting to any`); }';

let ok = true;
for (const file of targets) {
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) {
    console.error(`missing: ${abs}`);
    ok = false;
    continue;
  }
  const s = fs.readFileSync(abs, 'utf8');
  const count = s.split(search).length - 1;
  if (count !== 1) {
    console.error(`unexpected match count ${count} (expect 1) in ${abs}`);
    ok = false;
    continue;
  }
  fs.copyFileSync(abs, abs + '.bak');
  fs.writeFileSync(abs, s.split(search).join(replace), 'utf8');
  console.log(`patched: ${abs}`);
}
process.exit(ok ? 0 : 1);
