<#
.SYNOPSIS
  Clean build, then remove temporary intermediate files (source maps).
.DESCRIPTION
  1. Remove all compiled output (dist/)
  2. Run tsc build
  3. Remove intermediate files (*.js.map, *.d.ts.map), keep result files (.js, .d.ts)
#>

$ErrorActionPreference = "Stop"
$distDir = Join-Path $PSScriptRoot "dist"

# ── Step 1: Full clean ────────────────────────────────────────────
Write-Host "[1/3] Cleaning dist/ ..." -ForegroundColor Cyan
if (Test-Path $distDir) {
    Remove-Item -Recurse -Force $distDir
    Write-Host "  Removed dist/" -ForegroundColor Gray
} else {
    Write-Host "  dist/ does not exist, nothing to clean" -ForegroundColor Gray
}

# ── Step 2: Build ─────────────────────────────────────────────────
Write-Host "[2/3] Running tsc ..." -ForegroundColor Cyan
npx tsc
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  Build succeeded" -ForegroundColor Green

# ── Step 3: Remove intermediate files, keep results ──────────────
Write-Host "[3/3] Removing intermediate files (*.js.map, *.d.ts.map) ..." -ForegroundColor Cyan
$maps = Get-ChildItem -Recurse -Path $distDir -Include "*.js.map", "*.d.ts.map" -ErrorAction SilentlyContinue
if ($maps) {
    $maps | Remove-Item -Force
    Write-Host "  Removed $($maps.Count) map files" -ForegroundColor Gray
} else {
    Write-Host "  No intermediate files found" -ForegroundColor Gray
}

# ── Summary ───────────────────────────────────────────────────────
$resultFiles = Get-ChildItem -Recurse -Path $distDir -Include "*.js", "*.d.ts" -ErrorAction SilentlyContinue
Write-Host "`nDone. $($resultFiles.Count) result files in dist/" -ForegroundColor Green
