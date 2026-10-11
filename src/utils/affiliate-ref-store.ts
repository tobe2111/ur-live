/**
 * 🔗 **누가 소개했는가 — 손님 브라우저에 남기는 값의 SSOT** (2026-10-11 대표 *"유효기간 24시간으로 해줘. 7일말고.
 * 그리고 마지막 링크를 우선으로 해줘."*)
 *
 * ## 왜 따로 떼었나
 * 이 값은 네 군데가 읽는다 — 모든 요청에 `X-Affiliate-Ref` 를 붙이는 `lib/api.ts`(서버가 결제 때 읽는 그 헤더),
 * 쇼핑 체크아웃(`useBeforePayment`), 이용권 구매 화면(`seller-tracking.getPurchaseRef`), 담기 가로채기 판정
 * (`affiliate-track.arrivedViaSomeoneElsesRef`). 예전엔 각자 `affiliate_ref_expires` 를 직접 읽어서, 기간을 바꾸면
 * 한 곳만 바뀌고 나머지가 옛 기간으로 남는 구조였다. 여기 하나만 고치면 전부 따라온다.
 * ⚠️ 이 파일은 **아무것도 import 하지 않는다**(정책 상수 하나 빼고) — `lib/api.ts` 가 import 하므로
 *   여기서 api 를 끌어오면 순환이 된다.
 *
 * ## 규칙
 * - **유효기간 24시간**(`REF_COOKIE_TTL_HOURS`). 링크로 들어온 **시각**(`affiliate_ref_at`)부터 센다.
 * - **마지막 링크가 이긴다** — 새 링크로 들어오면 덮어쓴다(`writeAffiliateRef`).
 * - 2026-10-11 이전에 7일로 저장된 값은 `_at` 이 없다 → `만료시각 − 7일` 을 들어온 시각으로 보고
 *   **24시간 규칙으로 다시 판정**한다(옛 값이 7일을 그대로 누리지 않게).
 */
import { CURATOR_DEFAULTS } from '@/shared/constants/policy'

export const AFFILIATE_REF_KEY = 'affiliate_ref'
export const AFFILIATE_REF_EXP_KEY = 'affiliate_ref_expires'
export const AFFILIATE_REF_AT_KEY = 'affiliate_ref_at'

/** 소개 유효기간(ms) — 24시간. */
export const AFFILIATE_REF_TTL_MS = CURATOR_DEFAULTS.REF_COOKIE_TTL_HOURS * 60 * 60 * 1000
const LEGACY_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 2026-10-11 이전 저장분 역산용

export interface AffiliateRefEntry { ref: string; at: number }

/** 지금 유효한 소개 값. 없거나 지났으면 null. **부작용 없음**(지우지 않는다). */
export function readAffiliateRef(now: number = Date.now()): AffiliateRefEntry | null {
  try {
    const ref = localStorage.getItem(AFFILIATE_REF_KEY)
    if (!ref || !/^\d{1,12}$/.test(ref)) return null
    let at = parseInt(localStorage.getItem(AFFILIATE_REF_AT_KEY) || '', 10)
    if (!Number.isFinite(at)) {
      const exp = parseInt(localStorage.getItem(AFFILIATE_REF_EXP_KEY) || '0', 10)
      if (!Number.isFinite(exp) || exp <= 0) return null
      at = exp - LEGACY_TTL_MS
    }
    if (at > now + 60_000) return null // 미래 시각 = 깨진 값
    if (now - at > AFFILIATE_REF_TTL_MS) return null
    return { ref, at }
  } catch {
    return null
  }
}

/** 새 링크로 들어왔다 — 덮어쓴다(마지막 링크 우선). 쿠키도 같은 기간으로. */
export function writeAffiliateRef(ref: string, now: number = Date.now()): void {
  try {
    localStorage.setItem(AFFILIATE_REF_KEY, ref)
    localStorage.setItem(AFFILIATE_REF_AT_KEY, String(now))
    localStorage.setItem(AFFILIATE_REF_EXP_KEY, String(now + AFFILIATE_REF_TTL_MS))
    document.cookie = `affiliate_ref=${ref}; path=/; max-age=${Math.floor(AFFILIATE_REF_TTL_MS / 1000)}; SameSite=Lax`
  } catch { /* storage unavailable */ }
}

/**
 * 지난 값을 지운다(저장소 + 쿠키). 서버는 쿠키를 폴백으로 읽으므로, 7일짜리로 심긴 옛 쿠키가 24시간을
 * 넘겨 살아 있으면 서버가 그걸 소개자로 읽는다 — 그래서 요청 직전에 정리한다(`lib/api.ts`).
 */
export function pruneExpiredAffiliateRef(now: number = Date.now()): void {
  try {
    // 저장소가 비어 있고 쿠키만 남은 경우는 건드리지 않는다 — 그게 쿠키 폴백의 존재 이유다(인앱→외부 재방문 등).
    if (!localStorage.getItem(AFFILIATE_REF_KEY) || readAffiliateRef(now)) return
    localStorage.removeItem(AFFILIATE_REF_KEY)
    localStorage.removeItem(AFFILIATE_REF_AT_KEY)
    localStorage.removeItem(AFFILIATE_REF_EXP_KEY)
    document.cookie = 'affiliate_ref=; path=/; max-age=0; SameSite=Lax'
  } catch { /* noop */ }
}
