/**
 * 🟡 카카오로 만든 에이전시 — 화면 쪽 요청 (2026-10-26 대표 확정)
 *
 * 이 두 요청만 **손님(카카오) 세션**으로 간다 — 공용 `@/lib/api` 가 쿠키와 CSRF 헤더를 붙인다.
 * 응답으로 받은 에이전시 직원 토큰은 콘솔과 같은 자리(`saveAgencySession`)에 둔다. 그다음부터 에이전시
 * 화면은 종전처럼 자기 토큰만 자기 API 에 보낸다(`agency-api.ts`).
 */
import api from '@/lib/api'
import { bindAgencyToKakao } from '@/lib/agency-presence'
import { saveAgencySession, type AgencyLoginPayload } from './agency-api'

/** 마이가 한 탭에서 한 번만 묻는다 — 에이전시가 아닌 손님 대다수가 매번 요청하지 않게. */
export const KAKAO_AGENCY_PROBE_KEY = 'ur_agency_kakao_probe'

type Resp = AgencyLoginPayload & { success?: boolean; error?: string; code?: string; already?: boolean }

/** 이 카카오 계정과 이어진 에이전시가 있으면 로그인해 둔다. 있었으면 true. */
export async function connectKakaoAgency(): Promise<boolean> {
  try {
    const r = await api.post<Resp>('/api/agency-console/kakao/session', {})
    if (!r.data?.token) return false
    saveAgencySession(r.data, true)
    bindAgencyToKakao()
    return true
  } catch {
    return false
  }
}

export async function createKakaoAgency(body: {
  kind: 'business' | 'individual'; agency_name: string; business_number?: string; agree_terms: true
}): Promise<{ ok: true; already: boolean } | { ok: false; error: string; needLogin?: boolean }> {
  try {
    const r = await api.post<Resp>('/api/agency-console/kakao/create', body)
    if (!r.data?.token) return { ok: false, error: r.data?.error || '에이전시를 만들지 못했어요.' }
    saveAgencySession(r.data, true)
    bindAgencyToKakao()
    return { ok: true, already: !!r.data.already }
  } catch (e) {
    const res = (e as { response?: { status?: number; data?: { error?: string } } }).response
    if (res?.status === 401) return { ok: false, needLogin: true, error: '카카오로 로그인한 뒤에 만들 수 있어요.' }
    return { ok: false, error: res?.data?.error || '에이전시를 만들지 못했어요.' }
  }
}
