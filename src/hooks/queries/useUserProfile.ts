/**
 * 🛡️ 2026-05-22: 사용자 프로필 — 10분 stale + localStorage.
 *
 * 프로필은 거의 안 바뀜 (이름/사진/이메일). 10분 cache + 변경 시 manual invalidate.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { queryKeys } from './queryKeys'
import { writeCache, cachedInitialData, cacheOrRethrow } from './localCache'
import { isLoggedInSync } from '@/utils/auth'

const CACHE_KEY = 'user-profile'

export interface UserProfile {
  id: string
  email?: string
  name?: string
  phone?: string | null
  avatar_url?: string | null
  role?: string
  profileImage?: string | null
}

/**
 * 📞 **서버가 아는 내 정보를 화면들이 이미 읽고 있는 키로 흘려보낸다** (2026-09-15).
 *
 * 대표 신고: *"숙소 이용권 결제 시, 이미 가입을 한 고객의 정보로 등록이 되지 않아?"*
 *
 * 실측하니 폼들은 **이미 채우려 하고 있었다** — `localStorage.user_name / user_phone / user_email`.
 * 그런데 `user_phone` 은 **레포 전체에서 쓰는 곳이 0곳**이라 구조적으로 영원히 빈칸이었다.
 * 그 키를 읽는 소비자 화면은 넷이다:
 *   ① 숙소 단일 예약 `StayDetailPage:633` ② 숙소 묶음 예약 `:748`
 *   ③ 예약(어포인트먼트) `MyAppointmentsPage:262` ④ **토스 결제창 `customerMobilePhone`** `TossWidgetPayPage:177`
 *
 * 서버는 알고 있었다 — `users.phone` 은 알림톡·리마인더 cron 8곳이 읽어 문자를 보낸다.
 * 끊긴 곳은 딱 둘이었다: `/api/auth/me` 의 **세션 쿠키 분기가 phone 을 안 내려줬고**(Bearer 분기만 줬다),
 * 아무도 그 값을 저 키에 안 썼다.
 *
 * ⇒ 여기 한 곳에서 미러링한다. **호출부 네 곳은 한 줄도 안 고친다** — 특히 ④는 Toss V2 감사-잠금
 * 파일이라 건드리지 않고 원래 의도대로 동작하게 된다.
 *
 * ⚠️ **지우기(remove)는 하지 않는다.** 서버가 값을 안 주는 순간(비로그인 응답·필드 누락)에 지워 버리면
 * 멀쩡히 차 있던 폼이 빈칸이 된다. 값이 있을 때만 덮어쓴다.
 */
function mirrorToLegacyKeys(p: UserProfile) {
  try {
    if (p.name) localStorage.setItem('user_name', p.name)
    if (p.email) localStorage.setItem('user_email', p.email)
    if (p.phone) localStorage.setItem('user_phone', p.phone)
  } catch { /* 프라이빗 창 등 — 폼이 물어보는 쪽으로 떨어진다 */ }
}

export function useUserProfile() {
  return useQuery<UserProfile | null>({
    queryKey: queryKeys.userProfile(),
    queryFn: () =>
      api.get('/api/auth/me').then((r) => {
        if (r.data?.success && r.data.data) {
          writeCache(CACHE_KEY, r.data.data)
          mirrorToLegacyKeys(r.data.data as UserProfile)
          return r.data.data as UserProfile
        }
        return null
      }).catch((err) => cacheOrRethrow<UserProfile | null>(CACHE_KEY, err)),
    initialData: () => cachedInitialData<UserProfile>(CACHE_KEY),
    // 🛠️ 2026-06-17 (근본수정): 캐시 seed 즉시 stale → cold mount 보정. 없으면 미캐시 시 null 프로필을
    //   10분간 fresh 로 간주(refetch 안 함) → 이름/아바타 안 뜸.
    initialDataUpdatedAt: 0,
    enabled: isLoggedInSync(),
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}

export function useInvalidateUserProfile() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: queryKeys.userProfile() })
}
