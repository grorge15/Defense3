# optimize-battle-drawcalls 执行报告

计划 v1，2026-09-16；风险中；首次执行，当前暂停在 DC.b 的原生构建启动，主会话接管权限请求。无 OpenSpec（素材管线优化）。

| Todo | 状态 | 证据 |
|---|---|---|
| DC.a | 完成 | evidence/baseline/manifest.json、git-status.txt、git-diff.patch |
| DC.b | 进行中 | baseline/build-config.json、build.log；native-build-config.json与native-v1隔离项目已准备 |
| DC.c | 未开始 | 产品 PNG/meta/pac 未修改 |
| DC.d | 未开始 | 校验脚本仅准备范围检查，未宣称全AC |
| DC.e | 未开始 | 未取得可比较构建 |
| DC.f | 进行中 | 本报告持续更新 |

基线 HEAD：`8a255e291accb59fe657df4c8c88786cf2d9211f`。当前用户 dirty 内容均保留。清单包含36个目标meta及对应PNG、1120个assets/settings文件哈希。

变更：本计划进度、此报告、证据文件、只读验证脚本骨架。产品源码、场景、预制体、动画、图片和meta均尚未更改。

构建入口：`node C:/Users/Admin/cocos-cli/dist/cli.js build -j C:/Users/Admin/Defense3/build/optimize-battle-drawcalls-baseline/project -p web-desktop -c C:/Users/Admin/Defense3/.cursor/plans/reports/optimize-battle-drawcalls-evidence/baseline/build-config.json`。该CLI内置引擎为4.0.0-alpha.27，与项目3.8.8不同；在引擎编译阶段停止（session8638，退出1），不能作为验收产物。TS检查通过，存在原有循环依赖警告及外部internal缓存EPERM日志。

正确版本快照：`C:/Users/Admin/Defense3/build/optimize-battle-drawcalls-baseline/native-v1/project`。输出配置：同目录父级 `web-desktop`。原生配置在 `evidence/baseline/native-build-config.json`；待启动Creator3.8.8 `--path <project> --build configPath=<config> --log-file <evidence/baseline/native-build.log>`。两次子代理升级请求分别等待382.7秒（只读CIM）和127.2秒（原生构建），均被中止；未拿到原生启动PID，主会话正在接管。

| AC | 状态 |
|---|---|
| AC-SCOPE | 基线已保存，未执行最终检查 |
| AC-IMPORT | 未执行 |
| AC-BUILD | 未通过：尚无3.8.8基线/候选 |
| AC-REF | 未执行 |
| AC-CHECK | 未执行 |
| AC-PERF | 未测量，不得宣称改善 |
| AC-PLAY | 待构建 |

| MCP/执行指标 | 次数/值 |
|---|---|
| assets-query-path | N/A，采用独立磁盘快照构建 |
| 资产创建/导入/refresh/reimport | 产品0；试构建隔离快照自动导入1次 |
| scene-open / scene-save | 0 / 0 |
| verify-mcp-gate / post-scene-save | 0 / N/A |
| 本任务新建prefab | 0 |
| baseline/candidate构建 | 4.0试构建1（停止），3.8.8待启动 / 0 |
| 图集页数 / 像素 / 体积差 | 未获得产物 |
| 性能采样 | 无有效A/B构建，未执行 |
| 是否续跑 | 初始执行；继续从DC.b |

内存和包体须以同配置产物测量；用户现有5.4MB包与本轮debug构建不可直接比较。保留原图打包不等于原图和图集都常驻GPU，最终须检查SpriteFrame纹理引用与实际加载。当前没有优化交付结论。
