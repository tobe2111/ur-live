# ur-live Safe Deployment Script (PowerShell)
#
# Prevents 2026-05-12 incident: 'npx vite build' alone does NOT refresh _worker.js.
# This script always runs 'npm run build' (worker + client + prepare).
#
# Usage:
#   .\scripts\deploy.ps1                     # default deploy
#   .\scripts\deploy.ps1 -Message "fix-X"    # specify commit message
#   .\scripts\deploy.ps1 -SkipBuild          # redeploy without rebuild
#   .\scripts\deploy.ps1 -Branch "preview"   # different branch

param(
  [string]$Message = "deploy",
  [string]$Branch = "main",
  [string]$ProjectName = "ur-live",
  [switch]$SkipBuild,
  [switch]$SkipPull
)

$ErrorActionPreference = "Stop"

function Write-Step($text) {
  Write-Host ""
  Write-Host "==> $text" -ForegroundColor Cyan
}

function Write-Ok($text) {
  Write-Host "    OK $text" -ForegroundColor Green
}

function Write-Err($text) {
  Write-Host "    ERR $text" -ForegroundColor Red
}

# 1. Git status check
Write-Step "Git status check"
if (-not $SkipPull) {
  git fetch origin
  $currentBranch = git rev-parse --abbrev-ref HEAD
  if ($currentBranch -ne $Branch) {
    Write-Host "    Current branch: $currentBranch (target: $Branch)" -ForegroundColor Yellow
    Write-Host "    Deploy proceeds from $Branch only." -ForegroundColor Yellow
    $confirm = Read-Host "    Type 'y' to continue"
    if ($confirm -ne 'y') { exit 1 }
  }

  $remoteSha = (git rev-parse "origin/$Branch").Trim()
  $localSha = (git rev-parse HEAD).Trim()
  if ($remoteSha -ne $localSha) {
    Write-Host "    local HEAD ($localSha) != origin/$Branch ($remoteSha)" -ForegroundColor Yellow
    Write-Host "    Push may be missing - run 'git push origin $Branch' first." -ForegroundColor Yellow
    $confirm = Read-Host "    Type 'y' to continue anyway"
    if ($confirm -ne 'y') { exit 1 }
  } else {
    $short = $localSha.Substring(0, 7)
    Write-Ok "local HEAD == origin/$Branch ($short)"
  }
}

# 2. Build (MUST be npm run build, NOT vite build!)
if (-not $SkipBuild) {
  Write-Step "Full build (client + worker + prepare)"
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Err "Build failed - aborting deploy"
    exit 1
  }
  Write-Ok "Build success"
} else {
  Write-Host "    Build skipped (-SkipBuild flag)" -ForegroundColor Yellow
}

# 3. _worker.js freshness check
Write-Step "_worker.js freshness check"
$workerPath = "dist/_worker.js"
if (-not (Test-Path $workerPath)) {
  $workerPath = "dist/client/_worker.js"
}
if (-not (Test-Path $workerPath)) {
  Write-Err "_worker.js not found. Run 'npm run build:worker' and retry."
  exit 1
}
$workerMtime = (Get-Item $workerPath).LastWriteTimeUtc
$now = (Get-Date).ToUniversalTime()
$ageMinutes = ($now - $workerMtime).TotalMinutes
if ($ageMinutes -gt 10) {
  Write-Host "    Warning: _worker.js is $([int]$ageMinutes) min old" -ForegroundColor Yellow
  $confirm = Read-Host "    Type 'y' to continue"
  if ($confirm -ne 'y') { exit 1 }
} else {
  Write-Ok "_worker.js fresh ($([int]$ageMinutes) min old)"
}

# 4. Deploy (ASCII commit message required - CF API rejects some Unicode)
Write-Step "Cloudflare Pages deploy"
$asciiMessage = $Message -replace '[^\x00-\x7F]', '-'
if ($asciiMessage -ne $Message) {
  Write-Host "    Korean/Unicode stripped: '$Message' -> '$asciiMessage'" -ForegroundColor Yellow
}

$deployOutput = npx wrangler@3 pages deploy dist/client `
  --project-name=$ProjectName `
  --commit-dirty=true `
  --commit-message="$asciiMessage" 2>&1

Write-Host $deployOutput
$deployOutput | Out-File -FilePath "deploy-last.log" -Encoding UTF8

$deployText = $deployOutput -join "`n"
if ($deployText -match "Deployment complete") {
  Write-Ok "Deploy complete"
  if ($deployText -match "Uploaded (\d+) files") {
    $uploaded = [int]$matches[1]
    if ($uploaded -eq 0) {
      Write-Host "    Note: 0 files uploaded (content hash dedup) - _worker.js may still have updated" -ForegroundColor Yellow
    }
  }
  if ($deployText -match "https://[\w-]+\.ur-live\.pages\.dev") {
    $url = $matches[0]
    Write-Host "    Deploy URL: $url" -ForegroundColor Green
  }
} else {
  Write-Err "Deploy failed - check deploy-last.log"
  exit 1
}

# 5. Smoke test
Write-Step "Production API smoke test"
$apiUrl = "https://live.ur-team.com/api/version"
try {
  $resp = Invoke-WebRequest -Uri $apiUrl -Method GET -UseBasicParsing -TimeoutSec 10
  if ($resp.StatusCode -eq 200) {
    Write-Ok "/api/version OK ($($resp.StatusCode))"
  } else {
    Write-Host "    /api/version returned: $($resp.StatusCode)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "    /api/version request failed: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Deploy complete. Verify critical features in browser + DevTools." -ForegroundColor Green
