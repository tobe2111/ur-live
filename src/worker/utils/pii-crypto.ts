/**
 * 🔒 2026-07-13 (데이터 감사 3단계): PII at-rest 암호화 인프라 (플래그·dual-read 안전).
 *
 * 배경: users.email/phone/name/kakao_id, sellers.bank_account 등이 평문. 감사 지적. 이미
 *   `data-crypto.ts`(AES-GCM)가 OAuth 토큰에 쓰이고 dual-read(평문 통과)를 지원하므로 이를 재사용.
 *
 * 핵심 난점 = **조회 키 컬럼**(email/kakao_id/phone 은 `WHERE = ?` 로 조회)은 랜덤 IV AES-GCM 으로
 *   암호화하면 매번 다른 암호문 → 등가 조회 불가. 해결: 결정적 **blind index(HMAC-SHA256)** 컬럼을
 *   별도로 두고 조회는 그 인덱스로, 표시는 암호문 복호화로.
 *
 * 안전 원칙:
 *  - 마스터 스위치 `PII_ENCRYPTION_ENABLED='true'` 일 때만 신규 쓰기가 암호화. 기본 OFF=현행 평문(무변화).
 *  - 읽기(`decryptPii`)는 **항상 dual-read**: 암호문이면 복호화, 평문(legacy)이면 그대로 → 점진 마이그레이션.
 *  - 키 없거나 값 없으면 원본 반환(never throw on write path — 결제/로그인 무중단).
 *
 * ⚠️ 활성화(ON) 전 필수(staging): (1) 각 조회지점을 blind index 로 dual-mode 배선, (2) 각 표시지점을
 *   decryptPii 로 배선, (3) 기존 평문 backfill. 배선 전 ON = 조회 실패/암호문 노출.
 */
import { encryptAtRest, decryptAtRest } from './data-crypto'

interface PiiEnv {
  PII_ENCRYPTION_ENABLED?: string
  DATA_ENCRYPTION_KEY?: string
  PII_BLIND_INDEX_KEY?: string
}

/** 마스터 스위치 — 'true' 일 때만 신규 쓰기 암호화. 키 없으면 강제 OFF(평문 폴백). */
export function piiEncryptionEnabled(env: PiiEnv): boolean {
  return env.PII_ENCRYPTION_ENABLED === 'true' && !!env.DATA_ENCRYPTION_KEY && env.DATA_ENCRYPTION_KEY.length >= 16
}

/**
 * 쓰기 시 PII 암호화. 플래그 OFF/키없음/빈값이면 원본 그대로(현행 동작). never throw.
 * 읽기는 decryptPii 가 dual-read 로 복원.
 */
export async function encryptPii(value: string | null | undefined, env: PiiEnv): Promise<string | null> {
  if (value == null || value === '') return value ?? null
  if (!piiEncryptionEnabled(env)) return value
  try {
    return await encryptAtRest(value, env.DATA_ENCRYPTION_KEY)
  } catch {
    return value // 실패 시 평문 폴백(쓰기 무중단)
  }
}

/**
 * 읽기 시 PII 복호화(dual-read). 암호문이면 평문, 평문(legacy)이면 그대로. 실패 시 원본 반환.
 * 플래그와 무관하게 항상 동작(마이그레이션 중 혼재 대응).
 */
export async function decryptPii(value: string | null | undefined, env: PiiEnv): Promise<string | null> {
  if (value == null || value === '') return value ?? null
  try {
    return await decryptAtRest(value, env.DATA_ENCRYPTION_KEY)
  } catch {
    return value // 복호화 실패해도 앱은 안 죽음(원본 표시)
  }
}

/**
 * 조회용 blind index — 결정적 HMAC-SHA256(hex). 같은 입력 → 같은 출력이라 `WHERE bidx = ?` 조회 가능.
 * 원문 미노출(단방향). email/kakao_id/phone 같은 조회 키 컬럼에 별도 인덱스 컬럼으로 저장.
 * 정규화(trim+lowercase)로 대소문자/공백 차이 흡수(이메일/핸들 매칭 안정).
 */
export async function blindIndex(value: string | null | undefined, env: PiiEnv): Promise<string | null> {
  if (value == null || value === '') return null
  const keyStr = env.PII_BLIND_INDEX_KEY || (env.DATA_ENCRYPTION_KEY ? `bidx:${env.DATA_ENCRYPTION_KEY}` : '')
  if (!keyStr) return null // 키 없으면 인덱스 불가(플래그 OFF 환경)
  try {
    const norm = value.trim().toLowerCase()
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(keyStr), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(norm))
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}
