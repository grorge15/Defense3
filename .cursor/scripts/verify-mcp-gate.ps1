# MCP delivery gate — see defense3-workflow.mdc + cocos-mcp.mdc
# Usage: powershell -File .cursor/scripts/verify-mcp-gate.ps1
# Exit 0 = machine AC pass (editor step 5 still required)

$ErrorActionPreference = "Continue"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
$fail = 0

function Fail($code, $msg) {
    Write-Host "FAIL $code`: $msg" -ForegroundColor Red
    $script:fail++
}

function Pass($code, $msg) {
    Write-Host "PASS $code`: $msg" -ForegroundColor Green
}

function Test-UiPrefabOneByOne($filePath) {
    $hits = @()
    try {
        $raw = Get-Content -Path $filePath -Raw -Encoding UTF8
    } catch {
        return @("cannot read file")
    }
    $pattern = '(?s)"__type__"\s*:\s*"cc\.UITransform".*?"_contentSize"\s*:\s*\{[^}]*?"width"\s*:\s*1\s*,[^}]*?"height"\s*:\s*1'
    if ($raw -match $pattern) {
        $hits += "UITransform 1x1"
    }
    return $hits
}

# --- AC-S1: Main.scene Node.* _id ---
$scene = Join-Path $root "assets/scenes/Main.scene"
if (Test-Path $scene) {
    $m = Select-String -Path $scene -Pattern '"_id": "Node\.'
    if ($m) {
        Fail "AC-S1" "Main.scene has Node.* _id ($($m.Count) hit(s))"
    } else {
        Pass "AC-S1" "Main.scene has no Node.* _id"
    }
    $nullPrefab = Select-String -Path $scene -Pattern '"_children": \[\s*null|"_components": \[\s*null'
    if ($nullPrefab) {
        Fail "AC-S1b" "prefab instances have null in _children/_components ($($nullPrefab.Count) hit(s))"
    } else {
        Pass "AC-S1b" "prefab instances have no null refs"
    }
} else {
    Write-Host "SKIP AC-S1: Main.scene not found" -ForegroundColor Yellow
}

# --- AC-P1: character/building — no Canvas ---
foreach ($dir in @("assets/resources/prefabs/character", "assets/resources/prefabs/building")) {
    $full = Join-Path $root $dir
    if (-not (Test-Path $full)) { continue }
    $canvas = Get-ChildItem $full -Filter "*.prefab" -ErrorAction SilentlyContinue |
        ForEach-Object { Select-String -Path $_.FullName -Pattern '"_name": "Canvas"' }
    if ($canvas) {
        Fail "AC-P1" "$dir contains Canvas ($($canvas.Count) hit(s))"
    } else {
        Pass "AC-P1" "$dir has no Canvas"
    }
}

# --- AC-P2: ui prefabs — no Canvas / Camera ---
$uiDir = Join-Path $root "assets/resources/prefabs/ui"
if (Test-Path $uiDir) {
    $uiPrefabs = Get-ChildItem $uiDir -Filter "*.prefab" -ErrorAction SilentlyContinue
    $canvasHits = 0
    $cameraHits = 0
    $sizeHits = @()
    foreach ($pf in $uiPrefabs) {
        if (Select-String -Path $pf.FullName -Pattern '"_name": "Canvas"') { $canvasHits++ }
        if (Select-String -Path $pf.FullName -Pattern '"_name": "Camera"') { $cameraHits++ }
        $sizeIssues = Test-UiPrefabOneByOne $pf.FullName
        if ($sizeIssues.Count -gt 0) {
            $sizeHits += "$($pf.Name): $($sizeIssues -join ', ')"
        }
    }
    if ($canvasHits -gt 0) {
        Fail "AC-P2-CANVAS" "prefabs/ui has Canvas in $canvasHits prefab(s)"
    } else {
        Pass "AC-P2-CANVAS" "prefabs/ui has no Canvas"
    }
    if ($cameraHits -gt 0) {
        Fail "AC-P2-CAMERA" "prefabs/ui has Camera in $cameraHits prefab(s)"
    } else {
        Pass "AC-P2-CAMERA" "prefabs/ui has no Camera"
    }
    if ($sizeHits.Count -gt 0) {
        Fail "AC-P2-SIZE" "UITransform 1x1 in ui prefab(s): $($sizeHits -join '; ')"
    } else {
        Pass "AC-P2-SIZE" "prefabs/ui has no UITransform 1x1 placeholder"
    }
} else {
    Write-Host "SKIP AC-P2: prefabs/ui not found" -ForegroundColor Yellow
}

# --- AC-P-FAKE: default_sprite literal (cheat rg AC) ---
$prefabRoots = @(
    "assets/resources/prefabs/character",
    "assets/resources/prefabs/building",
    "assets/resources/prefabs/ui",
    "assets/resources/prefabs/projectile",
    "assets/resources/prefabs/item"
)
$fakeHits = @()
foreach ($dir in $prefabRoots) {
    $full = Join-Path $root $dir
    if (-not (Test-Path $full)) { continue }
    Get-ChildItem $full -Filter "*.prefab" -ErrorAction SilentlyContinue | ForEach-Object {
        $lines = Select-String -Path $_.FullName -Pattern 'default_sprite' -AllMatches
        if ($lines) {
            $fakeHits += $_.FullName.Replace($root + '\', '').Replace($root + '/', '')
        }
    }
}
if ($fakeHits.Count -gt 0) {
    Fail "AC-P-FAKE" "default_sprite literal in: $($fakeHits -join ', ')"
} else {
    Pass "AC-P-FAKE" "no default_sprite literal in prefabs"
}

# --- AC-P-EXTRA: __editorExtras__ smuggling ---
$extraHits = @()
foreach ($dir in $prefabRoots) {
    $full = Join-Path $root $dir
    if (-not (Test-Path $full)) { continue }
    Get-ChildItem $full -Filter "*.prefab" -ErrorAction SilentlyContinue | ForEach-Object {
        $raw = Get-Content $_.FullName -Raw -Encoding UTF8
        if ($raw -match '(?s)"__editorExtras__"\s*:\s*\{[^}]*default_sprite') {
            $extraHits += $_.Name
        }
    }
}
if ($extraHits.Count -gt 0) {
    Fail "AC-P-EXTRA" "__editorExtras__ contains default_sprite in: $($extraHits -join ', ')"
} else {
    Pass "AC-P-EXTRA" "no default_sprite in __editorExtras__"
}

Write-Host ""
if ($fail -eq 0) {
    Write-Host "MCP gate (machine): ALL PASS — still run AC-P3/P3b/P4 via MCP + editor (cocos-mcp.mdc step 5)" -ForegroundColor Green
} else {
    Write-Host "MCP gate: $fail failure(s) — do not mark done" -ForegroundColor Red
}

exit $fail
