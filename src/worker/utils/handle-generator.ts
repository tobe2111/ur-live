/**
 * 🛡️ 2026-05-25 (migration 0278): 큐레이터 핸들 자동 생성 SSOT.
 *
 * 사용처: `/api/curator/me/pins` 첫 핀 추가 시 handle 자동 발급.
 *
 * 정책 (`CURATOR_DEFAULTS` 참조):
 *   - regex `^[a-z0-9_]{3,30}$` — 소문자 영숫자 + underscore
 *   - HANDLE_RESERVED 예약어 (admin / api / me / login 등) 차단
 *   - UNIQUE 충돌 시 숫자 suffix (`base`, `base2`, ..., `base99`)
 *   - 99 초과 시 random 6자리 hex suffix
 *
 * 영구성:
 *   - 정책 변경 시 `policy.ts` `CURATOR_DEFAULTS` 만 수정 → 본 파일 자동 반영
 *   - kakao nickname → handle 변환 algorithm 변경 시 본 파일만 수정
 */

import { CURATOR_DEFAULTS } from '../../shared/constants/policy'

/**
 * 닉네임을 handle slug 로 변환.
 * 한글/공백/특수문자 → 영숫자 only.
 * 너무 짧으면 'user' prefix.
 */
export function slugifyHandle(seed: string | null | undefined): string {
  const raw = String(seed || '').trim().toLowerCase()
  // 영숫자 + underscore 만 남김. 다른 문자는 제거.
  // 한글 nickname 은 거의 다 제거되어 빈 문자열 됨 → 'user' fallback.
  const cleaned = raw
    .normalize('NFKD')                  // 분해 정규화 (악센트 분리)
    .replace(/[^a-z0-9_]/g, '')         // 영숫자 + _ 외 제거
    .replace(/^_+|_+$/g, '')            // 앞뒤 _ 제거
    .replace(/_{2,}/g, '_')             // 연속 _ 단일화
    .slice(0, CURATOR_DEFAULTS.HANDLE_MAX_LEN)

  if (cleaned.length >= CURATOR_DEFAULTS.HANDLE_MIN_LEN) return cleaned
  // 🏭 2026-06-05 (사용자 신고 — '@user' generic 핸들): 라틴 글자가 일부라도 있으면 user+slug,
  //   완전 비라틴(한글/이모지) 닉네임이면 빈 문자열 반환 → caller(generateUniqueHandle)가 user{id}로 폴백.
  //   기존엔 빈 슬러그도 bare 'user'를 반환해 첫 한글닉 사용자가 '@user'를 영구 점유했음.
  if (cleaned.length > 0) {
    const padded = `user${cleaned}`.slice(0, CURATOR_DEFAULTS.HANDLE_MAX_LEN)
    return padded.length >= CURATOR_DEFAULTS.HANDLE_MIN_LEN ? padded : ''
  }
  return ''
}

/**
 * 예약어 / 정규식 검증.
 * @returns true = 사용 가능 format
 */
export function isValidHandleFormat(handle: string): boolean {
  if (!CURATOR_DEFAULTS.HANDLE_PATTERN.test(handle)) return false
  if (CURATOR_DEFAULTS.HANDLE_RESERVED.includes(handle)) return false
  return true
}

/**
 * DB UNIQUE 충돌 검사 → 가능하면 base, 충돌하면 suffix.
 *
 * @param DB D1 binding
 * @param seed kakao_nickname or user.name or fallback
 * @param excludeUserId 이미 등록된 본인 핸들은 충돌로 보지 않음 (변경 case)
 * @returns 사용 가능한 unique handle
 */
export async function generateUniqueHandle(
  DB: D1Database,
  seed: string | null | undefined,
  excludeUserId?: number,
  fallbackId?: number,
): Promise<string> {
  let base = slugifyHandle(seed)
  // 🏭 2026-06-05: 빈 슬러그(비라틴 닉네임) 또는 예약어 → user{id} 로 폴백(고유, generic '@user' 회피).
  //   userId 없으면 random hex (충돌 방지). 절대 bare 'user' 가 되지 않도록.
  if (!base || CURATOR_DEFAULTS.HANDLE_RESERVED.includes(base)) {
    base = fallbackId
      ? `user${fallbackId}`
      : `user_${Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')}`
    base = base.slice(0, CURATOR_DEFAULTS.HANDLE_MAX_LEN)
  }

  // base 자체 시도
  if (await isHandleAvailable(DB, base, excludeUserId)) return base

  // base2, base3, ..., base99
  for (let i = 2; i <= 99; i++) {
    const suffix = String(i)
    const candidate = `${base.slice(0, CURATOR_DEFAULTS.HANDLE_MAX_LEN - suffix.length)}${suffix}`
    if (await isHandleAvailable(DB, candidate, excludeUserId)) return candidate
  }

  // fallback: random 6자리 hex
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0')
    const candidate = `${base.slice(0, CURATOR_DEFAULTS.HANDLE_MAX_LEN - rand.length - 1)}_${rand}`
    if (await isHandleAvailable(DB, candidate, excludeUserId)) return candidate
  }

  // 극히 드문 case — timestamp suffix
  const ts = Date.now().toString(36).slice(-6)
  return `user_${ts}`
}

/**
 * 핸들이 사용 가능한지 검사 (예약어 + DB UNIQUE).
 */
export async function isHandleAvailable(
  DB: D1Database,
  handle: string,
  excludeUserId?: number,
): Promise<boolean> {
  if (!isValidHandleFormat(handle)) return false
  const row = await DB.prepare(
    excludeUserId
      ? 'SELECT id FROM users WHERE handle = ? AND id != ? LIMIT 1'
      : 'SELECT id FROM users WHERE handle = ? LIMIT 1',
  ).bind(...(excludeUserId ? [handle, excludeUserId] : [handle])).first<{ id: number }>().catch(() => null)
  return !row
}
