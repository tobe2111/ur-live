/**
 * 🖼️ 2026-11-09 대표 승인 *"허가 — 진행"*(상세 잠금) — 상세 화면의 **맨 위 큰 사진이 다 뜬 뒤**에 아래쪽을 받는다.
 *
 * 실측(폰 흉내 · CPU 4배 · 느린 4G, 홈 → 카드 탭): 큰 사진(960px)과 **같은 순간** 아래쪽 15건(지도 SDK·그림 9장 · 리뷰 ·
 * 다녀온 사람들 · 같은 가게 다른 이용권 목록)이 출발해 회선을 나눴다 — 사진 완료 1.33s. 아래쪽은 화면 밖이거나 막 걸친 자리라
 * 0.5초 늦어도 아무도 모르지만, 맨 위 사진은 누른 사람이 가장 먼저 보는 것이다.
 *
 * 모양: 상세 갤러리가 마운트될 때 `beginHero()`(대기 시작), 첫 사진이 오면(또는 실패하면) `markHeroSettled()`.
 * 사진이 끝내 안 와도 `HERO_SETTLE_MAX_MS` 뒤엔 풀린다(아래쪽이 영영 안 오는 일은 없다).
 * 갤러리가 없는 화면(대기 시작을 안 한 화면)은 처음부터 풀려 있다 — 종전과 같다.
 */
import { useEffect, useState } from 'react'

/** 사진이 안 와도 이 시간 뒤엔 아래쪽을 받는다(ms). */
export const HERO_SETTLE_MAX_MS = 1500

let pending = false
let timer: ReturnType<typeof setTimeout> | null = null
const subs = new Set<() => void>()
const emit = () => { for (const f of subs) f() }

/** 상세 갤러리 마운트 — 큰 사진을 기다리기 시작한다. */
export function beginHero(): void {
  pending = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(markHeroSettled, HERO_SETTLE_MAX_MS)
  emit()
}

/** 큰 사진이 왔다(또는 실패했다) — 아래쪽을 풀어 준다. 여러 번 불러도 같다. */
export function markHeroSettled(): void {
  if (timer) { clearTimeout(timer); timer = null }
  if (!pending) return
  pending = false
  emit()
}

export function isHeroSettled(): boolean { return !pending }

/** 아래쪽 부품이 쓴다 — 큰 사진이 다 뜰 때까지 false. */
export function useHeroSettled(): boolean {
  const [ok, setOk] = useState(isHeroSettled)
  useEffect(() => {
    const f = () => setOk(isHeroSettled())
    subs.add(f); f()
    return () => { subs.delete(f) }
  }, [])
  return ok
}
