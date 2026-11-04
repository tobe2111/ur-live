import { lazy, Suspense, useEffect } from 'react'
import { useUserProfile } from '@/hooks/queries/useUserProfile'

/**
 * 📞🚪 번호 필수 창의 **문지기** (2026-11-04 대표 *"사람들이 대부분 처음 진입하는걸텐데 … 데이터가 느릴 때 많이 느리던데"*).
 *
 * 같은 날 들어온 `PhoneRequiredGate` 는 `src/components/onboarding/` 에 있어 묶음기가 공용 부품 봉투 `app-components`
 *   (**109KB** — 계산대 스캐너·지도 고르기·이미지 올리기 …)에 넣는다. App 은 "로그인했고 이 기기에 번호 기록이 없으면"
 *   그 창을 마운트했는데, 번호 기록(`user_phone`)은 프로필을 한 번 받은 뒤에야 생긴다 ⇒ **새 기기·첫 방문마다**,
 *   그리고 번호가 없는 기존 손님은 **매 방문마다** 실제로 창이 뜨지 않는데도 109KB 를 받았다(빌드 실측 — 마이 첫 화면에서
 *   그 봉투의 10% 만 실행). 창이 실제로 뜨는 사람은 서버가 `phone_required` 라고 답한 새 가입자뿐이다.
 *
 * ⇒ 이 문지기는 엔트리 쪽(`src/lib/` → app-utils)에 있고 이미 실려 있는 프로필 훅만 쓴다. 서버가 `phone_required` 라고
 *   답할 때만 창 코드를 받는다. "필요 없음" 을 한 번 확인하면 이 기기에 표시(`user_phone_ok`)를 남겨 다음부터는 묻지도 않는다.
 * ⚠️ 판정 SSOT 는 그대로 서버(`shared/phone-required.ts`)이고, 창 안에서도 같은 값을 다시 본다 — 여기는 받을지 말지만 정한다.
 */
const PhoneRequiredGate = lazy(() => import('@/components/onboarding/PhoneRequiredGate'))

export const PHONE_OK_KEY = 'user_phone_ok'

/** 이 기기에서 **지금 로그인한 사람**이 "번호 필요 없음" 을 확인받았나 — 값은 그 사람의 user_id(다른 사람이 로그인하면 무효). */
export function phoneOkForCurrentUser(store: Pick<Storage, 'getItem'>): boolean {
  try {
    const uid = store.getItem('user_id') || ''
    return !!uid && store.getItem(PHONE_OK_KEY) === uid
  } catch { return false }
}

export default function PhoneGateDoor() {
  const { data: me } = useUserProfile()
  const need = !!me?.phone_required
  useEffect(() => {
    if (me && !me.phone_required) {
      try { const uid = localStorage.getItem('user_id'); if (uid) localStorage.setItem(PHONE_OK_KEY, uid) } catch { /* 프라이빗 창 */ }
    }
  }, [me])
  if (!need) return null
  return <Suspense fallback={null}><PhoneRequiredGate /></Suspense>
}
