# Supplied Trace Baseline

- Source: `C:\\Users\\Admin\\Desktop\\Trace-20260910T114517.json.gz`
- SHA-256: `d60c1ad44372e068a59f8f4676b21eb32c0f1945a0ac88e09376878acc4a0111`
- Format: Chrome trace with V8 CPU-profile samples, not source instrumentation or exact wall-clock timing.
- Plan-supplied baseline: one construction-frame callback is about 166 ms, with about 154 ms attributed to `FlowField._graphFor` through `EnemyNavigation.blockingLog` and `sharedQuery`; the same baseline calls out an about 21 ms `FlowField._bfs` peak.
- Parsed sample evidence includes `blockingLog -> sharedQuery -> _graphFor`; function names are present in CPU-profile chunks.
