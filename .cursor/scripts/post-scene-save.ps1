# Post scene-save helper: detect Node.* _id, patch disk, sync library JSON.
# Does NOT call MCP (agent must scene-close before this, then reimport + open after).
# Usage:
#   powershell -File .cursor/scripts/post-scene-save.ps1
#   powershell -File .cursor/scripts/post-scene-save.ps1 -ScenePath assets/scenes/Main.scene
# Exit:
#   0 = clean or patched OK — agent should MCP reimport if Patched=1
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
# Any Node.<digits> — PrefabInfo.fileId often reintroduces these after editor save
$hits = [regex]::Matches($raw, 'Node\.\d+')
$idPatched = $false
$nullPatched = $false

if ($hits.Count -gt 0) {
    Write-Host "DIRTY: $($hits.Count) Node.* token(s) (_id/fileId/…) — patching..." -ForegroundColor Yellow
    $patchScript = Join-Path $PSScriptRoot "patch-scene-node-ids.mjs"
    & node $patchScript $ScenePath
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: patch-scene-node-ids exit $LASTEXITCODE" -ForegroundColor Red
        exit $LASTEXITCODE
    }
    $idPatched = $true
} else {
    Write-Host "CLEAN: no Node.* tokens in $ScenePath"
}

# Prefab instance null placeholders (editor re-save often reintroduces these)
$nullPatch = Join-Path $PSScriptRoot "patch-scene-prefab-nulls.mjs"
$nullOut = & node $nullPatch $ScenePath 2>&1 | Out-String
Write-Host $nullOut.Trim()
if ($nullOut -match 'RemovedNulls=([1-9]\d*)') {
    $nullPatched = $true
    Write-Host "DIRTY: stripped prefab-instance null refs" -ForegroundColor Yellow
} else {
    Write-Host "CLEAN: no prefab-instance null refs in assets"
}

# Runtime loads library/<uuid>.json — if it still has nulls while assets is clean, force sync
$metaPath = "$abs.meta"
$uuid = $null
$libFile = $null
$libDirty = $false
if (Test-Path $metaPath) {
    $meta = Get-Content -Path $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $uuid = $meta.uuid
    if ($uuid -and $uuid.Length -ge 2) {
        $libDir = Join-Path (Join-Path $root "library") $uuid.Substring(0, 2)
        $libFile = Join-Path $libDir "$uuid.json"
        if (Test-Path $libFile) {
            $libNulls = & node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));let n=0;for(const o of d){if(!o||o.__type__!=='cc.Node'||!o._prefab)continue;n+=(o._children||[]).filter(x=>x==null).length+(o._components||[]).filter(x=>x==null).length;}process.stdout.write(String(n));" $libFile
            if ([int]$libNulls -gt 0) {
                $libDirty = $true
                Write-Host "DIRTY: library has $libNulls prefab-instance null ref(s) — will sync from assets" -ForegroundColor Yellow
            } else {
                Write-Host "CLEAN: library prefab-instance null refs"
            }
        }
    }
}

$patched = $idPatched -or $nullPatched -or $libDirty
if (-not $patched) {
    Write-Host "Patched=0"
    Write-Host "Next: run verify-mcp-gate.ps1 (no reimport required)"
    exit 0
}

$synced = $false
if ($uuid -and $libFile) {
    $libDir = Split-Path $libFile -Parent
    if (-not (Test-Path $libDir)) {
        New-Item -ItemType Directory -Force -Path $libDir | Out-Null
    }
    Copy-Item -Path $abs -Destination $libFile -Force
    Write-Host "SYNC: library/$($uuid.Substring(0,2))/$uuid.json"
    $synced = $true
}

$raw2 = Get-Content -Path $abs -Raw -Encoding UTF8
$remain = [regex]::Matches($raw2, 'Node\.\d+').Count
if ($remain -ne 0) {
    Write-Host "FAIL: remaining Node.* = $remain" -ForegroundColor Red
    Write-Host "Patched=1 SyncLibrary=$synced"
    exit 2
}

Write-Host "Patched=1 SyncLibrary=$synced"
Write-Host "Next MCP (serial): assets-reimport-asset (this scene) → scene-open → AC-GATE → AC-S2 sample if needed"
exit 0
