/**
 * 🩸 **편집 폼을 서버 값이 덮어쓰면 입력이 조용히 사라진다** (2026-08-02 대표 신고 — 실제 데이터 손실).
 *
 * `/admin/platform-settings` 는 편집 폼인데 `useApiQuery` 결과가 바뀔 때마다 **폼 전체를 서버 값으로
 * 리셋**했다. RQ 는 창 포커스 복귀 등으로 사용자가 타이핑하는 중에도 리페치한다:
 *
 * ```
 *   토큰 붙여넣기 → 다른 창 다녀옴 → 리페치가 폼을 옛 값으로 되돌림 → '저장' → **옛 값이 다시 저장**
 * ```
 *
 * 화면에는 계속 "설정됨" 이 떠서 성공처럼 보였다. 실측으로 잡혔다 — 새 토큰을 넣었는데 저장된 값의
 * 해시가 옛 토큰의 것이었다(길이가 우연히 같아 눈으로는 구분 불가). 그 결과 여러 세션이
 * *"CF 토큰이 죽었다"* 로 오진한 채 며칠을 보냈다 — **원인은 토큰이 아니라 이 저장 경로였다.**
 *
 * ⚠️ **이 테스트가 못 보는 것**: 실제 리페치 타이밍과 브라우저 동작. 소스 배선만 고정한다
 *   (렌더 테스트는 RQ·라우터·토스트를 전부 세워야 해서 비용 대비 얻는 게 적다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = readFileSync(join(process.cwd(), 'src/pages/AdminPlatformSettingsPage.tsx'), 'utf8')

describe('플랫폼 설정 — 서버 값이 입력을 덮어쓰지 않는다', () => {
  it('🔒 시드는 첫 도착 때만 — 무조건 setSettings(data) 로 되돌리면 입력이 사라진다', () => {
    // 가드 없는 원래 형태가 남아 있으면 위반.
    expect(SRC).not.toMatch(/useEffect\(\(\) => \{ if \(settingsQ\.data\) setSettings\(settingsQ\.data\) \}/)
    expect(SRC).toMatch(/seeded\.current/)
    expect(SRC).toMatch(/!seeded\.current.*setSettings\(settingsQ\.data\)/s)
  })

  it('🔒 저장 성공 뒤에만 다시 시드한다 — 그래야 반영된 값이 화면에 뜬다', () => {
    expect(SRC).toMatch(/seeded\.current = false\s*\n\s*await settingsQ\.refetch\(\)/)
  })

  /**
   * "설정됨" 만으로는 옛 값과 새 값을 **구분할 수단이 아예 없었다**. 길이가 같으면 화면이 동일하다.
   * 끝 4자리가 있었으면 07-29 세션이 토큰을 오진하지 않았다.
   */
  it('🔎 자격은 끝 4자리를 보여 준다 — 바뀌었는지 눈으로 확인할 유일한 수단', () => {
    expect(SRC).toMatch(/설정됨 · …\{\(settings\[f\.key\] \|\| ''\)\.slice\(-4\)\}/)
  })

  it('🔎 저장 토스트가 무엇이 교체됐는지 말한다 — 빈 자격은 조용히 걸러지므로', () => {
    expect(SRC).toMatch(/교체됨/)
  })

  it('🔒 빈 자격은 여전히 페이로드에서 제외 — 저장만 눌러도 토큰이 지워지면 안 된다', () => {
    expect(SRC).toMatch(/for \(const k of CREDENTIAL_KEYS\)[\s\S]{0,120}delete payload\[k\]/)
  })
})
