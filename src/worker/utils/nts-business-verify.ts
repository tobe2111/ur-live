/**
 * 🛡️ 2026-05-27: 국세청 사업자등록정보 진위확인 + 휴/폐업 조회.
 *
 * 무료 API (data.go.kr) — 운영 1만건/일.
 * 사용자 액션 필요:
 *   1. https://www.data.go.kr 회원가입
 *   2. "국세청_사업자등록정보 진위확인 및 상태조회 서비스" 신청 (운영)
 *   3. 인증키 받기 (1-2일 승인)
 *   4. Cloudflare Pages env 에 NTS_API_KEY 등록
 *
 * 활용:
 *   - 셀러 가입 시 사업자번호 + 대표자 + 개업일 자동 검증
 *   - 🛡️ 2026-06-12 (사용자 결정): 자동승인 폐지 — 검증 결과(nts_verify_result)는
 *     어드민 검수 화면의 **참고 신호**로만 저장. 가입 승인(status 전환)은 항상 수동.
 *     (autoApprovable 필드명은 호환 위해 유지 — 의미는 '진위 일치 + 계속사업자'.)
 *   - 큐레이터 정산 사업자정보 인증(미일치 차단)은 가입 승인이 아니므로 기존 유지.
 *
 * graceful: NTS_API_KEY 없으면 검증 skip (기존 동작 유지).
 *           API 호출 실패 시도 graceful — 가입 흐름 차단 X.
 */

export interface NtsValidateInput {
  businessNumber: string  // '1234567890' or '123-45-67890'
  startDate: string       // YYYYMMDD or YYYY-MM-DD
  representative: string
}

export interface NtsValidateResult {
  /** API 호출 성공 여부 */
  ok: boolean
  /** 진위 일치 ('01') / 불일치 ('02') / 조회 불가 (other) */
  valid: '01' | '02' | string | null
  /** 휴/폐업/계속사업자 상태 */
  status?: '계속사업자' | '휴업자' | '폐업자' | string | null
  /** 사용자에게 보여줄 메시지 */
  message: string
  /** 자동 승인 가능 여부 (valid='01' AND 계속사업자) */
  autoApprovable: boolean
  /** 원본 응답 (debug) */
  raw?: unknown
}

const NTS_BASE = 'https://api.odcloud.kr/api/nts-businessman/v1'

/**
 * 사업자번호 + 대표자 + 개업일 진위 확인 (POST /validate).
 * 한 번에 휴/폐업 상태도 함께 반환.
 */
export async function ntsValidateBusiness(
  apiKey: string | undefined,
  input: NtsValidateInput,
): Promise<NtsValidateResult> {
  if (!apiKey) {
    return { ok: false, valid: null, message: 'NTS_API_KEY 미설정 — skip', autoApprovable: false }
  }
  const b_no = String(input.businessNumber).replace(/-/g, '')
  if (!/^\d{10}$/.test(b_no)) {
    return { ok: false, valid: null, message: '사업자번호 형식 오류 (10자리 숫자)', autoApprovable: false }
  }
  const start_dt = String(input.startDate).replace(/-/g, '')
  if (!/^\d{8}$/.test(start_dt)) {
    return { ok: false, valid: null, message: '개업일 형식 오류 (YYYYMMDD)', autoApprovable: false }
  }
  const p_nm = String(input.representative).trim()
  if (!p_nm) {
    return { ok: false, valid: null, message: '대표자명 필수', autoApprovable: false }
  }

  try {
    const url = `${NTS_BASE}/validate?serviceKey=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businesses: [{ b_no, start_dt, p_nm }],
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      return { ok: false, valid: null, message: `NTS API HTTP ${res.status}`, autoApprovable: false }
    }
    const data = await res.json() as {
      status_code?: string
      data?: Array<{
        valid?: string
        valid_msg?: string
        request_param?: unknown
        status?: { b_stt?: string; b_stt_cd?: string }
      }>
    }
    const item = data.data?.[0]
    const valid = item?.valid ?? null
    const bStt = item?.status?.b_stt ?? null
    const autoApprovable = valid === '01' && bStt === '계속사업자'

    let message = ''
    if (valid === '01') {
      message = bStt === '계속사업자'
        ? '진위 일치 — 자동 승인 가능'
        : `진위 일치 — ${bStt} (수동 검수)`
    } else if (valid === '02') {
      message = '사업자번호 + 대표자명 + 개업일이 일치하지 않습니다'
    } else {
      message = item?.valid_msg || '조회 불가'
    }

    return { ok: true, valid, status: bStt, message, autoApprovable, raw: data }
  } catch (err) {
    return {
      ok: false,
      valid: null,
      message: (err as Error).name === 'TimeoutError' ? 'NTS API 시간 초과' : `NTS API 호출 실패: ${(err as Error).message}`,
      autoApprovable: false,
    }
  }
}

/**
 * 휴/폐업 상태 단순 조회 (POST /status).
 * 진위 확인 없이 상태만 — 정기 cron 으로 기존 셀러 검증할 때 유용.
 */
export async function ntsCheckStatus(
  apiKey: string | undefined,
  businessNumbers: string[],
): Promise<Array<{ b_no: string; b_stt: string | null; tax_type?: string | null }>> {
  if (!apiKey || businessNumbers.length === 0) return []
  const bNos = businessNumbers.map(n => String(n).replace(/-/g, '')).filter(n => /^\d{10}$/.test(n))
  if (bNos.length === 0) return []

  try {
    const url = `${NTS_BASE}/status?serviceKey=${encodeURIComponent(apiKey)}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ b_no: bNos }),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = await res.json() as {
      data?: Array<{ b_no: string; b_stt?: string; tax_type?: string }>
    }
    return (data.data || []).map(d => ({ b_no: d.b_no, b_stt: d.b_stt || null, tax_type: d.tax_type || null }))
  } catch {
    return []
  }
}
