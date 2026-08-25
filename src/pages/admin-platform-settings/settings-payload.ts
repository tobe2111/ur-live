/**
 * ☁️ **저장 페이로드 만들기** — 어드민 플랫폼 설정 페이지의 저장 경로에서 쓰는 순수 함수.
 *   페이지 본문에서 분리한 이유는 두 가지다: ① 시험 가능(렌더 없이 동작을 고정)
 *   ② 페이지가 god 파일로 자라지 않게(CLAUDE.md 파일 크기 래칫).
 */

/** ☁️ 자격 키 — 빈 값이면 저장 페이로드에서 제외한다(아래 save 참조). 섹션과 공유. */
export const CREDENTIAL_KEYS = ['cf_api_token', 'cf_account_id'] as const

/**
 * 🩸 **바뀐 키만 골라낸다** (2026-08-25 — 이 페이지가 8월 내내 아무것도 저장 못 하던 원인).
 *
 *   `settings` 는 서버가 준 `platform_settings` **전체**로 시드된다 — 설정이 아닌 행까지 전부다
 *   (`cron_hb:*` 하트비트만 **129개**, `backup_chunk:*` 커서 등). 예전 코드는 그걸 통째로 PUT 했고
 *   서버는 키 하나당 D1 write 를 순차로 돌렸다. 무료 플랜은 인보케이션당 서브리퀘스트가 50 이라
 *   200행대 페이로드는 **매번 한도에서 끊긴다** → 500 → 화면엔 "저장 실패".
 *   ⇒ 대표가 무엇을 넣든 저장이 안 됐다. **값이 틀려서가 아니라 페이로드가 커서.**
 *   (하트비트가 하나씩 쌓이며 조용히 넘어간 선이라, 어느 날부터 페이지가 통째로 먹통이었다.)
 *
 * @param settings 화면의 현재 값(서버 스냅샷 + 사용자가 고친 것)
 * @param base     서버가 준 스냅샷 원본
 */
export function buildSettingsPayload(
  settings: Record<string, string>,
  base: Record<string, string>,
): { payload: Record<string, string>; creds: string[] } {
  const payload: Record<string, string> = {}
  for (const [k, v] of Object.entries(settings)) {
    if ((CREDENTIAL_KEYS as readonly string[]).includes(k)) continue
    if (base[k] !== v) payload[k] = v
  }
  const creds: string[] = []
  for (const k of CREDENTIAL_KEYS) {
    const v = (settings[k] || '').trim()
    // 빈 값 = '교체' 를 눌러 칸만 열어 둔 상태. 보내면 저장돼 있던 토큰이 **지워진다**.
    if (!v || base[k] === v) continue
    payload[k] = v
    creds.push(k === 'cf_api_token' ? 'API 토큰' : '계정 ID')
  }
  return { payload, creds }
}
