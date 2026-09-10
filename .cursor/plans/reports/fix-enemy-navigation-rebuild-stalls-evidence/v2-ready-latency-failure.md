# v2 Readiness-Latency Failure

Command:

```powershell
node .cursor/scripts/bench-enemy-navigation.cjs --construction-jobs --evidence-dir .cursor/plans/reports/fix-enemy-navigation-rebuild-stalls-evidence
```

First attempt with the synthetic full-rectangle walkable polygon:

```text
AssertionError: slice p95 exceeded 8ms: 33.0933
```

Second attempt after removing only that redundant benchmark rectangle while retaining current Main.scene bounds, 30-unit cells, the blocking wall, both body keys, coalescing, atomic publication, and invalidation:

```text
AssertionError: slice p95 exceeded 8ms: 24.49039999999991
```

The v2 plan forbids the algorithmic change needed to reduce graph-edge slice cost, and also forbids changing the 4096 cap or timing threshold without replan. No live trace or gameplay check was run.
