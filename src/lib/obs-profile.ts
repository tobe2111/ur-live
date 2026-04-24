/**
 * OBS Studio 프로파일 생성 — 권장 프리셋 + RTMP URL/Key 프리필
 *
 * OBS 의 Profile 은 `basic.ini` + `service.json` 구조로 저장됨.
 * OBS UI: Profile → Import 로 불러올 수 있는 디렉터리 구조 생성.
 *
 * 다운로드 방식: 2개 파일을 zip 없이 하나의 `.obsprofile` 텍스트 번들로
 * 제공 (OBS가 표준 import 를 지원하지 않는 단일 파일 포맷이라, 셀러에겐
 * "OBS 프로파일 폴더에 복사하세요" 안내 + 원클릭 다운로드 제공).
 */

export interface OBSProfileConfig {
  profileName: string         // e.g., "UR Live"
  rtmpUrl: string             // RTMP 서버 주소
  rtmpKey: string             // 스트림 키
  videoBitrateKbps?: number   // 기본 5000
  audioBitrateKbps?: number   // 기본 160
  resolution?: { w: number; h: number }  // 기본 1920x1080
  fps?: number                // 기본 30
}

export function generateBasicIni(cfg: OBSProfileConfig): string {
  const v = cfg.videoBitrateKbps ?? 5000
  const a = cfg.audioBitrateKbps ?? 160
  const res = cfg.resolution ?? { w: 1920, h: 1080 }
  const fps = cfg.fps ?? 30
  return `[General]
Name=${cfg.profileName}

[Video]
BaseCX=${res.w}
BaseCY=${res.h}
OutputCX=${res.w}
OutputCY=${res.h}
FPSType=0
FPSCommon=${fps}

[Output]
Mode=Simple
StreamEncoder=x264
RecEncoder=x264

[SimpleOutput]
StreamEncoder=x264
VBitrate=${v}
ABitrate=${a}
Preset=veryfast
UseAdvanced=false

[Audio]
SampleRate=48000
`
}

export function generateServiceJson(cfg: OBSProfileConfig): string {
  return JSON.stringify({
    type: 'rtmp_custom',
    settings: {
      server: cfg.rtmpUrl,
      key: cfg.rtmpKey,
      use_auth: false,
    },
  }, null, 2)
}

/**
 * 통합 다운로드: 셀러가 받은 후 OBS 프로파일 디렉터리에 압축 해제.
 * 브라우저에서 zip 생성하려면 JSZip 같은 의존성 필요. 여기선 각 파일
 * 별도 다운로드 + 안내 메시지로 대체.
 */
export function downloadOBSProfile(cfg: OBSProfileConfig) {
  const basicIni = generateBasicIni(cfg)
  const serviceJson = generateServiceJson(cfg)

  // 하나의 텍스트 파일로 묶어서 다운로드 — 셀러가 수동 분리
  const bundle = `# UR Live — OBS Profile Setup
# 이 파일의 내용을 복사하여 OBS Profile 디렉터리에 두 파일로 저장하세요:
#
# Windows: %APPDATA%\\obs-studio\\basic\\profiles\\UR_Live\\
# macOS:   ~/Library/Application Support/obs-studio/basic/profiles/UR_Live/
# Linux:   ~/.config/obs-studio/basic/profiles/UR_Live/
#
# 저장할 파일:
#   1. basic.ini
#   2. service.json
#
# OBS 실행 → Profile → UR Live 선택 → 즉시 스트리밍 가능

# ═══════════════════════════════════════════
# 📄 파일 1: basic.ini
# ═══════════════════════════════════════════
${basicIni}

# ═══════════════════════════════════════════
# 📄 파일 2: service.json
# ═══════════════════════════════════════════
${serviceJson}
`
  const blob = new Blob([bundle], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ur-live-obs-profile-${Date.now()}.txt`
  a.click()
  URL.revokeObjectURL(url)
}
