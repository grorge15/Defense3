Set-Location 'c:\Users\Admin\Defense3'
function Do-Rg([string]$pat, [string]$path, [switch]$ExpectNoMatch) {
  $files = if (Test-Path $path -PathType Leaf) { @($path) } else { Get-ChildItem -Path $path -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName } }
  $hits = @()
  foreach ($f in $files) {
    if ($f -match '\.(ts|prefab)$') {
      $hits += Select-String -Path $f -Pattern $pat -AllMatches -ErrorAction SilentlyContinue
    }
  }
  if ($hits.Count -gt 0) { $hits | ForEach-Object { "$($_.Path):$($_.LineNumber):$($_.Line.Trim())" } }
  if ($ExpectNoMatch) { if ($hits.Count -eq 0) { return 1 } else { return 0 } }
  else { if ($hits.Count -gt 0) { return 0 } else { return 1 } }
}
Write-Host 'AC1'; npx tsc --noEmit -p tsconfig.json 2>&1 | Out-String | Write-Host; Write-Host "EXIT:$LASTEXITCODE"
Write-Host 'AC2'; if (-not (Test-Path 'assets/scripts/character/PlayerController.ts')) { Write-Host 'no file'; Write-Host 'EXIT:0' } else { Write-Host 'file exists'; Write-Host 'EXIT:1' }
Write-Host 'AC3'; Do-Rg 'class Player' 'assets/scripts/character/Player.ts' | Write-Host; Write-Host "EXIT:$(Do-Rg 'class Player' 'assets/scripts/character/Player.ts')"
Write-Host 'AC4'; if (Test-Path 'assets/resources/prefabs/character/pref_player.prefab') { Write-Host 'exists'; Write-Host 'EXIT:0' } else { Write-Host 'EXIT:1' }
Write-Host 'AC5'; $e5 = Do-Rg 'PlayerController|LogController' 'assets/scripts' -ExpectNoMatch; if ($e5 -eq 1) { Write-Host '(no matches)'; Write-Host 'EXIT:1' } else { Write-Host 'EXIT:0' }
Write-Host 'AC6'; $e6 = Do-Rg '第[0-9]+下|hitsToKill|一击秒杀' 'assets/scripts' -ExpectNoMatch; if ($e6 -eq 1) { Write-Host '(no matches)'; Write-Host 'EXIT:1' } else { Write-Host 'EXIT:0' }
Write-Host 'AC7'; Do-Rg 'default_sprite|Animation' 'assets/resources/prefabs/character/pref_player.prefab' | Write-Host; Write-Host "EXIT:$(Do-Rg 'default_sprite|Animation' 'assets/resources/prefabs/character/pref_player.prefab')"
Write-Host 'AC8'; $a=Test-Path 'assets/resources/animations/player/idle.anim'; $b=Test-Path 'assets/resources/animations/player/melee_attack.anim'; Write-Host "idle=$a melee=$b"; if ($a -and $b) { Write-Host 'EXIT:0' } else { Write-Host 'EXIT:1' }
Write-Host 'AC9'; Do-Rg 'setMoveDirection|setMode|tryAttack|castUltimate' 'assets/scripts/character/Player.ts' | Write-Host; Write-Host "EXIT:$(Do-Rg 'setMoveDirection|setMode|tryAttack|castUltimate' 'assets/scripts/character/Player.ts')"
Write-Host 'AC10'; Do-Rg 'GameConfig\.(playerMaxHp|playerMoveSpeed|playerParkourForwardSpeed|playerAttackDamage)' 'assets/scripts/character/Player.ts' | Write-Host; Write-Host "EXIT:$(Do-Rg 'GameConfig\.(playerMaxHp|playerMoveSpeed|playerParkourForwardSpeed|playerAttackDamage)' 'assets/scripts/character/Player.ts')"
Write-Host 'AC11'; $e11 = Do-Rg 'PlayerController' 'assets/scripts/character' -ExpectNoMatch; if ($e11 -eq 1) { Write-Host '(no matches)'; Write-Host 'EXIT:1' } else { Write-Host 'EXIT:0' }
