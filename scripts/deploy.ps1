# 🚀 ur-live 안전 배포 스크립트 (PowerShell)
#
# 2026-05-12 사고 방지: 'npx vite build' 만 실행하면 _worker.js 가 갱신 안 됨.
# 이 스크립트는 항상 'npm run build' (worker + client + prepare 모두) 를 실행.
#
# 사용법:
#   .\scripts\deploy.ps1                     # 기본 배포
#   .\scripts\deploy.ps1 -Message "fix-X"    # 커밋 메시지 지정
#   .\scripts\deploy.ps1 -SkipBuild          # 빌드 스킵 (재배포만)
#   .\scripts\deploy.ps1 -Branch "preview"   # 다른 브랜치로 배포

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

# 1. Git 상태 확인
Write-Step "Git 상태 확인"
if (-not $SkipPull) {
  git fetch origin
  $currentBranch = git rev-parse --abbrev-ref HEAD
  if ($currentBranch -ne $Branch) {
    Write-Host "    현재 브랜치: $currentBranch (배포 대상: $Branch)" -ForegroundColor Yellow
    Write-Host "    배포는 $Branch 브랜치에서만 진행됩니다." -ForegroundColor Yellow
    $confirm = Read-Host "    계속하려면 'y' 입력"
    if ($confirm -ne 'y') { exit 1 }
  }

  $remoteSha = (git rev-parse "origin/$Branch").Trim()
  $localSha = (git rev-parse HEAD).Trim()
  if ($remoteSha -ne $localSha) {
    Write-Host "    local HEAD ($localSha) != origin/$Branch ($remoteSha)" -ForegroundColor Yellow
    Write-Host "    push 누락 가능성 — 'git push origin $Branch' 먼저 실행 권장" -ForegroundColor Yellow
    $confirm = Read-Host "    그래도 진행하려면 'y' 입력"
    if ($confirm -ne 'y') { exit 1 }
  } else {
    Write-Ok "local HEAD == origin/$Branch ($localSha.Substring(0, 7))"
  }
}

# 2. 빌드 (반드시 npm run build — vite build 아님!)
if (-not $SkipBuild) {
  Write-Step "Full build (client + worker + prepare)"
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Write-Err "빌드 실패 — 배포 중단"
    exit 1
  }
  Write-Ok "빌드 성공"
} else {
  Write-Host "    빌드 스킵 (-SkipBuild 옵션)" -ForegroundColor Yellow
}

# 3. _worker.js 존재 + 신선도 검증
Write-Step "_worker.js 신선도 검증"
$workerPath = "dist/_worker.js"
if (-not (Test-Path $workerPath)) {
  $workerPath = "dist/client/_worker.js"
}
if (-not (Test-Path $workerPath)) {
  Write-Err "_worker.js 가 없습니다. 'npm run build:worker' 실행 후 재시도."
  exit 1
}
$workerMtime = (Get-Item $workerPath).LastWriteTimeUtc
$now = (Get-Date).ToUniversalTime()
$ageMinutes = ($now - $workerMtime).TotalMinutes
if ($ageMinutes -gt 10) {
  Write-Host "    경고: _worker.js 가 $([int]$ageMinutes) 분 전 빌드됨" -ForegroundColor Yellow
  $confirm = Read-Host "    그래도 진행하려면 'y' 입력"
  if ($confirm -ne 'y') { exit 1 }
} else {
  Write-Ok "_worker.js 신선 ($([int]$ageMinutes)분 전 빌드)"
}

# 4. 배포 (ASCII commit message 필수 — CF API 가 일부 유니코드 거부)
Write-Step "Cloudflare Pages 배포"
$asciiMessage = $Message -replace '[^\x00-\x7F]', '-'
if ($asciiMessage -ne $Message) {
  Write-Host "    한글/유니코드 제거: '$Message' -> '$asciiMessage'" -ForegroundColor Yellow
}

$deployOutput = npx wrangler@3 pages deploy dist/client `
  --project-name=$ProjectName `
  --commit-dirty=true `
  --commit-message="$asciiMessage" 2>&1

Write-Host $deployOutput
$deployOutput | Out-File -FilePath "deploy-last.log" -Encoding UTF8

if ($deployOutput -match "Deployment complete") {
  Write-Ok "배포 완료"
  if ($deployOutput -match "Uploaded (\d+) files") {
    $uploaded = [int]$matches[1]
    if ($uploaded -eq 0) {
      Write-Host "    경고: 0 files uploaded — content hash dedup 또는 빌드 산출물 미변경" -ForegroundColor Yellow
      Write-Host "    _worker.js 는 별도 업로드되므로 worker 변경은 반영됐을 수 있음" -ForegroundColor Yellow
    }
  }

  if ($deployOutput -match "https://[\w-]+\.([\w-]+\.)?pages\.dev") {
    $url = $matches[0]
    Write-Host "    배포 URL: $url" -ForegroundColor Green
  }
} else {
  Write-Err "배포 실패 — deploy-last.log 확인"
  exit 1
}

# 5. 핵심 endpoint 검증
Write-Step "프로덕션 API smoke test"
$apiUrl = "https://live.ur-team.com/api/version"
try {
  $resp = Invoke-WebRequest -Uri $apiUrl -Method GET -UseBasicParsing -TimeoutSec 10
  if ($resp.StatusCode -eq 200) {
    Write-Ok "/api/version OK ($($resp.StatusCode))"
  } else {
    Write-Host "    /api/version 응답: $($resp.StatusCode)" -ForegroundColor Yellow
  }
} catch {
  Write-Host "    /api/version 호출 실패: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "배포 완료. 브라우저 + DevTools 로 핵심 기능 검증 권장." -ForegroundColor Green
