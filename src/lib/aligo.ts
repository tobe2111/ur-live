/**
 * 알리고 알림톡 API 통합 라이브러리
 * 
 * @description 알리고 API와 통신하는 모든 함수를 제공합니다.
 * @author 리스터코퍼레이션 개발팀
 * @created 2026-02-22
 * 
 * API 문서: https://smartsms.aligo.in/alimapi.html (카카오 API 주소는 ALIGO_KAKAO_BASE)
 */

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface AligoTokenResponse {
  token: string
  urtime: number
}

export interface AligoApiResponse {
  result_code: string
  message: string
  token?: string
  urtime?: number
  authnum?: string
  senderkey?: string
  tpl_code?: string
  msg_id?: string
  list?: AligoListItem[]
  [key: string]: unknown
}

export interface AligoListItem {
  plusid?: string
  senderkey?: string
  name?: string
  result?: string
  tpl_code?: string
  tpl_name?: string
  tpl_content?: string
  [key: string]: unknown
}

export interface AligoEnv {
  ALIGO_API_KEY: string
  ALIGO_USER_ID: string
  /** 발신번호. 라이브 env 이름은 `ALIGO_SENDER` 다(2026-10-11 실측) — 코드는 오래 `_PHONE` 만 읽었다. */
  ALIGO_SENDER_PHONE?: string
  ALIGO_SENDER?: string
  DISCORD_WEBHOOK_URL?: string
}

export interface KakaoChannelData {
  channelId: string     // @myshop
  phoneNumber: string   // 01012345678
}

export interface TemplateData {
  name: string
  content: string
  templateCode: string
}

export interface AlimtalkMessage {
  senderKey: string
  templateCode: string
  to: string
  message: string
  /** 발신번호 — 알리고 알림톡 발송의 필수값. 없으면 env → 워커 전역 env 순으로 찾는다. */
  sender?: string
  /** 알림톡이 실패하면 알리고가 같은 내용을 문자로 대신 보낸다(실패 건에만 문자 요금). */
  failoverText?: { title: string; text: string }
  buttons?: Array<{
    type: string
    name: string
    url_mobile?: string
    url_pc?: string
  }>
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * URL 인코딩된 폼 데이터 생성
 */
function createFormData(data: Record<string, string | number | boolean | undefined>): URLSearchParams {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value))
    }
  }
  return params
}

/**
 * 🔧 2026-10-11 알리고 카카오 API 정본 주소. 이 파일은 오래 `smartsms.aligo.in/admin/api/akv10` 으로
 * 보냈는데 그 주소는 **HTML 페이지**를 돌려준다 — 라이브 실패 기록 원문이
 * `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` 이고, 성공 기록(`alimtalk_dispatch_log`)은
 * **0건**이다. 즉 이 파일을 거친 알림톡은 한 번도 안 나갔다. 셀러 발송 경로(`features/alimtalk/aligo.ts`)는
 * 처음부터 이 주소를 썼다 — 두 벌이 갈려 있었다.
 */
export const ALIGO_KAKAO_BASE = 'https://kakaoapi.aligo.in/akv10'
/** 알리고 문자(SMS/LMS) API. */
export const ALIGO_SMS_URL = 'https://apis.aligo.in/send/'

/**
 * 알리고 응답 성공 판정. 카카오 API(akv10)는 `code: 0`, 문자 API 는 `result_code: 1` 이다.
 * 🔴 `Number('')` 은 0 이다 — 빈 값을 성공으로 읽지 않게 먼저 거른다.
 */
export function aligoOk(r: unknown): boolean {
  const o = (r ?? {}) as Record<string, unknown>
  const code = o.code
  if (code !== undefined && code !== null && String(code).trim() !== '') return Number(code) === 0
  return String(o.result_code ?? '').trim() === '1'
}

function aligoCode(r: unknown): string {
  const o = (r ?? {}) as Record<string, unknown>
  return String(o.code ?? o.result_code ?? '')
}

/** JSON 이 아닌 응답(HTML 오류 페이지 등)을 그대로 던지지 않고 읽을 수 있는 오류로 바꾼다. */
async function readAligoJson(response: Response): Promise<AligoApiResponse> {
  const text = await response.text()
  try {
    return JSON.parse(text) as AligoApiResponse
  } catch {
    throw new Error(`[Aligo] JSON 이 아닌 응답 (HTTP ${response.status}): ${text.slice(0, 80)}`)
  }
}

/** 발신번호 — 넘긴 env → 워커 전역 env 순. 호출부가 키 두 개만 담은 env 를 넘기는 곳이 많다. */
export async function resolveAligoSender(env?: Partial<AligoEnv> | Record<string, unknown> | null): Promise<string> {
  const e = (env ?? {}) as Record<string, unknown>
  const direct = String(e.ALIGO_SENDER_PHONE ?? e.ALIGO_SENDER ?? '').replace(/[^0-9]/g, '')
  if (direct) return direct
  try {
    const mod = await import('cloudflare:workers')
    const g = (mod.env ?? {}) as unknown as Record<string, unknown>
    return String(g.ALIGO_SENDER_PHONE ?? g.ALIGO_SENDER ?? '').replace(/[^0-9]/g, '')
  } catch {
    return ''
  }
}

/** 카카오 API 공통 호출 — 토큰을 받아 apikey·userid·token 을 모두 싣는다. */
async function aligoKakaoPost(
  env: AligoEnv,
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  timeoutMs = 15_000,
): Promise<AligoApiResponse> {
  const { token } = await getAligoToken(env)
  const response = await fetch(`${ALIGO_KAKAO_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    signal: AbortSignal.timeout(timeoutMs),
    body: createFormData({ apikey: env.ALIGO_API_KEY, userid: env.ALIGO_USER_ID, token, ...params }),
  })
  return readAligoJson(response)
}

/**
 * 알리고 API 응답 검증
 */
function validateAligoResponse(result: AligoApiResponse, operation: string): void {
  if (!aligoOk(result)) {
    throw new Error(`[Aligo ${operation}] ${result.message} (code: ${aligoCode(result)})`)
  }
}

// ============================================================================
// 1. API 토큰 생성
// ============================================================================

/**
 * 알리고 API 토큰 생성
 * @description 모든 API 호출 전에 토큰을 생성해야 합니다. (유효시간: 30초)
 */
export async function getAligoToken(
  env: AligoEnv
): Promise<AligoTokenResponse> {
  // v35 FIX: Aligo 타임아웃 없으면 worker hang → Alimtalk 전체 블로킹
  const response = await fetch(`${ALIGO_KAKAO_BASE}/token/create/30/s/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    signal: AbortSignal.timeout(5000),
    body: createFormData({
      apikey: env.ALIGO_API_KEY,
      userid: env.ALIGO_USER_ID
    })
  })

  const result = await readAligoJson(response)
  validateAligoResponse(result, 'Token Create')

  const token = result.token as string
  const urtime = result.urtime as number

  return { token, urtime }
}

// ============================================================================
// 2. 카카오 채널 관리
// ⚠️ 2026-10-11: 호출부 0. 주소는 알리고 카카오 API 정본(`/profile/*`)으로 맞췄지만 실호출로
//   검증한 적이 없다 — 쓰기 전에 알리고 스펙(인증번호·카테고리 파라미터)과 대조할 것.
// ============================================================================

/**
 * 카카오 채널 인증 요청
 * @description 채널 등록 전에 인증이 필요합니다.
 */
export async function requestKakaoChannelAuth(
  env: AligoEnv,
  data: KakaoChannelData
): Promise<{ success: boolean; authNumber?: string }> {
  const result = await aligoKakaoPost(env, '/profile/auth/', {
    plusid: data.channelId,
    phonenumber: data.phoneNumber
  })
  validateAligoResponse(result, 'Channel Auth Request')

  return {
    success: true,
    authNumber: result.authnum as string | undefined
  }
}

/**
 * 카카오 채널 등록
 * @description 인증 후 채널을 등록합니다. 발신키(senderKey)를 받습니다.
 */
export async function registerKakaoChannel(
  env: AligoEnv,
  data: KakaoChannelData
): Promise<{ success: boolean; senderKey: string }> {
  const result = await aligoKakaoPost(env, '/profile/add/', {
    plusid: data.channelId,
    phonenumber: data.phoneNumber
  })
  validateAligoResponse(result, 'Channel Register')

  return {
    success: true,
    senderKey: result.senderkey as string
  }
}

/**
 * 카카오 채널 목록 조회
 */
export async function getKakaoChannels(
  env: AligoEnv
): Promise<Array<{ plusid: string; senderkey: string; name: string }>> {
  const result = await aligoKakaoPost(env, '/profile/list/', {})
  validateAligoResponse(result, 'Channel List')

  return (result.list || []) as Array<{ plusid: string; senderkey: string; name: string }>
}

// ============================================================================
// 3. 템플릿 관리
// ============================================================================

/**
 * 템플릿 등록 (등록만 한다 — 카카오 검수 요청은 별도 `/template/request/`)
 */
export async function registerTemplate(
  env: AligoEnv,
  senderKey: string,
  data: TemplateData
): Promise<{ success: boolean; templateCode: string }> {
  const result = await aligoKakaoPost(env, '/template/add/', {
    senderkey: senderKey,
    tpl_name: data.name,
    tpl_content: data.content,
    tpl_code: data.templateCode
  })
  validateAligoResponse(result, 'Template Register')

  return {
    success: true,
    templateCode: result.tpl_code as string
  }
}

/**
 * 템플릿 목록 조회
 */
export async function getTemplates(
  env: AligoEnv,
  senderKey: string
): Promise<AligoListItem[]> {
  const result = await aligoKakaoPost(env, '/template/list/', { senderkey: senderKey })
  validateAligoResponse(result, 'Template List')

  return result.list || []
}

// ============================================================================
// 4. 알림톡 발송
// ============================================================================

/**
 * 알림톡 발송 (단건)
 */
export async function sendAlimtalk(
  env: AligoEnv,
  data: AlimtalkMessage
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // 버튼 JSON 변환
    const buttonJson = data.buttons ? JSON.stringify({ button: data.buttons }) : undefined
    // 🔧 2026-10-11: 발신번호(sender)는 알리고 알림톡의 필수값인데 이 함수는 한 번도 싣지 않았다.
    const sender = data.sender || await resolveAligoSender(env)
    const fo = data.failoverText && sender ? data.failoverText : undefined

    // 🛡️ 2026-04-22: 10초 timeout 추가 — Aligo 느릴 때 worker 타임아웃 방어
    const result = await aligoKakaoPost(env, '/alimtalk/send/', {
      senderkey: data.senderKey,
      tpl_code: data.templateCode,
      sender: sender || undefined,
      receiver_1: data.to,
      subject_1: '알림톡',
      message_1: data.message,
      button_1: buttonJson,
      ...(fo ? { failover: 'Y', fsubject_1: fo.title.slice(0, 30), fmessage_1: fo.text.slice(0, 1000) } : {}),
    }, 10_000)

    if (!aligoOk(result)) {
      const code = aligoCode(result)
      console.error('[Aligo] ❌ 알림톡 발송 실패:', code, result.message)
      // 🛡️ 2026-04-22: 잔액 부족(-2) 시 Discord 즉시 알림 — 운영자가 충전 누락 인지
      if (code === '-2' && env.DISCORD_WEBHOOK_URL) {
        try {
          const { sendDiscordAlert } = await import('../worker/utils/discord-alert')
          await sendDiscordAlert(
            env.DISCORD_WEBHOOK_URL,
            '⚠️ Aligo 알림톡 잔액 부족',
            `알림톡 발송 실패 — Aligo 계정 잔액 충전 필요\n수신자: ${data.to.slice(0, 4)}***\n응답: ${result.message}`,
            'error'
          )
        } catch { /* Discord 실패는 무시 */ }
      }
      return {
        success: false,
        error: `${result.message ?? ''} (code: ${code})`.trim()
      }
    }

    const info = (result as Record<string, unknown>).info as Record<string, unknown> | undefined
    return {
      success: true,
      messageId: String(info?.mid ?? result.msg_id ?? '') || undefined
    }
  } catch (error: unknown) {
    console.error('[Aligo] ❌ 알림톡 발송 에러:', (error as Error).message)
    return {
      success: false,
      error: (error as Error).message
    }
  }
}

/** 문자(SMS/LMS) 한 통 — 한글 2바이트 기준 90바이트 넘으면 장문(LMS). */
export function smsByteLength(text: string): number {
  let n = 0
  for (const ch of text) n += ch.charCodeAt(0) < 128 ? 1 : 2
  return n
}

/**
 * 🔧 2026-10-11 알리고 문자 발송. 알림톡 템플릿이 카카오 검수를 통과하기 전까지 알림은 이 길로 간다.
 * 발신번호는 알리고 콘솔에 등록·인증된 번호여야 한다(아니면 알리고가 거부한다).
 */
export async function sendAligoSms(
  env: AligoEnv,
  data: { to: string; text: string; title?: string; sender?: string }
): Promise<{ success: boolean; messageId?: string; msgType?: 'SMS' | 'LMS'; error?: string }> {
  try {
    const sender = data.sender || await resolveAligoSender(env)
    if (!sender) return { success: false, error: 'no sender phone' }
    const msgType: 'SMS' | 'LMS' = smsByteLength(data.text) <= 90 ? 'SMS' : 'LMS'
    const response = await fetch(ALIGO_SMS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10_000),
      body: createFormData({
        key: env.ALIGO_API_KEY,
        user_id: env.ALIGO_USER_ID,
        sender,
        receiver: data.to,
        msg: data.text.slice(0, 1000),
        msg_type: msgType,
        title: msgType === 'LMS' ? (data.title || '유어딜').slice(0, 22) : undefined,
      }),
    })
    const result = await readAligoJson(response)
    if (!aligoOk(result)) {
      return { success: false, msgType, error: `${result.message ?? ''} (code: ${aligoCode(result)})`.trim() }
    }
    return { success: true, msgType, messageId: result.msg_id ? String(result.msg_id) : undefined }
  } catch (error: unknown) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * 알림톡 발송 결과 조회
 */
export async function getAlimtalkResult(
  env: AligoEnv,
  messageId: string
): Promise<{ success: boolean; status: string; detail?: AligoListItem }> {
  const result = await aligoKakaoPost(env, '/history/detail/', { mid: messageId })
  validateAligoResponse(result, 'Message Result')

  return {
    success: true,
    status: result.list?.[0]?.result || 'unknown',
    detail: result.list?.[0]
  }
}

// ============================================================================
// 5. 유틸리티 함수
// ============================================================================

/**
 * 템플릿 변수 치환
 */
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template

  for (const [key, value] of Object.entries(variables)) {
    // 🛡️ 2026-04-22: regex injection 방어 — key 의 정규식 메타문자 escape
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`#{${escapedKey}}`, 'g')
    result = result.replace(regex, value)
  }
  
  return result
}

/**
 * 전화번호 포맷 검증 및 정규화
 */
export function normalizePhoneNumber(phone: string): string {
  // 하이픈 제거
  let normalized = phone.replace(/-/g, '')
  
  // 010으로 시작하지 않으면 에러
  if (!normalized.startsWith('010')) {
    throw new Error('Invalid phone number format. Must start with 010')
  }
  
  // 11자리가 아니면 에러
  if (normalized.length !== 11) {
    throw new Error('Invalid phone number length. Must be 11 digits')
  }
  
  return normalized
}

/**
 * 알리고 에러 코드 해석
 */
export function parseAligoErrorCode(code: string): string {
  const errorMap: Record<string, string> = {
    '-1': '인증 실패',
    '-2': '잔액 부족',
    '-99': '시스템 에러',
    '0': '전송 실패',
    '1': '전송 성공'
  }
  
  return errorMap[code] || `알 수 없는 에러 (code: ${code})`
}
