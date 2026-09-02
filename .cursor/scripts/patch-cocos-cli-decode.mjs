/**
 * 给 cocos-cli 的 ComponentDump.decode 加 null 容错：
 * dump.value 为 null/空引用时直接写 null，不再读 .uuid 抛 TypeError。
 * 同时备份原文件为 <file>.bak。
 * 用法: node .cursor/scripts/patch-cocos-cli-decode.mjs
 */
import fs from 'fs';
import path from 'path';

const targets = [
  {
    file: 'C:/Users/Admin/cocos-cli/src/core/scene/scene-process/service/dump/types/component-dump.ts',
    search:
      'data[info.key] = getDumpComponentAccess().query(dump.value.uuid);',
    replace:
      'if (!dump.value) {\n            data[info.key] = null;\n            return;\n        }\n        data[info.key] = getDumpComponentAccess().query(dump.value.uuid);',
  },
  {
    file: 'C:/Users/Admin/cocos-cli/dist/core/scene/scene-process/service/dump/types/component-dump.js',
    search:
      'data[info.key] = (0, service_access_1.getDumpComponentAccess)().query(dump.value.uuid);',
    replace:
      'if (!dump.value) {\n            data[info.key] = null;\n            return;\n        }\n        data[info.key] = (0, service_access_1.getDumpComponentAccess)().query(dump.value.uuid);',
  },
];

let ok = true;
for (const t of targets) {
  const abs = path.resolve(t.file);
  if (!fs.existsSync(abs)) {
    console.error(`missing: ${abs}`);
    ok = false;
    continue;
  }
  const s = fs.readFileSync(abs, 'utf8');
  const count = s.split(t.search).length - 1;
  if (count !== 1) {
    console.error(`unexpected match count ${count} (expect 1) in ${abs}`);
    ok = false;
    continue;
  }
  fs.copyFileSync(abs, abs + '.bak');
  fs.writeFileSync(abs, s.split(t.search).join(t.replace), 'utf8');
  console.log(`patched: ${abs}`);
}
process.exit(ok ? 0 : 1);
