/**
 * 알리고 알림톡 API 통합 라이브러리
 * 
 * @description 알리고 API와 통신하는 모든 함수를 제공합니다.
 * @author 리스터코퍼레이션 개발팀
 * @created 2026-02-22
 * 
 * API 문서: https://smartsms.aligo.in/alimapi.html
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
 * 알리고 API 응답 검증
 */
function validateAligoResponse(result: AligoApiResponse, operation: string): void {
  if (result.result_code !== '1') {
    throw new Error(`[Aligo ${operation}] ${result.message} (code: ${result.result_code})`)
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
  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/token/create/30/s/', {
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

  const result: AligoApiResponse = await response.json()
  validateAligoResponse(result, 'Token Create')

  const token = result.token as string
  const urtime = result.urtime as number

  return { token, urtime }
}

// ============================================================================
// 2. 카카오 채널 관리
// ============================================================================

/**
 * 카카오 채널 인증 요청
 * @description 채널 등록 전에 인증이 필요합니다.
 */
export async function requestKakaoChannelAuth(
  env: AligoEnv,
  data: KakaoChannelData
): Promise<{ success: boolean; authNumber?: string }> {
  const { token } = await getAligoToken(env)

  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/plus/request/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    signal: AbortSignal.timeout(15_000),
    body: createFormData({
      token,
      userid: env.ALIGO_USER_ID,
      plusid: data.channelId,
      phonenumber: data.phoneNumber
    })
  })

  const result: AligoApiResponse = await response.json()
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
  const { token } = await getAligoToken(env)

  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/plus/add/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    signal: AbortSignal.timeout(15_000),
    body: createFormData({
      token,
      userid: env.ALIGO_USER_ID,
      plusid: data.channelId,
      phonenumber: data.phoneNumber
    })
  })

  const result: AligoApiResponse = await response.json()
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
  const { token } = await getAligoToken(env)

  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/plus/list/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    signal: AbortSignal.timeout(15_000),
    body: createFormData({
      token,
      userid: env.ALIGO_USER_ID
    })
  })

  const result: AligoApiResponse = await response.json()
  validateAligoResponse(result, 'Channel List')

  return (result.list || []) as Array<{ plusid: string; senderkey: string; name: string }>
}

// ============================================================================
// 3. 템플릿 관리
// ============================================================================

/**
 * 템플릿 등록
 */
export async function registerTemplate(
  env: AligoEnv,
  senderKey: string,
  data: TemplateData
): Promise<{ success: boolean; templateCode: string }> {
  const { token } = await getAligoToken(env)

  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/template/add/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    signal: AbortSignal.timeout(15_000),
    body: createFormData({
      token,
      userid: env.ALIGO_USER_ID,
      senderkey: senderKey,
      tpl_name: data.name,
      tpl_content: data.content,
      tpl_code: data.templateCode
    })
  })

  const result: AligoApiResponse = await response.json()
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
  const { token } = await getAligoToken(env)

  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/template/list/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    signal: AbortSignal.timeout(15_000),
    body: createFormData({
      token,
      userid: env.ALIGO_USER_ID,
      senderkey: senderKey
    })
  })

  const result: AligoApiResponse = await response.json()
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
    const { token } = await getAligoToken(env)

    // 버튼 JSON 변환
    const buttonJson = data.buttons ? JSON.stringify({ button: data.buttons }) : undefined

    // 🛡️ 2026-04-22: 10초 timeout 추가 — Aligo 느릴 때 worker 타임아웃 방어
    const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/alimtalk/send/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      signal: AbortSignal.timeout(10_000),
      body: createFormData({
        token,
        userid: env.ALIGO_USER_ID,
        senderkey: data.senderKey,
        tpl_code: data.templateCode,
        receiver_1: data.to,
        subject_1: '알림톡',
        message_1: data.message,
        button_1: buttonJson
      })
    })

    const result: AligoApiResponse = await response.json()

    if (result.result_code !== '1') {
      console.error('[Aligo] ❌ 알림톡 발송 실패:', result.message)
      // 🛡️ 2026-04-22: 잔액 부족(-2) 시 Discord 즉시 알림 — 운영자가 충전 누락 인지
      if (String(result.result_code) === '-2' && env.DISCORD_WEBHOOK_URL) {
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
        error: result.message
      }
    }

    return {
      success: true,
      messageId: result.msg_id
    }
  } catch (error: unknown) {
    console.error('[Aligo] ❌ 알림톡 발송 에러:', (error as Error).message)
    return {
      success: false,
      error: (error as Error).message
    }
  }
}

/**
 * 알림톡 발송 결과 조회
 */
export async function getAlimtalkResult(
  env: AligoEnv,
  messageId: string
): Promise<{ success: boolean; status: string; detail?: AligoListItem }> {
  const { token } = await getAligoToken(env)

  const response = await fetch('https://smartsms.aligo.in/admin/api/akv10/history/detail/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    signal: AbortSignal.timeout(15_000),
    body: createFormData({
      token,
      userid: env.ALIGO_USER_ID,
      mid: messageId
    })
  })

  const result: AligoApiResponse = await response.json()
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
