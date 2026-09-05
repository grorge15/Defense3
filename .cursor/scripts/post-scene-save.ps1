# Post scene-save helper: detect Node.* _id, patch disk, sync library JSON.
# Does NOT call MCP (agent must scene-close before this, then reimport + open after).
# Usage:
#   powershell -File .cursor/scripts/post-scene-save.ps1
#   powershell -File .cursor/scripts/post-scene-save.ps1 -ScenePath assets/scenes/Main.scene
# Exit:
#   0 = clean (no Node.*) or patched OK — agent should MCP reimport if Patched=1
#   1 = missing scene / patch failed
#   2 = Node.* remain after patch

param(
    [string]$ScenePath = "assets/scenes/Main.scene"
)

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root

$abs = Join-Path $root $ScenePath
if (-not (Test-Path $abs)) {
    Write-Host "FAIL: missing $ScenePath" -ForegroundColor Red
    exit 1
}

$raw = Get-Content -Path $abs -Raw -Encoding UTF8
$hits = [regex]::Matches($raw, '"_id": "Node\.')
if ($hits.Count -eq 0) {
    Write-Host "CLEAN: no Node.* _id in $ScenePath"
    Write-Host "Patched=0"
    Write-Host "Next: run verify-mcp-gate.ps1 (no reimport required for _id)"
    exit 0
}

Write-Host "DIRTY: $($hits.Count) Node.* _id hit(s) — patching..." -ForegroundColor Yellow
$patchScript = Join-Path $PSScriptRoot "patch-scene-node-ids.mjs"
& node $patchScript $ScenePath
if ($LASTEXITCODE -ne 0) {
    Write-Host "FAIL: patch-scene-node-ids exit $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Sync library/<uuid[0:2]>/<uuid>.json from scene .meta when present
$metaPath = "$abs.meta"
$synced = $false
if (Test-Path $metaPath) {
    $meta = Get-Content -Path $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $uuid = $meta.uuid
    if ($uuid -and $uuid.Length -ge 2) {
        $libDir = Join-Path (Join-Path $root "library") $uuid.Substring(0, 2)
        $libFile = Join-Path $libDir "$uuid.json"
        if (-not (Test-Path $libDir)) {
            New-Item -ItemType Directory -Force -Path $libDir | Out-Null
        }
        Copy-Item -Path $abs -Destination $libFile -Force
        Write-Host "SYNC: library/$($uuid.Substring(0,2))/$uuid.json"
        $synced = $true
    }
}

$raw2 = Get-Content -Path $abs -Raw -Encoding UTF8
$remain = [regex]::Matches($raw2, '"_id": "Node\.').Count
if ($remain -ne 0) {
    Write-Host "FAIL: remaining Node.* _id = $remain" -ForegroundColor Red
    Write-Host "Patched=1 SyncLibrary=$synced"
    exit 2
}

Write-Host "Patched=1 SyncLibrary=$synced"
Write-Host "Next MCP (serial): assets-reimport-asset (this scene) → scene-open → AC-GATE → AC-S2 sample if needed"
exit 0
