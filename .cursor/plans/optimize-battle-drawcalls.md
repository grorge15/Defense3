---
slug: optimize-battle-drawcalls
版本: 1
状态: draft
创建: 2026-09-16
---

# 普通小怪静态图集合批与构建验证

## 业务目标

把普通小怪33张序列帧、角色阴影、小怪血条底与填充加入 Cocos 自动图集，在构建产物中减少纹理切换机会，保持现有动画、资源路径和遮挡关系。先留存同一工作区的构建基线，再验证图集产物与资源兼容性；有运行能力时测量 Draw Call 和帧耗时，禁止无数据承诺降幅。

本次无玩家行为语义变化，不创建 OpenSpec change。对应 AI_TASK_LIST §6.1 的素材管线性能改进，不重建已完成的角色/场景任务。本会话用户已授权执行优化，主会话可继续交给一个 build-agent。

## 风险等级

中：`resources` 中自动图集只在构建时替换纹理，编辑器预览不能证明合图收益；血条原图较大，合图尺寸和内存须实测。

## 已核实的事实与执行入口

- 主会话已确认 `http://127.0.0.1:7456/` 当前预览HTTP200；9527无服务。预览可辅助调查，静态图集仍须新构建验证。
- Cocos Creator 版本 3.8.8；安装程序为 `C:/ProgramData/cocos/editors/Creator/3.8.8/CocosCreator.exe`。
- 当前工具目录无直接 Cocos MCP，但 `C:/Users/Admin/cocos-cli/dist/cli.js` 及源码存在；主会话已成功执行该入口 `--help`。本地 Node 可用。不要安装/替换 CLI。
- CLI 支持 `build -j <project> -p web-desktop -c <config>`、`start-mcp-server -j <project> -p <port>`；参数来源为本地 `src/commands/build.ts`、`mcp-server.ts`。启动 MCP 后用 SDK 工具列表获取实际参数，先验证 `assets-query-path` 绑定 Defense3。HTTP 端点以本地服务源码/启动输出为准，不猜端点。
- CLI `src/core/assets/asset-handler/assets/auto-atlas.ts` 定义 `.pac` 导入器和配置；`src/core/builder/worker/builder/asset-handler/texture-packer/pac-info.ts` 按 `.pac` 父目录递归收集 SpriteFrame，显式跳过 `packable=false`，并排除有子图集的子树。
- `assets/resources/sprite/frames/角色/` 当前 231 张 PNG，trim 面积合计 2,844,020 像素；仅佣兵2待机的6帧已 packable=true。全素材共341张PNG，335张关闭 packable。
- 角色阴影 trim 92×61；血条原素材分别为1468×186、1788×186、104×11、1847×252。加上全部角色总有效面积约3.92M像素（仅为历史调查，本轮只纳入小怪），2048方形可能接近容量边界，必须以实际打包结果决定页数，不能以面积证明装得下。
- 已存在大量 dirty 脚本、prefab、Main.scene、动画、bugs.md、settings；它们是本次基线，禁止恢复到 HEAD。已有 `build/web-desktop` / `web-mobile` 等输出也不覆盖。

## 禁做项

- 用户最新范围：主要解决普通小怪drawcall；禁止扩展玩家/英雄/士兵/Boss图集优化。小怪血条prefab已核实使用血条底与血条-半血，其他血条仅只读。
- 不改玩法代码、怪物数量、特效密度、SortingOrder2D、相机、渲染层/材质、血条显隐和父子结构；不做血条重分层。
- 不新建/改动任何 prefab、scene、动画 clip；不移动或重命名 PNG/目录，不缩放/重绘血条，不改现有 UUID、SpriteFrame 裁剪、pivot、边框、采样器。
- 不全局开启 packable，不开启/调整运行时动态图集配置，不把本次与动态合批性能混为一谈。
- 不手写 `.meta` UUID；新图集 `.meta` 必须由导入器生成。不得用修改序列化引用解决不兼容。
- 不改项目设置/现有构建配置，不覆盖旧 build 输出，不删除缓存来绕过不明构建故障；不提交构建/缓存产物为源码。
- 不 reset/restore 用户 dirty 文件、不清理无关 untracked 文件、不杀死非本任务进程、不安装依赖或改外部CLI。
- 无构建产物证据不得声称优化已生效；无运行时对比不得声称 Draw Call/FPS 改善。

## 变更文件清单

【可写】仅以下已有资产的 SpriteFrame `userData.packable` 字段（false→true；已true不写）：

- `assets/resources/sprite/frames/角色/骷髅兵/**/*.png.meta` — 普通小怪现有33张帧，执行前固化实际路径清单；不允许顺带改 image/texture/其他 SpriteFrame 字段。
- `assets/resources/sprite/角色通用投影1.png.meta`
- `assets/resources/sprite/UI/血条底.png.meta`
- `assets/resources/sprite/UI/血条-半血.png.meta`
- 本计划 — 只更新状态、todo、AC证据与必要续跑记录。

【可新建】

- `assets/resources/sprite/battle-common.pac` 及其导入器生成的 `.meta` — 一处父目录图集，无子图集；不移动素材。
- `.cursor/scripts/verify-battle-atlas.cjs` — 只读验证命令：基线/候选清单、UUID与字段保护、构建打包关联；不得生成 prefab/scene。
- `.cursor/plans/reports/optimize-battle-drawcalls-report.md`
- `.cursor/plans/reports/optimize-battle-drawcalls-evidence/**` — baseline、候选清单、配置、日志、可复现验证说明、采样、截图；大体积构建放下面的忽略目录。
- `build/optimize-battle-drawcalls-baseline/**` 和 `build/optimize-battle-drawcalls-candidate/**` — 各自独立的新输出，实际平台子目录记录到报告。若已存在则续用自己的已验证产物或采用任务目录下新 revision 子目录，不覆盖别人文件。

【仅只读参考】

- `assets/resources/animations/**`、`assets/resources/prefabs/**`、`assets/scenes/Main.scene`、所有 PNG 原图、其他 `.meta`。
- `assets/scripts/**`（特别是 HpBarUI、SortingOrder2D、资源动态加载调用）；`package.json`、`settings/**`、`bugs.md`、项目规则、AI_TASK_LIST、现有报告。
- 本地 cocos-cli 源码、Creator 3.8.8 安装目录、已有 build 输出，仅调查API和构建格式。

## To-dos

- [x] DC.a：读取本计划/已有报告，固化当前 dirty 状态、允许修改的36个meta路径、文件哈希/完整meta基线、PNG哈希，以及 scene/prefab/anim/scripts/settings 的任务前哈希；后续只续跑未完成步骤。
- [ ] DC.b：确认本地 CLI 与 Defense3 导入/构建能力；建立独立 baseline 配置与构建产物，保存命令、版本、出口路径、耗时、退出码和日志。确认原始帧引用与 resources 索引可解析。尝试获得运行时基线；不可用须具体记录原因。
- [ ] DC.c：通过原生 auto-atlas 导入器创建一个 battle-common.pac；精准更新目标meta的packable，完成串行导入。验证UUID和其他meta字段无改动。
- [ ] DC.d：构建独立 candidate 输出；核验有效图集页面、全部目标SpriteFrame依赖、resources路径、动画/预制体原UUID引用兼容。生成只读验证命令并运行。
- [ ] DC.e：在可运行的同配置基线/候选构建中对比固定场景，检查贴图/动画/血条/阴影和Draw Call；没有运行能力时保留明确未验证项，不编造采样。
- [ ] DC.f：保存报告、范围diff与各AC；机器AC通过才done，构建/兼容性失败则保留已完成步骤并报告阻塞，不能把它们降级成可选。

## 实施步骤

1. 基线取当前磁盘，不取HEAD。制作构建配置时读取实际CLI默认/用户配置字段，确认独立 `buildPath` /输出名生效再执行；使用同一Main场景、平台、debug/优化设置进行A/B，禁止改原设置。优先本地CLI；若版本/引擎不兼容，可用现有Creator3.8.8原生CLI构建，并记录实际接受的参数。不能构建则DC.b阻塞，不虚构后续成功。
2. 新图集优先用可用CLI/MCP的 `assets-create-asset-by-type` 对应 **auto-atlas** 模板（先查询schema）；这不是Sprite/Label/Button prefab创建。也可使用已核实的导入器 `.pac` 默认文本创建普通配置资产，再让真实导入生成meta。不拼造uuid。不启动scene编辑会话。
3. 图集初始配置：maxWidth/maxHeight=2048、padding=2、allowRotation=false、PNG无损、保留padding/contour bleed，采样linear/no-mipmap/clamp-to-edge。读取实际导入器字段后写入新图集userData。`filterUnused=false` 保留resources动态访问帧；首轮保守设置 `removeTextureInBundle=false`、`removeImageInBundle=false`、`removeSpriteAtlasInBundle=false`，避免移除可按类型加载的原始资产。原图保留导致包体/内存可能增加，必须报告。这一轮不通过删除原图换包体收益。
4. 根图集依靠packable选择：目标36帧参与。六张佣兵2待机帧此前已packable=true，根图集可能原生附带收集它们：不得修改它们的meta，不计入本次优化收益；记录这一原生收集副作用。若必须完全排除它们才能交付则报告并replan，不擅自关闭原有packable或移动资源。其他素材保持原值；预检发现更多true或子pac时先报告环境差异。若多页，记录成员分布及小怪/阴影/血条能否共享纹理；只可在同图集现有上限内根据真实结果调参数，不增加4096大图、重分目录或新增其他主题优化。
5. 导入/refresh/reimport严格串行，禁止CLI资产库写入与Creator同时写同一资产；先确认当前工程占用，使用同一受控导入途径。若真实导入器重写了目标meta的其他字段，恢复本任务造成的额外字段变动后重新验证；不能维持契约则阻塞。
6. 验证脚本采用已生成产物格式：读取实际bundle config/pack结果（含压缩UUID时用本地Cocos UUID工具解码）建立原SpriteFrame→构建SpriteFrame→atlas texture/image关联。不能仅检查pac存在或PNG数量减少。检查36个目标的覆盖/明确失败原因，取小怪不同动画帧、阴影、两张小怪血条证明texture重用。检查基线存在的resources路径/类型在候选仍可解析。
7. 可运行时从**构建产物**采样。浏览器只用已提供工具API或已有调试运行入口，不假设浏览器evaluate能力。基线/候选同分辨率、设备、相机、单位数、动画状态；固定小怪数下，满血/受伤分别预热5秒采10秒，记录单位数和Draw Call/帧耗时统计及采样方式。无法精确控制整场时可做独立非产品运行的实际资产渲染样本，并明确它不等于完整战斗收益；不注入生产作弊/测试开关。

## 校验点

- [AC-SCOPE，阻塞] 目标meta仅packable变化；原UUID/子UUID及其他字段一致；PNG、scene/prefab/anim/scripts/settings任务前后哈希一致；无无关新增资产。范围以本轮baseline而非git HEAD比较。
- [AC-IMPORT，阻塞] pac由真实导入器接受，meta合法，有可查询/导入日志证据；没有目标资源missing/invalid错误。
- [AC-BUILD，阻塞] baseline与candidate独立构建成功；记录退出码、配置、绝对输出路径、日志。候选输出至少有一个有效静态图集页面，尺寸≤2048，无丢帧/无效UV/越界。
- [AC-REF，阻塞] 36个目标SpriteFrame均可从构建索引/依赖解析；原资源路径、类型与动画引用仍有效；跨多个帧实证共享atlas texture。如空白帧由原生packer不合入，报告逐帧原因为原本透明并验证仍可加载，不可静默漏报。
- [AC-CHECK，阻塞] `node .cursor/scripts/verify-battle-atlas.cjs --baseline .cursor/plans/reports/optimize-battle-drawcalls-evidence/baseline --candidate build/optimize-battle-drawcalls-candidate` 退出0；如平台实际输出有子目录，报告最终调用的准确路径。`git diff --check` 对本任务文件无错误，已有无关错误独立记录。
- [AC-PERF，有运行环境则执行；缺环境不阻塞配置交付] 保存A/B Draw Call与帧耗时、图集页数、成员分布、包体和估算纹理占用；无性能数据只允许表述“静态图集配置与构建验证完成，性能收益未验证”。若数据无改善或恶化必须明确报告，不得给百分比承诺或称问题解决；明显视觉回归视为AC-REF失败。
- [AC-PLAY，不阻塞] 检查角色动画不跳位、透明边缘无渗色、血条填充和阴影遮挡一致；满血隐藏血条是既有行为，不计为本次收益。

本计划没有scene/prefab写入，AC-GATE / AC-P3 / AC-EDITOR-MCP、`create-prefab-from-node`、scene-save/post-scene-save均不适用且不得为跑门禁额外改scene。若后续确需scene/prefab修改必须replan补入合法创建/save/close/post-scene/reimport/open/任务级gate流程。

## 回滚策略

以DC.a备份的当前磁盘为准，仅恢复本任务改变的packable值，先确认文件未被其他人续改。新pac及其导入产物通过同一导入管线移除；只删除本任务明确记录且位于任务目录内的新文件。禁止整仓git restore。保留baseline、失败日志、已通过AC与报告供续跑。若发生同时修改，保存差异并停止覆盖该文件。

## 修订记录

- v1（2026-09-16）：基于本地auto-atlas源码和素材尺寸建立单图集方案；不改行为，无OpenSpec；区分构建兼容性必验与性能采样证据。

## 执行报告须含（build-agent）

报告路径：`.cursor/plans/reports/optimize-battle-drawcalls-report.md`。列出实际改动数、baseline保护结果、构建命令/出口、图集页数与成员、AC逐项证据、运行时采样状态和残余风险。配置交付与性能收益必须分开结论。

| MCP/执行指标 | 次数/值 |
|---|---|
| assets-query-path / 工程确认方式 | 待填 |
| 资产创建 / 导入 / refresh / reimport | 待填 |
| scene-open / scene-save | 0 / 0 |
| verify-mcp-gate / post-scene-save | 0 / N/A |
| 本任务新建prefab数 | 0 |
| baseline / candidate构建次数与耗时 | 待填 |
| 图集页数 / 页面像素 / resources体积变化 | 待填 |
| 性能采样方式 / 缺失原因 | 待填 |
| 是否续跑 | 待填 |
| OpenSpec change | none |


## v1 执行续跑记录（2026-09-16）

- DC.a 已固化到 `reports/optimize-battle-drawcalls-evidence/baseline/`：36个目标meta完整内容、1120个assets/settings路径哈希、HEAD与dirty diff。
- DC.b 进行中：原CLI内置引擎实际4.0.0-alpha.27，已停止其隔离试构建，不计最终证据。切换Creator3.8.8 native-v1隔离快照；原生启动审批由主会话接管。
- 当前产品资产未改；从DC.b继续，不重复baseline，不重扫。
