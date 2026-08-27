/**
 * 🤝 매장 소개자 귀속 — 초대 링크의 `ref` 를 등록 시점까지 살려 두는 곳 (2026-08-27)
 *
 * ## 왜 필요한가
 * 소개자가 매장을 데려오면 그 매장 매출의 **2% 를 1년간** 받는다(2026-08-27 대표 확정).
 * 그런데 "누가 데려왔나"를 기록하는 길이 **어드민 수동 지정 하나뿐**이었다 — 대표가 매번 손으로
 * 넣어야 했고, 분쟁이 나면 근거가 없었다. 그래서 초대 링크(`/store/new?ref={user_id}`)로 들어온
 * 매장을 등록 순간에 자동 귀속시킨다.
 *
 * ## sessionStorage 를 쓰는 이유
 * `/store/new` 는 **로그인이 필요한 페이지**다. 로그인 안 한 사장님이 링크를 열면 카카오로
 * 갔다가 돌아오는데, 그 사이 **쿼리스트링이 사라진다.** 그러면 소개자는 데려오고도 보상을 못 받는다.
 * 그래서 링크를 여는 즉시 담아 두고, 등록이 끝나면 지운다.
 *
 * ⚠️ localStorage 가 아니라 **sessionStorage** 다. 영구 저장하면 몇 달 전에 스쳐 본 링크가
 *   엉뚱한 매장에 귀속된다 — 귀속은 "이번에 그 링크로 왔다"일 때만 사실이다.
 */
const KEY = 'ur_store_ref_v1'

/** 링크의 `?ref=` 를 세션에 담는다. 값이 없으면 기존 값을 지우지 않는다(직접 방문으로 덮어쓰기 방지). */
export function captureStoreReferrer(raw: string | null | undefined): void {
  const v = String(raw ?? '').trim().slice(0, 64)
  if (!v) return
  try { sessionStorage.setItem(KEY, v) } catch { /* 프라이빗 모드 등 — 귀속만 안 될 뿐 등록은 된다 */ }
}

export function readStoreReferrer(): string | null {
  try { return sessionStorage.getItem(KEY) || null } catch { return null }
}

/** 등록이 끝나면 지운다 — 남겨 두면 다음 매장까지 같은 사람에게 귀속된다. */
export function clearStoreReferrer(): void {
  try { sessionStorage.removeItem(KEY) } catch { /* noop */ }
}
