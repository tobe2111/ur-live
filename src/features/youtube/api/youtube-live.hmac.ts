/**
 * 🛡️ 2026-05-22: youtube-live.routes.ts (3417줄) 분할 — HMAC + OME admission 타입.
 *
 * OME (OvenMediaEngine) admission webhook 서명 검증용 헬퍼.
 */

export interface OMEAdmissionRequest {
  client: { address: string; port: number; user_agent?: string }
  request: {
    direction: 'incoming' | 'outgoing'
    protocol: 'webrtc' | 'rtmp' | 'srt' | string
    status: 'opening' | 'closing'
    url: string
    new_url?: string
    time?: string
  }
}

export interface OMEAdmissionResponse {
  allowed: boolean
  new_url?: string
  lifetime?: number
  reason?: string
}

export async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function hmacBase64Sha1(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
}
